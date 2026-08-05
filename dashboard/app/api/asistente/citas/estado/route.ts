import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { shareSecretValido, resolverPacienteDesdeConversacion } from "@/lib/asistente/auth"
import { formatearFechaHoraMex } from "@/lib/asistente/fecha"

// Tool del asistente de IA — devuelve las proximas citas (no pasadas, no
// canceladas) del paciente de esta conversacion, para responder "¿cuándo es
// mi cita?" o listar varias si tiene mas de una agendada.
//
// GET /api/asistente/citas/estado?conversacion_id=...
export async function GET(req: NextRequest) {
  if (!shareSecretValido(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  }

  const conversacionId = req.nextUrl.searchParams.get("conversacion_id")
  if (!conversacionId) {
    return NextResponse.json({ ok: false, error: "Se requiere conversacion_id" }, { status: 400 })
  }

  const resuelto = await resolverPacienteDesdeConversacion(conversacionId)
  if (!resuelto.ok) {
    return NextResponse.json({ ok: false, error: resuelto.error }, { status: 404 })
  }

  const db = createServerClient()
  const { data: citas, error } = await db
    .from("appointments")
    .select("id, fecha_hora, status, services(nombre), doctors(nombre)")
    .eq("patient_id", resuelto.patientId)
    .eq("clinica_id", resuelto.clinicaId)
    .in("status", ["programada", "confirmada", "por_reagendar"])
    .gte("fecha_hora", new Date().toISOString())
    .order("fecha_hora")

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    citas: (citas ?? []).map((c) => ({
      id: c.id,
      status: c.status,
      servicio: (c.services as { nombre: string } | null)?.nombre ?? null,
      doctor: (c.doctors as { nombre: string } | null)?.nombre ?? null,
      ...formatearFechaHoraMex(c.fecha_hora),
    })),
  })
}
