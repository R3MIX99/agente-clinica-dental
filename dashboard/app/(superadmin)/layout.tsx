import { redirect } from "next/navigation"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { SuperadminLayoutClient } from "./SuperadminLayoutClient"

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  // Doble check: sesion activa y rol superadmin en metadatos de auth
  if (!user) redirect("/login")
  if (user.user_metadata?.rol !== "superadmin") redirect("/login")

  return <SuperadminLayoutClient>{children}</SuperadminLayoutClient>
}
