import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"

// Cliente de Supabase para server actions y server components — usa la sesion del usuario
export async function createAuthClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Llamado desde un Server Component — el middleware refresca la sesion
          }
        },
      },
    }
  )
}

// Leer el perfil del usuario autenticado actual, incluyendo el contexto de inquilino
export async function getProfile() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("profiles")
    .select("id, nombre, rol, doctor_id, clinica_id, cuenta_id")
    .eq("id", user.id)
    .single()

  return data
}

// Obtener el clinica_id activo del perfil o lanzar error si no esta disponible
// Se usa en Server Actions que necesitan el contexto de inquilino
export async function resolverClinicaId(): Promise<string> {
  const perfil = await getProfile()
  if (!perfil?.clinica_id) {
    throw new Error("Sin clinica activa. Por favor, contacte al administrador.")
  }
  return perfil.clinica_id
}
