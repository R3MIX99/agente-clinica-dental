import "server-only"
import { createAuthClient } from "@/lib/supabase/server-auth"
import type { User } from "@supabase/supabase-js"

// Correo unico autorizado como superadmin. Vive en el entorno del servidor,
// nunca en el repo ni en el cliente. Si no esta definido, el acceso queda cerrado.
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() ?? ""

// Resuelve al usuario solo si cumple TODAS las condiciones de superadmin:
//   1. Sesion activa.
//   2. Correo exactamente igual al permitido.
//   3. Correo verificado.
//   4. Autenticado por Google (no por contraseña).
// Devuelve null si no cumple (fail-closed).
export async function obtenerSuperadmin(): Promise<User | null> {
  if (!SUPERADMIN_EMAIL) return null

  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const email = user.email?.trim().toLowerCase()
  if (!email || email !== SUPERADMIN_EMAIL) return null

  const verificado =
    !!user.email_confirmed_at || user.user_metadata?.email_verified === true
  if (!verificado) return null

  const provider = user.app_metadata?.provider
  const providers = user.app_metadata?.providers ?? []
  const esGoogle =
    provider === "google" ||
    (Array.isArray(providers) && providers.includes("google"))
  if (!esGoogle) return null

  return user
}

export async function esSuperadmin(): Promise<boolean> {
  return (await obtenerSuperadmin()) !== null
}

// Candado para usar al inicio de cada server action y pagina del panel.
// Lanza si el solicitante no es el superadmin autorizado.
export async function assertSuperadmin(): Promise<User> {
  const user = await obtenerSuperadmin()
  if (!user) throw new Error("Acceso restringido al superadministrador.")
  return user
}
