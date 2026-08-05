import { NextRequest, NextResponse } from "next/server"
import { shareSecretValido, resolverPacienteDesdeConversacion } from "@/lib/asistente/auth"
import { buscarDisponibilidad } from "@/lib/citas/disponibilidad"

// Tool del asistente de IA (n8n) — busca horarios disponibles para el
// paciente de una conversacion, revisando primero a su doctor principal y
// cayendo al doctor de respaldo (patient_doctors.orden) si no hay espacio.
//
// GET /api/asistente/citas/disponibilidad?conversacion_id=...&servicio_id=...
export async function GET(req: NextRequest) {
  if (!shareSecretValido(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  }

  const conversacionId = req.nextUrl.searchParams.get("conversacion_id")
  const servicioId = req.nextUrl.searchParams.get("servicio_id")
  const fechaDeseada = req.nextUrl.searchParams.get("fecha_deseada")
  const horaDeseada = req.nextUrl.searchParams.get("hora_deseada")

  if (!conversacionId) {
    return NextResponse.json({ ok: false, error: "Se requiere conversacion_id" }, { status: 400 })
  }

  const resuelto = await resolverPacienteDesdeConversacion(conversacionId)
  if (!resuelto.ok) {
    return NextResponse.json({ ok: false, error: resuelto.error }, { status: 404 })
  }

  const resultado = await buscarDisponibilidad({
    clinicaId: resuelto.clinicaId,
    patientId: resuelto.patientId,
    servicioId,
    fechaDeseada,
    horaDeseada,
  })

  return NextResponse.json(resultado)
}
