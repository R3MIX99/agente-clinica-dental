import { redirect } from "next/navigation"
import { getProfile } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import type { PerfilUsuario } from "./actions"
import { UsuariosClient } from "./UsuariosClient"

export const metadata = { title: "Usuarios — Clinica Dental" }

export default async function UsuariosPage() {
  const perfil = await getProfile()

  if (!perfil) redirect("/login")
  if (perfil.rol === "doctor") redirect("/conversaciones")

  const db = createServerClient()

  const [{ data: perfilesData }, { data: doctoresData }] = await Promise.all([
    db
      .from("profiles")
      .select("id, nombre, email, rol, activo, doctor_id, doctors(nombre)")
      .order("nombre"),
    db.from("doctors").select("id, nombre").order("nombre"),
  ])

  const usuarios: PerfilUsuario[] = (perfilesData ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    email: p.email,
    rol: p.rol as PerfilUsuario["rol"],
    activo: p.activo,
    doctor_id: p.doctor_id,
    doctor_nombre: (p.doctors as { nombre: string } | null)?.nombre ?? null,
  }))

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
