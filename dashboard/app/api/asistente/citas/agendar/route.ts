import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { shareSecretValido, resolverPacienteDesdeConversacion } from "@/lib/asistente/auth"
import { formatearFechaHoraMex } from "@/lib/asistente/fecha"
import { horarioValidoParaDoctor } from "@/lib/citas/disponibilidad"

// Tool del asistente de IA — agenda una cita con un horario que ya salio de
// /api/asistente/citas/disponibilidad y que el paciente confirmo. Revalida
// que el horario siga libre (pudo ocuparse entre la consulta y la
// confirmacion) antes de crear la cita.
//
// POST { conversacion_id, doctor_id, fecha_hora_iso, servicio_id?, duracion_min? }
export async function POST(req: NextRequest) {
  if (!shareSecretValido(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  }

  let body: {
    conversacion_id?: string
    doctor_id?: string
    fecha_hora_iso?: string
    servicio_id?: string | null
    duracion_min?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido" }, { status: 400 })
  }

  const { conversacion_id, doctor_id, fecha_hora_iso, servicio_id, duracion_min } = body
  if (!conversacion_id || !doctor_id || !fecha_hora_iso) {
    return NextResponse.json(
      { ok: false, error: "Se requieren conversacion_id, doctor_id y fecha_hora_iso" },
      { status: 400 }
    )
  }

  const resuelto = await resolverPacienteDesdeConversacion(conversacion_id)
  if (!resuelto.ok) {
    return NextResponse.json({ ok: false, error: resuelto.error }, { status: 404 })
  }

  const fecha = new Date(fecha_hora_iso)
  if (isNaN(fecha.getTime())) {
    return NextResponse.json({ ok: false, error: "fecha_hora_iso inválida" }, { status: 400 })
  }

  const db = createServerClient()

  // El doctor debe seguir siendo uno de los asignados al paciente
  const { data: asignacion } = await db
    .from("patient_doctors")
    .select("doctor_id")
    .eq("clinica_id", resuelto.clinicaId)
    .eq("patient_id", resuelto.patientId)
    .eq("doctor_id", doctor_id)
    .maybeSingle()
  if (!asignacion) {
    return NextResponse.json(
      { ok: false, error: "Ese doctor no está asignado a este paciente" },
      { status: 400 }
    )
  }

  const duracion = duracion_min ?? 30

  const dentroDeHorario = await horarioValidoParaDoctor({
    clinicaId: resuelto.clinicaId,
    doctorId: doctor_id,
    fechaHoraIso: fecha.toISOString(),
    duracionMin: duracion,
    servicioId: servicio_id,
  })
  if (!dentroDeHorario) {
    return NextResponse.json(
      { ok: false, error: "Ese horario no esta dentro del horario del doctor, o el dia esta bloqueado" },
      { status: 409 }
    )
  }

  // Revalidar que el horario siga libre
  const { data: ocupadas } = await db
    .from("appointments")
    .select("fecha_hora, duracion_min")
    .eq("doctor_id", doctor_id)
    .in("status", ["programada", "confirmada"])
    .gte("fecha_hora", new Date(fecha.getTime() - 4 * 60 * 60_000).toISOString())
    .lte("fecha_hora", new Date(fecha.getTime() + 4 * 60 * 60_000).toISOString())

  const inicioMs = fecha.getTime()
  const finMs = inicioMs + duracion * 60_000
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
    .insert({
      clinica_id: resuelto.clinicaId,
      patient_id: resuelto.patientId,
      doctor_id,
      service_id: servicio_id || null,
      fecha_hora: fecha.toISOString(),
      duracion_min: duracion,
      status: "programada",
      notas: "Agendada por el asistente de IA",
    })
    .select("id, fecha_hora, doctor_id, service_id, status")
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, cita: { ...cita, ...formatearFechaHoraMex(cita.fecha_hora) } })
}
