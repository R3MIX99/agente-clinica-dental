import { redirect } from "next/navigation"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import { AjustesClient } from "./AjustesClient"

export const metadata = { title: "Ajustes — Clinica Dental" }

export default async function AjustesPage() {
  const authClient = await createAuthClient()
  const { data: { session } } = await authClient.auth.getSession()
  if (!session?.user) redirect("/login")

  // Obtener clinica_id del perfil del usuario
  const { data: perfil } = await authClient
    .from("profiles")
    .select("clinica_id")
    .eq("id", session.user.id)
    .single()

  const clinicaId = perfil?.clinica_id

  type FaqItem = { pregunta: string; respuesta: string }

  if (!clinicaId) {
    return <AjustesClient clinica={null} />
  }

  const db = createServerClient()
  const { data } = await db
    .from("clinicas")
    .select(
      "nombre, direccion, telefono, email, sitio_web, horario, formas_pago, facturacion, mapa_url, faq"
    )
    .eq("id", clinicaId)
    .single()

  const clinica = data
    ? {
        ...data,
        faq: data.faq as FaqItem[] | null,
      }
    : null

  return <AjustesClient clinica={clinica} />
}
