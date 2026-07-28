"use server"

import { createServerClient } from "@/lib/supabase/server"
import { resolverClinicaId } from "@/lib/supabase/server-auth"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type DatosAnalitica = {
  periodo: { inicio: string; fin: string }
  pacientes_atendidos: number
  conversaciones: {
    total: number
    automaticas: number
    handoff: number
    abiertas: number
    pct_automatica: number
  }
  mensajes: {
    total: number
    paciente: number
    bot: number
    agente: number
  }
  recordatorios_enviados: number
  citas_confirmadas: number
  consumo_ia_mxn: number
  intenciones: Array<{ intencion: string; label: string; total: number }>
  sentimientos: { positivo: number; neutro: number; negativo: number; sin_datos: number }
  serie_diaria: Array<{ fecha: string; paciente: number; bot: number; agente: number }>
}

// ---------------------------------------------------------------------------
// Etiquetas de intencion
// ---------------------------------------------------------------------------

const LABEL_INTENCION: Record<string, string> = {
  cita:         "Agendar cita",
  consulta:     "Consulta general",
  urgencia:     "Urgencia",
  recordatorio: "Recordatorio",
  otro:         "Otro",
}

// ---------------------------------------------------------------------------
// obtenerAnalitica
// ---------------------------------------------------------------------------

export async function obtenerAnalitica(
  inicio: string,
  fin: string
): Promise<DatosAnalitica> {
  const clinicaId = await resolverClinicaId()
  const db = createServerClient()

  // Mensajes con actividad en el periodo (una conversacion puede llevar
  // meses abierta, asi que el periodo se define por la fecha del mensaje,
  // no por la fecha de creacion de la conversacion).
  const { data: msgsConConv } = await db
    .from("messages")
    .select("conversation_id, sender, created_at, conversations!inner(id, patient_id, mode, status, intencion, sentimiento, clinica_id, deleted_at)")
    .eq("conversations.clinica_id", clinicaId)
    .is("conversations.deleted_at", null)
    .gte("created_at", inicio)
    .lte("created_at", fin)

  const listaMsgs = msgsConConv ?? []

  // Conversaciones distintas que tuvieron actividad en el periodo
  const convsMap = new Map<string, { id: string; patient_id: string | null; mode: string; status: string; intencion: string | null; sentimiento: string | null }>()
  for (const m of listaMsgs) {
    const c = Array.isArray(m.conversations) ? m.conversations[0] : m.conversations
    if (c && !convsMap.has(c.id)) convsMap.set(c.id, c)
  }
  const listaConvs = Array.from(convsMap.values())

  // Recordatorios enviados en el periodo
  const { count: recordatorios } = await db
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("clinica_id", clinicaId)
    .not("recordatorio_enviado_at", "is", null)
    .gte("recordatorio_enviado_at", inicio)
    .lte("recordatorio_enviado_at", fin)

  // Citas confirmadas con fecha en el periodo
  const { count: citas } = await db
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("clinica_id", clinicaId)
    .eq("status", "confirmada")
    .gte("fecha_hora", inicio)
    .lte("fecha_hora", fin)

  // Consumo de IA en el periodo
  const { data: consumosData } = await db
    .from("consumos_ia")
    .select("costo_descontado_mxn")
    .eq("clinica_id", clinicaId)
    .gte("created_at", inicio)
    .lte("created_at", fin)

  const consumoTotal = (consumosData ?? []).reduce(
    (acc, c) => acc + Number(c.costo_descontado_mxn ?? 0),
    0
  )

  // Derivados de conversaciones
  const total      = listaConvs.length
  const automaticas = listaConvs.filter((c) => c.mode === "bot" && c.status === "cerrada").length
  const handoff    = listaConvs.filter((c) => c.mode === "humano").length
  const abiertas   = listaConvs.filter((c) => c.status === "abierta").length
  const pacientesSet = new Set(listaConvs.map((c) => c.patient_id).filter(Boolean))

  // Mensajes por tipo de remitente
  const msgPaciente = listaMsgs.filter((m) => m.sender === "paciente").length
  const msgBot      = listaMsgs.filter((m) => m.sender === "bot").length
  const msgAgente   = listaMsgs.filter((m) => m.sender === "agente").length

  // Intenciones
  const intMap: Record<string, number> = {}
  for (const c of listaConvs) {
    const key = (c.intencion as string | null) ?? "otro"
    intMap[key] = (intMap[key] ?? 0) + 1
  }
  const intenciones = Object.entries(intMap)
    .map(([intencion, count]) => ({
      intencion,
      label: LABEL_INTENCION[intencion] ?? intencion,
      total: count,
    }))
    .sort((a, b) => b.total - a.total)

  // Sentimientos
  let positivo = 0, neutro = 0, negativo = 0, sin_datos = 0
  for (const c of listaConvs) {
    const s = c.sentimiento as string | null
    if (s === "positivo") positivo++
    else if (s === "neutro") neutro++
    else if (s === "negativo") negativo++
    else sin_datos++
  }

  // Serie diaria de mensajes por remitente
  const diaMap: Record<string, { paciente: number; bot: number; agente: number }> = {}
  for (const m of listaMsgs) {
    const fecha = (m.created_at as string).slice(0, 10)
    if (!diaMap[fecha]) diaMap[fecha] = { paciente: 0, bot: 0, agente: 0 }
    const s = m.sender as string
    if (s === "paciente") diaMap[fecha].paciente++
    else if (s === "bot") diaMap[fecha].bot++
    else if (s === "agente") diaMap[fecha].agente++
  }
  const serie_diaria = Object.entries(diaMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, v]) => ({ fecha, ...v }))

  return {
    periodo: { inicio, fin },
    pacientes_atendidos: pacientesSet.size,
    conversaciones: {
      total,
      automaticas,
      handoff,
      abiertas,
      pct_automatica: total > 0 ? Math.round((automaticas / total) * 100) : 0,
    },
    mensajes: {
      total: listaMsgs.length,
      paciente: msgPaciente,
      bot: msgBot,
      agente: msgAgente,
    },
    recordatorios_enviados: recordatorios ?? 0,
    citas_confirmadas:      citas ?? 0,
    consumo_ia_mxn:         Math.round(consumoTotal * 100) / 100,
    intenciones,
    sentimientos: { positivo, neutro, negativo, sin_datos },
    serie_diaria,
  }
}
