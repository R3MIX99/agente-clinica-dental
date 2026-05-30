"use server"

import { createServerClient } from "@/lib/supabase/server"
import { resolverClinicaId } from "@/lib/supabase/server-auth"
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

  const { error } = await supabase
    .from("conversations")
    .update({ mode: "bot", assigned_agent_id: null })
    .eq("id", conversationId)
  if (error) throw new Error(error.message)

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

  // Obtener la conversacion con datos del paciente y clinica_id
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, channel, clinica_id, patients(nombre, channel, channel_user_id)")
    .eq("id", conversationId)
    .single()

  if (!conv) return

  const paciente = conv.patients as {
    nombre: string
    channel: string
    channel_user_id: string | null
  } | null

  if (!paciente?.channel_user_id) return

  const { data: mensajesDesc } = await supabase
    .from("messages")
    .select("direction, sender, contenido")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(30)

  const mensajes = mensajesDesc ? [...mensajesDesc].reverse() : null

  if (!mensajes || mensajes.length === 0) return

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

  while (claudeMessages.length > 0 && claudeMessages[0].role !== "user") {
    claudeMessages.shift()
  }

  if (
    claudeMessages.length === 0 ||
    claudeMessages[claudeMessages.length - 1].role !== "user"
  ) {
    return
  }

  // Obtener datos de clinica (tabla clinicas) y servicios filtrados por clinica_id
  const clinicaId = conv.clinica_id

  const [{ data: clinicaData }, { data: serviciosData }] = await Promise.all([
    supabase.from("clinicas").select("*").eq("id", clinicaId).single(),
    supabase
      .from("services")
      .select("nombre, precio, duracion_min, descripcion")
      .eq("clinica_id", clinicaId)
      .eq("activo", true),
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

  const systemPrompt = `Eres el asistente virtual de ${clinica?.nombre ?? "la clinica"}.

Datos de la clinica:
- Direccion: ${clinica?.direccion ?? ""}
- Telefono: ${clinica?.telefono ?? ""}
- Correo: ${clinica?.email ?? ""}
- Sitio web: ${clinica?.sitio_web ?? ""}
- Horario: ${clinica?.horario ?? ""}
- Formas de pago: ${clinica?.formas_pago ?? ""}
- Facturacion: ${clinica?.facturacion ?? ""}

Servicios:
${serviciosTxt}

Preguntas frecuentes:
${faqTexto}

CONTEXTO DE ESTA SESION: Un agente humano acaba de devolverte el control de la conversacion. El historial puede contener mensajes donde el paciente pidio hablar con una persona; esa solicitud ya fue completamente atendida por el agente. No debes reaccionar a esas solicitudes antiguas.

Instrucciones:
1. Responde unicamente sobre la clinica, servicios, citas, horarios, contacto, facturacion y formas de pago.
2. USA tipo "handoff" EXCLUSIVAMENTE si el ultimo mensaje del paciente contiene una solicitud nueva y explicita de hablar con una persona.
3. Responde en espanol formal, sin emojis. Si el texto tiene opciones, haz una lista con guiones (-).
4. Devuelve EXCLUSIVAMENTE un JSON con esta estructura:
   {"tipo": "respuesta" | "handoff", "texto": "tu respuesta"}
5. No incluyas texto fuera del JSON.
6. No puedes agendar citas directamente; indica llamar, enviar mensaje o escribir al correo.`

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

  let parsed: { tipo: string; texto: string } = {
    tipo: "respuesta",
    texto: "En este momento no puedo procesar su solicitud. Por favor llame al telefono de la clinica.",
  }
  try {
    const match = respuesta.match(/\{[\s\S]*\}/)
    if (match) parsed = JSON.parse(match[0])
  } catch {
    // usar fallback
  }

  if (parsed.tipo === "handoff") {
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
      parsed = {
        tipo: "respuesta",
        texto: "Estoy aqui para ayudarle. Por favor indicame en que puedo asistirle.",
      }
    } else {
      await supabase
        .from("conversations")
        .update({ mode: "humano", status: "pendiente" })
        .eq("id", conversationId)

      const textoHandoff = "En un momento le atiende un miembro de nuestro equipo."

      await Promise.all([
        supabase.from("messages").insert({
          conversation_id: conversationId,
          direction: "saliente",
          sender: "bot",
          contenido: textoHandoff,
        }),
        sendAgentMessage({
          conversationId,
          clinicaId: conv.clinica_id ?? "",
          channel: paciente.channel as "telegram" | "whatsapp",
          channelUserId: paciente.channel_user_id,
          texto: textoHandoff,
          agenteId: "bot",
        }),
      ])
      return
    }
  }

  await Promise.all([
    supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "saliente",
      sender: "bot",
      contenido: parsed.texto,
    }),
    sendAgentMessage({
      conversationId,
      clinicaId: conv.clinica_id ?? "",
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
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const { data: archivadas, error: errSelect } = await supabase
    .from("conversations")
    .select("id")
    .eq("clinica_id", clinicaId)
    .not("deleted_at", "is", null)

  if (errSelect) throw new Error(errSelect.message)
  if (!archivadas || archivadas.length === 0) return

  const ids = archivadas.map((c) => c.id)

  const { error: errMsg } = await supabase
    .from("messages")
    .delete()
    .in("conversation_id", ids)
  if (errMsg) throw new Error(errMsg.message)

  const { error: errConv } = await supabase
    .from("conversations")
    .delete()
    .eq("clinica_id", clinicaId)
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
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const { error: errMsg } = await supabase.from("messages").insert({
    conversation_id: params.conversationId,
    direction: "saliente",
    sender: "agente",
    contenido: params.texto,
    metadata: { agente_id: params.agenteId },
  })
  if (errMsg) throw new Error(errMsg.message)

  await sendAgentMessage({
    conversationId: params.conversationId,
    clinicaId,
    channel: params.channel,
    channelUserId: params.channelUserId,
    texto: params.texto,
    agenteId: params.agenteId,
  })
}
