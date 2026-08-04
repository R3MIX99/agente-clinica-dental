import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { shareSecretValido, resolverPacienteDesdeConversacion } from "@/lib/asistente/auth"

// Tool del asistente de IA — cancela una cita del paciente de esta
// conversacion. Nunca borra el registro (igual que el resto de la app):
// solo marca status = "cancelada".
//
// POST { conversacion_id, cita_id }
export async function POST(req: NextRequest) {
  if (!shareSecretValido(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  }

  let body: { conversacion_id?: string; cita_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido" }, { status: 400 })
  }

  const { conversacion_id, cita_id } = body
  if (!conversacion_id || !cita_id) {
    return NextResponse.json({ ok: false, error: "Se requieren conversacion_id y cita_id" }, { status: 400 })
  }

  const resuelto = await resolverPacienteDesdeConversacion(conversacion_id)
  if (!resuelto.ok) {
    return NextResponse.json({ ok: false, error: resuelto.error }, { status: 404 })
  }

  const db = createServerClient()

  const { data: cita, error } = await db
    .from("appointments")
    .update({ status: "cancelada" })
    .eq("id", cita_id)
    .eq("patient_id", resuelto.patientId)
    .eq("clinica_id", resuelto.clinicaId)
    .select("id, fecha_hora, status")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  if (!cita) {
    return NextResponse.json({ ok: false, error: "No se encontró esa cita para este paciente" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, cita })
}
