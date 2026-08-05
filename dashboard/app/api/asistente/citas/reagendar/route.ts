import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { shareSecretValido, resolverPacienteDesdeConversacion } from "@/lib/asistente/auth"
import { formatearFechaHoraMex, tieneZonaHorariaExplicita } from "@/lib/asistente/fecha"
import { horarioValidoParaDoctor } from "@/lib/citas/disponibilidad"

// Tool del asistente de IA — reagenda una cita existente del paciente de
// esta conversacion a un nuevo horario (que ya se confirmo con el paciente).
//
// POST { conversacion_id, cita_id, fecha_hora_iso }
export async function POST(req: NextRequest) {
  if (!shareSecretValido(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  }

  let body: { conversacion_id?: string; cita_id?: string; fecha_hora_iso?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido" }, { status: 400 })
  }

  const { conversacion_id, cita_id, fecha_hora_iso } = body
  if (!conversacion_id || !cita_id || !fecha_hora_iso) {
    return NextResponse.json(
      { ok: false, error: "Se requieren conversacion_id, cita_id y fecha_hora_iso" },
      { status: 400 }
    )
  }

  const resuelto = await resolverPacienteDesdeConversacion(conversacion_id)
  if (!resuelto.ok) {
    return NextResponse.json({ ok: false, error: resuelto.error }, { status: 404 })
  }

  if (!tieneZonaHorariaExplicita(fecha_hora_iso)) {
    return NextResponse.json(
      { ok: false, error: "fecha_hora_iso debe incluir zona horaria explicita (terminar en Z). Usa el valor exacto que devolvio Buscar disponibilidad, sin modificarlo." },
      { status: 400 }
    )
  }
  const fecha = new Date(fecha_hora_iso)
  if (isNaN(fecha.getTime())) {
    return NextResponse.json({ ok: false, error: "fecha_hora_iso inválida" }, { status: 400 })
  }

  const db = createServerClient()

  // La cita debe pertenecer al paciente de esta conversacion
  const { data: citaActual } = await db
    .from("appointments")
    .select("id, doctor_id, duracion_min, patient_id, clinica_id, service_id")
    .eq("id", cita_id)
    .eq("patient_id", resuelto.patientId)
    .eq("clinica_id", resuelto.clinicaId)
    .maybeSingle()

  if (!citaActual) {
    return NextResponse.json({ ok: false, error: "No se encontró esa cita para este paciente" }, { status: 404 })
  }
  if (!citaActual.doctor_id) {
    return NextResponse.json({ ok: false, error: "Esa cita no tiene un doctor asignado" }, { status: 400 })
  }

  const duracion = citaActual.duracion_min ?? 30

  const dentroDeHorario = await horarioValidoParaDoctor({
    clinicaId: resuelto.clinicaId,
    doctorId: citaActual.doctor_id,
    fechaHoraIso: fecha.toISOString(),
    duracionMin: duracion,
    servicioId: citaActual.service_id,
  })
  if (!dentroDeHorario) {
    return NextResponse.json(
      { ok: false, error: "Ese horario no esta dentro del horario del doctor, o el dia esta bloqueado" },
      { status: 409 }
    )
  }

  const inicioMs = fecha.getTime()
  const finMs = inicioMs + duracion * 60_000

  const { data: ocupadas } = await db
    .from("appointments")
    .select("id, fecha_hora, duracion_min")
    .eq("doctor_id", citaActual.doctor_id)
    .neq("id", cita_id)
    .in("status", ["programada", "confirmada"])
    .gte("fecha_hora", new Date(inicioMs - 4 * 60 * 60_000).toISOString())
    .lte("fecha_hora", new Date(inicioMs + 4 * 60 * 60_000).toISOString())

  const choca = (ocupadas ?? []).some((c) => {
    const oInicio = new Date(c.fecha_hora).getTime()
    const oFin = oInicio + (c.duracion_min ?? 30) * 60_000
    return inicioMs < oFin && finMs > oInicio
  })
  if (choca) {
    return NextResponse.json(
      { ok: false, error: "Ese horario ya no está disponible, hay que elegir otro" },
      { status: 409 }
    )
  }

  const { data: cita, error } = await db
    .from("appointments")
    .update({ fecha_hora: fecha.toISOString(), status: "programada" })
    .eq("id", cita_id)
    .select("id, fecha_hora, doctor_id, service_id, status")
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, cita: { ...cita, ...formatearFechaHoraMex(cita.fecha_hora) } })
}
