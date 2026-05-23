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

  return <AppLayoutClient rol={rol}>{children}</AppLayoutClient>
}
