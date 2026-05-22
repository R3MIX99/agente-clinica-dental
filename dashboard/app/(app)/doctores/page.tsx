import { createServerClient } from "@/lib/supabase/server"
import { DoctoresClient } from "./DoctoresClient"

export const metadata = { title: "Doctores — Clinica Dental" }

export default async function DoctoresPage() {
  const supabase = createServerClient()

  const { data: doctores } = await supabase
    .from("doctors")
    .select("id, nombre, email, especialidades, fecha_ingreso, created_at")
    .order("nombre")

  return <DoctoresClient doctores={doctores ?? []} />
}
