"use server"

import { createServerClient } from "@/lib/supabase/server"
import { sendAgentMessage } from "@/lib/n8n"
import { revalidatePath } from "next/cache"

// ---------------------------------------------------------------------------
// Tomar control / devolver al bot
// ---------------------------------------------------------------------------

export async function tomarControl(conversationId: string, agenteId: string) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from("conversations")
    .update({ mode: "humano", assigned_agent_id: agenteId })
    .eq("id", conversationId)
  if (error) throw new Error(error.message)
  revalidatePath("/conversaciones")
}

export async function devolverAlBot(conversationId: string) {
  const supabase = createServerClient()

  // 1. Cambiar modo a bot primero para que el Realtime lo refleje de inmediato
  const { error } = await supabase
    .from("conversations")
    .update({ mode: "bot", assigned_agent_id: null })
    .eq("id", conversationId)
  if (error) throw new Error(error.message)

  // 2. Llamar a Claude con el historial de la conversacion y enviar respuesta
  await reanudarConBot(conversationId)

  revalidatePath("/conversaciones")
}

// ---------------------------------------------------------------------------
// Logica interna: retomar la conversacion con el bot
// ---------------------------------------------------------------------------

async function reanudarConBot(conversationId: string) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY no configurada en el servidor")

  const supabase = createServerClient()

  // Obtener la conversacion con datos del paciente
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, channel, patients(nombre, channel, channel_user_id)")
    .eq("id", conversationId)
    .single()

  if (!conv) return

  const paciente = conv.patients as {
    nombre: string
    channel: string
    channel_user_id: string | null
  } | null

  if (!paciente?.channel_user_id) return

  // Obtener los 30 mensajes MAS RECIENTES como contexto.
  // Se ordena descendente para que limit() tome los ultimos, luego se invierte
  // para que Claude los reciba en orden cronologico.
  const { data: mensajesDesc } = await supabase
    .from("messages")
    .select("direction, sender, contenido")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(30)

  const mensajes = mensajesDesc ? [...mensajesDesc].reverse() : null

  if (!mensajes || mensajes.length === 0) return

  // Construir array de mensajes para Claude con roles alternados.
  // Mensajes entrantes → user; salientes (bot o agente) → assistant.
  // Se fusionan mensajes consecutivos del mismo rol para cumplir con la API.
  const claudeMessages: Array<{ role: "user" | "assistant"; content: string }> = []

  for (const msg of mensajes) {
    const role: "user" | "assistant" =
      msg.direction === "entrante" ? "user" : "assistant"
    const last = claudeMessages[claudeMessages.length - 1]
    if (last && last.role === role) {
      last.content += "\n" + msg.contenido
    } else {
      claudeMessages.push({ role, content: msg.contenido })
    }
  }

  // Descartar mensajes iniciales de asistente (Claude exige empezar con user)
  while (claudeMessages.length > 0 && claudeMessages[0].role !== "user") {
    claudeMessages.shift()
  }

  // Si el ultimo mensaje no es del usuario, no hay nada que responder
  if (
    claudeMessages.length === 0 ||
    claudeMessages[claudeMessages.length - 1].role !== "user"
  ) {
    return
  }

  // Obtener datos de clinica y servicios para el system prompt
  const [{ data: clinicaData }, { data: serviciosData }] = await Promise.all([
    supabase.from("clinic_info").select("*").limit(1).single(),
    supabase.from("services").select("nombre, precio, duracion_min, descripcion").eq("activo", true),
  ])

  const clinica = clinicaData as Record<string, unknown> | null
  const servicios = (serviciosData ?? []) as Array<{
    nombre: string
    precio: number
    duracion_min: number | null
    descripcion: string | null
  }>

  const serviciosTxt = servicios
    .map(
      (s) =>
        `- ${s.nombre}: $${Number(s.precio).toLocaleString("es-MX")} MXN${
          s.duracion_min ? ` (${s.duracion_min} min)` : ""
        }. ${s.descripcion ?? ""}`
    )
    .join("\n")

  const faqTexto = Array.isArray(clinica?.faq)
    ? (clinica.faq as Array<{ pregunta: string; respuesta: string }>)
        .map((f) => `P: ${f.pregunta}\nR: ${f.respuesta}`)
        .join("\n\n")
    : ""

  const systemPrompt = `Eres el asistente virtual de ${clinica?.nombre ?? "la clínica"}.

Datos de la clínica:
- Dirección: ${clinica?.direccion ?? ""}
- Teléfono: ${clinica?.telefono ?? ""}
- Correo: ${clinica?.email ?? ""}
- Sitio web: ${clinica?.sitio_web ?? ""}
- Horario: ${clinica?.horario ?? ""}
- Formas de pago: ${clinica?.formas_pago ?? ""}
- Facturación: ${clinica?.facturacion ?? ""}

Servicios:
${serviciosTxt}

Preguntas frecuentes:
${faqTexto}

CONTEXTO DE ESTA SESIÓN: Un agente humano acaba de devolverte el control de la conversación. El historial puede contener mensajes donde el paciente pidió hablar con una persona — esa solicitud ya fue completamente atendida por el agente. No debes reaccionar a esas solicitudes antiguas.

Instrucciones:
1. Responde únicamente sobre la clínica, servicios, citas, horarios, contacto, facturación y formas de pago.
2. USA tipo "handoff" EXCLUSIVAMENTE si el último mensaje del paciente (el que tienes que responder ahora) contiene una solicitud nueva y explícita de hablar con una persona. Solicitudes de agente en mensajes anteriores del historial deben ignorarse por completo.
3. Responde en español formal, sin emojis. Si el texto tiene opciones, haz una lista con guiones (-).
4. Devuelve EXCLUSIVAMENTE un JSON con esta estructura:
   {"tipo": "respuesta" | "handoff", "texto": "tu respuesta"}
5. No incluyas texto fuera del JSON.
6. No puedes agendar citas directamente; indica llamar, enviar mensaje o escribir al correo.`

  // Llamar a la API de Anthropic
  let respuesta: string
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: claudeMessages,
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "(sin cuerpo)")
      throw new Error(`Claude API respondio ${res.status}: ${errorBody}`)
    }

    const json = await res.json()
    respuesta = (json.content?.[0]?.text as string) ?? ""
  } catch (err) {
    throw new Error(`Error al llamar a Claude: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Parsear la respuesta JSON de Claude
  let parsed: { tipo: string; texto: string } = {
    tipo: "respuesta",
    texto:
      "En este momento no puedo procesar su solicitud. Por favor llame al teléfono de la clínica.",
  }
  try {
    const match = respuesta.match(/\{[\s\S]*\}/)
    if (match) parsed = JSON.parse(match[0])
  } catch {
    // usar fallback
  }

  if (parsed.tipo === "handoff") {
    // Verificar si el handoff es legitimo: solo contar como nuevo handoff
    // si el paciente pidio agente en sus mensajes MAS RECIENTES (despues de la
    // ultima respuesta del agente), no en mensajes anteriores del historial.
    const indicadorUltimoSaliente = [...mensajes]
      .reverse()
      .findIndex((m) => m.direction === "saliente")

    const mensajesNuevosPaciente =
      indicadorUltimoSaliente === -1
        ? mensajes.filter((m) => m.direction === "entrante")
        : mensajes
            .slice(mensajes.length - indicadorUltimoSaliente)
            .filter((m) => m.direction === "entrante")

    const textoNuevo = mensajesNuevosPaciente
      .map((m) => m.contenido)
      .join(" ")
      .toLowerCase()

    const handoffExplicito =
      /humano|agente|persona|representante|hablar con/.test(textoNuevo)

    if (!handoffExplicito) {
      // Claude interpreto erroneamente solicitudes antiguas — forzar respuesta normal
      parsed = {
        tipo: "respuesta",
        texto:
          "Estoy aquí para ayudarle. Por favor indíqueme en qué puedo asistirle.",
      }
    } else {
      // Handoff legitimo: el paciente lo esta pidiendo de nuevo ahora
      await supabase
        .from("conversations")
        .update({ mode: "humano", status: "pendiente" })
        .eq("id", conversationId)

      const textoHandoff =
        "En un momento le atiende un miembro de nuestro equipo."

      await Promise.all([
        supabase.from("messages").insert({
          conversation_id: conversationId,
          direction: "saliente",
          sender: "bot",
          contenido: textoHandoff,
        }),
        sendAgentMessage({
          conversationId,
          channel: paciente.channel as "telegram" | "whatsapp",
          channelUserId: paciente.channel_user_id,
          texto: textoHandoff,
          agenteId: "bot",
        }),
      ])
      return
    }
  }

  // Respuesta normal: insertar en BD y enviar por Telegram
  await Promise.all([
    supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "saliente",
      sender: "bot",
      contenido: parsed.texto,
    }),
    sendAgentMessage({
      conversationId,
      channel: paciente.channel as "telegram" | "whatsapp",
      channelUserId: paciente.channel_user_id,
      texto: parsed.texto,
      agenteId: "bot",
    }),
  ])
}

// ---------------------------------------------------------------------------
// Mensajes
// ---------------------------------------------------------------------------

export async function obtenerMensajes(conversationId: string) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("messages")
    .select("id, contenido, direction, sender, created_at, metadata")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function obtenerConversacion(conversationId: string) {
  const supabase = createServerClient()
  // Solo devuelve conversaciones activas (no archivadas)
  const { data } = await supabase
    .from("conversations")
    .select(
      "id, channel, mode, status, last_message_at, assigned_agent_id, patients(id, nombre, channel, channel_user_id), agents(nombre)"
    )
    .eq("id", conversationId)
    .is("deleted_at", null)
    .maybeSingle()
  return data ?? null
}

// ---------------------------------------------------------------------------
// Archivar / restaurar (papelera temporal)
// ---------------------------------------------------------------------------

export async function vaciarPapelera() {
  const supabase = createServerClient()

  // Obtener los IDs archivados para borrar sus mensajes primero
  const { data: archivadas, error: errSelect } = await supabase
    .from("conversations")
    .select("id")
    .not("deleted_at", "is", null)

  if (errSelect) throw new Error(errSelect.message)
  if (!archivadas || archivadas.length === 0) return

  const ids = archivadas.map((c) => c.id)

  // Borrar mensajes (la FK no tiene CASCADE definido)
  const { error: errMsg } = await supabase
    .from("messages")
    .delete()
    .in("conversation_id", ids)
  if (errMsg) throw new Error(errMsg.message)

  // Borrar conversaciones archivadas
  const { error: errConv } = await supabase
    .from("conversations")
    .delete()
    .not("deleted_at", "is", null)
  if (errConv) throw new Error(errConv.message)

  revalidatePath("/conversaciones")
}

export async function archivarConversacion(id: string) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from("conversations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/conversaciones")
}

export async function restaurarConversacion(id: string) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from("conversations")
    .update({ deleted_at: null })
    .eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/conversaciones")
}

// ---------------------------------------------------------------------------
// Enviar mensaje al paciente
// ---------------------------------------------------------------------------

export async function enviarMensajeAlPaciente(params: {
  conversationId: string
  channel: "telegram" | "whatsapp"
  channelUserId: string
  texto: string
  agenteId: string
}) {
  const supabase = createServerClient()

  // 1. Insertar en BD primero para que Realtime dispare antes de que n8n responda
  const { error: errMsg } = await supabase.from("messages").insert({
    conversation_id: params.conversationId,
    direction: "saliente",
    sender: "agente",
    contenido: params.texto,
    metadata: { agente_id: params.agenteId },
  })
  if (errMsg) throw new Error(errMsg.message)

  // 2. Enviar por Telegram via n8n WF03
  await sendAgentMessage({
    conversationId: params.conversationId,
    channel: params.channel,
    channelUserId: params.channelUserId,
    texto: params.texto,
    agenteId: params.agenteId,
  })
}
