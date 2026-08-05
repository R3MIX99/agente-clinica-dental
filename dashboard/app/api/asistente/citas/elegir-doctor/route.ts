import { NextRequest, NextResponse } from "next/server"
import { shareSecretValido, resolverPacienteDesdeConversacion } from "@/lib/asistente/auth"
import { asignarDoctorElegido } from "@/lib/citas/asignacion-doctor"
import { limpiarValorTool } from "@/lib/citas/disponibilidad"

// Tool del asistente de IA — cuando la clinica tiene varios doctores y
// ninguno esta marcado como principal, "Buscar disponibilidad" devuelve
// motivo "elegir_doctor" con la lista de opciones; una vez que el paciente
// dice cual prefiere, esta tool guarda esa eleccion (al elegido como
// principal, al resto como respaldo) para que ya se puedan buscar horarios.
//
// POST { conversacion_id, doctor_id }
export async function POST(req: NextRequest) {
  if (!shareSecretValido(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  }

  let body: { conversacion_id?: string; doctor_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido" }, { status: 400 })
  }

  const conversacion_id = body.conversacion_id
  const doctor_id = limpiarValorTool(body.doctor_id)
  if (!conversacion_id || !doctor_id) {
    return NextResponse.json({ ok: false, error: "Se requieren conversacion_id y doctor_id" }, { status: 400 })
  }

  const resuelto = await resolverPacienteDesdeConversacion(conversacion_id)
  if (!resuelto.ok) {
    return NextResponse.json({ ok: false, error: resuelto.error }, { status: 404 })
  }

  const resultado = await asignarDoctorElegido({
    clinicaId: resuelto.clinicaId,
    patientId: resuelto.patientId,
    doctorId: doctor_id,
  })

  if (!resultado.ok) {
    return NextResponse.json({ ok: false, error: resultado.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, doctor_nombre: resultado.doctorNombre })
}
