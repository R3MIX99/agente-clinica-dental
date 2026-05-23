import { redirect } from "next/navigation"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import { DoctoresClient } from "./DoctoresClient"

export const metadata = { title: "Doctores — Clinica Dental" }

export default async function DoctoresPage() {
  const authClient = await createAuthClient()
  const { data: { session } } = await authClient.auth.getSession()
  if (!session?.user) redirect("/login")

  // Si es doctor, redirigir a su propia ficha
  const { data: perfil } = await authClient
    .from("profiles")
    .select("rol, doctor_id")
    .eq("id", session.user.id)
    .single()

  if (perfil?.rol === "doctor") {
    if (perfil.doctor_id) {
      redirect(`/doctores/${perfil.doctor_id}`)
    }
    // Doctor sin ficha vinculada — redirigir a citas
    redirect("/citas")
  }

  const db = createServerClient()
  const { data: doctores } = await db
    .from("doctors")
    .select("id, nombre, email, especialidades, fecha_ingreso, created_at")
    .order("nombre")

  return <DoctoresClient doctores={doctores ?? []} />
}
