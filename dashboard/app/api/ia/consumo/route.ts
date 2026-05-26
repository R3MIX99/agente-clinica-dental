import { createServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Endpoint llamado por n8n despues de cada respuesta del agente con Claude.
// Valida X-Shared-Secret y llama a la funcion atomica registrar_consumo_ia.
//
// Cuerpo esperado:
// {
//   "clinica_id":      "uuid",
//   "conversacion_id": "uuid | null",
//   "tokens_entrada":  number,
//   "tokens_salida":   number,
//   "modelo":          "claude-haiku-4-5-20251001" (opcional)
// }

export async function POST(req: NextRequest) {
  // Validar shared secret
  const secret = req.headers.get("x-shared-secret")
  if (!secret || secret !== process.env.N8N_SHARED_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  let body: {
    clinica_id: string
    conversacion_id?: string | null
    tokens_entrada: number
    tokens_salida: number
    modelo?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo invalido" }, { status: 400 })
  }

  const { clinica_id, conversacion_id, tokens_entrada, tokens_salida, modelo } = body

  if (!clinica_id || tokens_entrada == null || tokens_salida == null) {
    return NextResponse.json(
      { error: "Se requieren clinica_id, tokens_entrada y tokens_salida" },
      { status: 400 }
    )
  }

  const db = createServerClient() // service_role — bypasses RLS

  const { data, error } = await db.rpc("registrar_consumo_ia", {
    p_clinica_id:      clinica_id,
    p_conversacion_id: conversacion_id ?? null,
    p_tokens_entrada:  tokens_entrada,
    p_tokens_salida:   tokens_salida,
    p_modelo:          modelo ?? "claude-haiku-4-5-20251001",
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// Endpoint GET para que n8n consulte disponibilidad ANTES de llamar a Claude.
// Query param: ?clinica_id=uuid
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-shared-secret")
  if (!secret || secret !== process.env.N8N_SHARED_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const clinicaId = req.nextUrl.searchParams.get("clinica_id")
  if (!clinicaId) {
    return NextResponse.json({ error: "Se requiere clinica_id" }, { status: 400 })
  }

  const db = createServerClient()
  const { data, error } = await db.rpc("ia_disponible", { p_clinica_id: clinicaId })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
