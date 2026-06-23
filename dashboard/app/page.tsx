import { redirect } from "next/navigation"
import { createAuthClient } from "@/lib/supabase/server-auth"

// La raiz no muestra landing publica: el acceso es solo por login.
// Si hay sesion activa, se entra directo al panel; si no, al login.
export default async function RootPage() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (user) redirect("/conversaciones")
  redirect("/login")
}
