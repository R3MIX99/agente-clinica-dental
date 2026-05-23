import { redirect } from "next/navigation"
import { getProfile } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import { listarUsuarios } from "./actions"
import { UsuariosClient } from "./UsuariosClient"

export const metadata = { title: "Usuarios — Clinica Dental" }

export default async function UsuariosPage() {
  const perfil = await getProfile()

  if (!perfil) redirect("/login")
  if (perfil.rol === "doctor") redirect("/conversaciones")

  const db = createServerClient()
  const [usuarios, { data: doctoresData }] = await Promise.all([
    listarUsuarios(),
    db.from("doctors").select("id, nombre").order("nombre"),
  ])

  const doctores = (doctoresData ?? []).map((d) => ({
    id: d.id,
    nombre: d.nombre,
  }))

  return (
    <UsuariosClient
      usuarios={usuarios}
      doctores={doctores}
      perfilActual={{ id: perfil.id, rol: perfil.rol }}
    />
  )
}
