import { redirect } from "next/navigation"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import type { PerfilUsuario } from "./actions"
import { UsuariosClient } from "./UsuariosClient"

export const metadata = { title: "Usuarios — Clínica Dental" }

export default async function UsuariosPage() {
  const authClient = await createAuthClient()
  const { data: { session } } = await authClient.auth.getSession()

  if (!session?.user) redirect("/login")

  const db = createServerClient()

  const [{ data: perfilData }, { data: doctoresData }] = await Promise.all([
    authClient
      .from("profiles")
      .select("id, nombre, rol, doctor_id, clinica_id")
      .eq("id", session.user.id)
      .single(),
    db.from("doctors").select("id, nombre").order("nombre"),
  ])

  if (!perfilData || perfilData.rol === "doctor") redirect("/conversaciones")

  const clinicaId = perfilData.clinica_id ?? null

  // Listar perfiles de la misma clinica
  const { data: perfilesData } = clinicaId
    ? await db
        .from("profiles")
        .select("id, nombre, email, rol, activo, doctor_id, doctors(nombre, email)")
        .eq("clinica_id", clinicaId)
        .order("nombre")
    : { data: [] }

  const usuarios: PerfilUsuario[] = (perfilesData ?? []).map((p) => {
    const doctorRec = p.doctors as { nombre: string; email: string | null } | null
    return {
      id: p.id,
      nombre: p.nombre,
      email: p.email,
      rol: p.rol as PerfilUsuario["rol"],
      activo: p.activo,
      doctor_id: p.doctor_id,
      doctor_nombre: doctorRec?.nombre ?? null,
      doctor_email: doctorRec?.email ?? null,
    }
  })

  // Filtrar doctores de la misma clinica
  const doctores = clinicaId
    ? (doctoresData ?? [])
    : []

  return (
    <UsuariosClient
      usuarios={usuarios}
      doctores={doctores.map((d) => ({ id: d.id, nombre: d.nombre }))}
      perfilActual={{ id: perfilData.id, rol: perfilData.rol }}
    />
  )
}
