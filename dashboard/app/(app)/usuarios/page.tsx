import { redirect } from "next/navigation"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import type { PerfilUsuario } from "./actions"
import { UsuariosClient } from "./UsuariosClient"

export const metadata = { title: "Usuarios — Clinica Dental" }

export default async function UsuariosPage() {
  // getSession() lee el JWT del cookie sin llamada de red al servidor de Auth.
  // El middleware ya valido el token antes de llegar aqui, por lo que es seguro.
  const authClient = await createAuthClient()
  const { data: { session } } = await authClient.auth.getSession()

  if (!session?.user) redirect("/login")

  const db = createServerClient()

  // Los tres queries corren en paralelo: perfil actual + lista de usuarios + doctores
  const [{ data: perfilData }, { data: perfilesData }, { data: doctoresData }] =
    await Promise.all([
      authClient
        .from("profiles")
        .select("id, nombre, rol, doctor_id")
        .eq("id", session.user.id)
        .single(),
      db
        .from("profiles")
        .select("id, nombre, email, rol, activo, doctor_id, doctors(nombre, email)")
        .order("nombre"),
      db.from("doctors").select("id, nombre").order("nombre"),
    ])

  if (!perfilData || perfilData.rol === "doctor") redirect("/conversaciones")

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

  const doctores = (doctoresData ?? []).map((d) => ({
    id: d.id,
    nombre: d.nombre,
  }))

  return (
    <UsuariosClient
      usuarios={usuarios}
      doctores={doctores}
      perfilActual={{ id: perfilData.id, rol: perfilData.rol }}
    />
  )
}
