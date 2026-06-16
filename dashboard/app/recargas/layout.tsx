import { redirect } from "next/navigation"
import { createAuthClient } from "@/lib/supabase/server-auth"

// Solo accesible para usuarios con rol superadmin en sus metadatos de Auth.
// Esta pagina la usa el administrador del sistema (no las clinicas)
// para registrar las recargas de saldo IA que va vendiendo manualmente.
export default async function RecargasLayout({ children }: { children: React.ReactNode }) {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) redirect("/login")
  if (user.user_metadata?.rol !== "superadmin") redirect("/login")

  return <>{children}</>
}
