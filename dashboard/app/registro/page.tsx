import { createServerClient } from "@/lib/supabase/server"
import { RegistroClient } from "./RegistroClient"

export const metadata = { title: "Crear cuenta — DentalIA" }

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const { plan: planIdParam } = await searchParams

  const db = createServerClient()
  const { data: planes } = await db
    .from("planes")
    .select("id, nombre, precio_mensual_mxn, precio_anual_mxn")
    .eq("activo", true)
    .order("precio_mensual_mxn")

  return (
    <RegistroClient
      planes={planes ?? []}
      planIdInicial={planIdParam ?? null}
    />
  )
}
