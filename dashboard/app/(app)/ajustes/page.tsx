import { redirect } from "next/navigation"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import { resolverClinicaId } from "@/lib/supabase/server-auth"
import { AjustesClient } from "./AjustesClient"
import type { CanalTelegramPublico } from "./actions"

export const metadata = { title: "Ajustes — Clínica Dental" }

export default async function AjustesPage() {
  const authClient = await createAuthClient()
  const { data: { session } } = await authClient.auth.getSession()
  if (!session?.user) redirect("/login")

  let clinicaId: string | null = null
  try {
    clinicaId = await resolverClinicaId()
  } catch {
    // Sin clinica activa
  }

  if (!clinicaId) {
    return <AjustesClient clinica={null} servicios={[]} canalTelegram={null} />
  }

  const db = createServerClient()

  const [clinicaRes, serviciosRes, canalRes] = await Promise.all([
    db
      .from("clinicas")
      .select(
        "nombre, logo_url, direccion, telefono, email, sitio_web, horario, formas_pago, facturacion, mapa_url, faq, google_reserva_url, datos_pago"
      )
      .eq("id", clinicaId)
      .single(),
    db
      .from("services")
      .select("id, nombre, descripcion, precio, duracion_min, activo")
      .eq("clinica_id", clinicaId)
      .order("nombre"),
    db
      .from("clinic_channels")
      .select("id, canal, activo, config, webhook_url, updated_at")
      .eq("clinica_id", clinicaId)
      .eq("canal", "telegram")
      .maybeSingle(),
  ])

  type FaqItem = { pregunta: string; respuesta: string }

  const clinica = clinicaRes.data
    ? { ...clinicaRes.data, faq: clinicaRes.data.faq as FaqItem[] | null }
    : null

  // Sanitizar canal: el config con el token nunca llega al cliente
  const canalData = canalRes.data
  const configData = (canalData?.config as Record<string, unknown>) ?? {}
  const canalTelegram: CanalTelegramPublico = canalData
    ? {
        id:          canalData.id,
        activo:      canalData.activo,
        webhook_url: canalData.webhook_url ?? null,
        bot_url:     (configData.bot_url as string | undefined) ?? null,
        tiene_token: !!configData.bot_token,
        updated_at:  canalData.updated_at,
      }
    : null

  return (
    <AjustesClient
      clinica={clinica}
      servicios={serviciosRes.data ?? []}
      canalTelegram={canalTelegram}
    />
  )
}
