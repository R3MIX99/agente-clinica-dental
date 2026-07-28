import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"
import { createServerClient as createAdminClient } from "@/lib/supabase/server"

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

// Lanza un error si el usuario autenticado no tiene uno de los roles permitidos.
// Usar en server actions de escritura que deban restringirse (ej. excluir doctor).
export async function requireRol(
  rolesPermitidos: Array<"administrador" | "supervisor" | "doctor">
) {
  const perfil = await getProfile()
  if (!perfil || !rolesPermitidos.includes(perfil.rol as "administrador" | "supervisor" | "doctor")) {
    throw new Error("No tienes permiso para realizar esta accion")
  }
  return perfil
}

// Obtener todas las membresias activas del usuario con datos de la clinica
export async function getMemberships(userId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from("membresias")
    .select("clinica_id, rol, clinicas(id, nombre)")
    .eq("user_id", userId)
    .eq("activa", true)
    .order("created_at")
  return data ?? []
}

// Resolver el clinica_id activo para el usuario autenticado.
// Orden de precedencia:
//   1. Cookie "clinica_activa" validada contra membresias
//   2. Primera membresia activa (por fecha de creacion)
//   3. profiles.clinica_id (campo desnormalizado, fallback de compatibilidad)
//   4. Error si no hay clinica disponible
export async function resolverClinicaId(): Promise<string> {
  const cookieStore = await cookies()
  const cookieClinica = cookieStore.get("clinica_activa")?.value

  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error("Sin sesion activa")

  const db = createAdminClient()

  // 1. Cookie validada contra membresias (previene suplantacion via cookie manual)
  if (cookieClinica) {
    const { data } = await db
      .from("membresias")
      .select("clinica_id")
      .eq("user_id", user.id)
      .eq("clinica_id", cookieClinica)
      .eq("activa", true)
      .maybeSingle()
    if (data?.clinica_id) return data.clinica_id
  }

  // 2. Primera membresia activa por orden de creacion
  const { data: primera } = await db
    .from("membresias")
    .select("clinica_id")
    .eq("user_id", user.id)
    .eq("activa", true)
    .order("created_at")
    .limit(1)
    .maybeSingle()
  if (primera?.clinica_id) return primera.clinica_id

  // 3. Campo desnormalizado en profiles (compatibilidad con usuarios pre-S1)
  const { data: perfil } = await db
    .from("profiles")
    .select("clinica_id")
    .eq("id", user.id)
    .single()
  if (perfil?.clinica_id) return perfil.clinica_id

  throw new Error("Sin clinica activa. Por favor, contacte al administrador.")
}
