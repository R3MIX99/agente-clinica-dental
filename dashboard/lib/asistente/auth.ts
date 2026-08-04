import { NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

// Mismo patron que dashboard/app/api/ia/consumo/route.ts: n8n manda este
// header con un secreto compartido guardado en las env vars de ambos lados.
export function shareSecretValido(req: NextRequest): boolean {
  const secret = req.headers.get("x-shared-secret")
  return !!secret && secret === process.env.N8N_SHARED_SECRET
}

// Resuelve clinica_id y patient_id a partir del conversacion_id — así el
// asistente nunca manda el patient_id directo (evita que un prompt
// manipulado intente operar sobre el paciente de otra conversacion).
export async function resolverPacienteDesdeConversacion(conversacionId: string): Promise<
  { ok: true; clinicaId: string; patientId: string } | { ok: false; error: string }
> {
  const db = createServerClient()
  const { data } = await db
    .from("conversations")
    .select("clinica_id, patient_id")
    .eq("id", conversacionId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!data?.clinica_id || !data.patient_id) {
    return { ok: false, error: "Conversación o paciente no encontrado" }
  }
  return { ok: true, clinicaId: data.clinica_id, patientId: data.patient_id }
}
