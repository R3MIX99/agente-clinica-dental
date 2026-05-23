import { createAuthClient } from "@/lib/supabase/server-auth"
import { AppLayoutClient } from "./AppLayoutClient"

export type Rol = "administrador" | "supervisor" | "doctor"

const ROLES_VALIDOS: Rol[] = ["administrador", "supervisor", "doctor"]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const authClient = await createAuthClient()
  const { data: { session } } = await authClient.auth.getSession()

  // El rol se lee del JWT — no requiere llamada a la base de datos.
  // El middleware ya valido el token en cada request, por lo que el JWT es confiable para la UI.
  const rolRaw = session?.user?.user_metadata?.rol
  const rol: Rol = ROLES_VALIDOS.includes(rolRaw) ? (rolRaw as Rol) : "supervisor"

  // Para doctores: obtener doctor_id desde profiles.
  // No esta en el JWT (user_metadata), asi que requiere una consulta a la BD.
  // Se usa para que el enlace "Mi ficha" apunte directamente a /doctores/[id]
  // y evitar el redirect intermitente en Vercel durante navegacion RSC.
  let doctorId: string | null = null
  if (rol === "doctor" && session?.user?.id) {
    const { data } = await authClient
      .from("profiles")
      .select("doctor_id")
      .eq("id", session.user.id)
      .single()
    doctorId = data?.doctor_id ?? null
  }

  return <AppLayoutClient rol={rol} doctorId={doctorId}>{children}</AppLayoutClient>
}
