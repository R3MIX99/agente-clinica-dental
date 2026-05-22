import { createServerClient } from "@/lib/supabase/server"
import { AjustesClient } from "./AjustesClient"

export const metadata = { title: "Ajustes — Clinica Dental" }

export default async function AjustesPage() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("clinic_info")
    .select(
      "nombre, direccion, telefono, email, sitio_web, horario, formas_pago, facturacion, mapa_url, faq"
    )
    .limit(1)
    .single()

  type FaqItem = { pregunta: string; respuesta: string }
  const clinica = data
    ? {
        ...data,
        faq: data.faq as FaqItem[] | null,
      }
    : null

  return <AjustesClient clinica={clinica} />
}
