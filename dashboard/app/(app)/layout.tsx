import { cookies } from "next/headers"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import { AppLayoutClient } from "./AppLayoutClient"
import type { ClinicaBasica } from "@/components/clinica-selector"

export type Rol = "administrador" | "supervisor" | "doctor"
export type { ClinicaBasica }

const ROLES_VALIDOS: Rol[] = ["administrador", "supervisor", "doctor"]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  const cookieStore = await cookies()
  const clinicaCookie = cookieStore.get("clinica_activa")?.value

  let clinicas: ClinicaBasica[] = []
  let clinicaActual: ClinicaBasica = { id: "", nombre: "Clinica Dental" }
  let rol: Rol = "supervisor"
  let doctorId: string | null = null

  if (user) {
    const db = createServerClient()

    // Obtener todas las membresias activas con nombre de clinica
    const { data: membresias } = await db
      .from("membresias")
      .select("clinica_id, rol, clinicas(id, nombre)")
      .eq("user_id", user.id)
      .eq("activa", true)
      .order("created_at")

    clinicas = (membresias ?? [])
      .filter((m) => m.clinica_id != null && m.clinicas != null)
      .map((m) => {
        const c = m.clinicas as { id: string; nombre: string | null } | null
        return {
          id: m.clinica_id as string,
          nombre: c?.nombre ?? "Clinica Dental",
        }
      })

    // Clinica activa: cookie validada > primera membresia
    const clinicaDeCookie = clinicas.find((c) => c.id === clinicaCookie)
    clinicaActual = clinicaDeCookie ?? clinicas[0] ?? clinicaActual

    // Rol desde la membresia de la clinica activa (no del JWT)
    const membresiaActiva = (membresias ?? []).find(
      (m) => m.clinica_id === clinicaActual.id
    )
    const rolRaw = membresiaActiva?.rol ?? user.user_metadata?.rol
    rol = ROLES_VALIDOS.includes(rolRaw) ? (rolRaw as Rol) : "supervisor"

    // Para doctores: doctor_id necesario para el enlace de la ficha
    if (rol === "doctor") {
      const { data } = await db
        .from("profiles")
        .select("doctor_id")
        .eq("id", user.id)
        .single()
      doctorId = data?.doctor_id ?? null
    }
  }

  return (
    <AppLayoutClient
      rol={rol}
      doctorId={doctorId}
      clinicaActual={clinicaActual}
      clinicas={clinicas}
    >
      {children}
    </AppLayoutClient>
  )
}
