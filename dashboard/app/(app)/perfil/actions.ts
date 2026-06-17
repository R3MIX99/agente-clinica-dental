"use server"

import { createServerClient as createServiceClient } from "@/lib/supabase/server"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { revalidatePath } from "next/cache"

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export type PerfilCompleto = {
  id: string
  email: string | null
  nombre: string
  rol: "administrador" | "supervisor" | "doctor"
  clinica_nombre: string | null
  doctor_nombre: string | null
  password_temporal: boolean
}

// ---------------------------------------------------------------------------
// Cargar perfil del usuario autenticado
// ---------------------------------------------------------------------------

export async function obtenerMiPerfil(): Promise<PerfilCompleto | null> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null

  const db = createServiceClient()

  const { data: perfil } = await db
    .from("profiles")
    .select("nombre, rol, clinica_id, doctor_id")
    .eq("id", user.id)
    .single()

  if (!perfil) return null

  const [clinicaRes, doctorRes] = await Promise.all([
    perfil.clinica_id
      ? db.from("clinicas").select("nombre").eq("id", perfil.clinica_id).single()
      : Promise.resolve({ data: null }),
    perfil.doctor_id
      ? db.from("doctors").select("nombre").eq("id", perfil.doctor_id).single()
      : Promise.resolve({ data: null }),
  ])

  return {
    id:                user.id,
    email:             user.email ?? null,
    nombre:            perfil.nombre,
    rol:               perfil.rol,
    clinica_nombre:    clinicaRes.data?.nombre ?? null,
    doctor_nombre:     doctorRes.data?.nombre ?? null,
    password_temporal: user.user_metadata?.password_temporal === true,
  }
}

// ---------------------------------------------------------------------------
// Actualizar datos personales (nombre)
// ---------------------------------------------------------------------------

export async function actualizarMiPerfil(datos: { nombre: string }): Promise<{ ok: boolean; error?: string }> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { ok: false, error: "Sin sesion activa" }

  if (!datos.nombre.trim()) {
    return { ok: false, error: "El nombre no puede estar vacio" }
  }

  const db = createServiceClient()

  const { error: errProfile } = await db
    .from("profiles")
    .update({ nombre: datos.nombre.trim() })
    .eq("id", user.id)
  if (errProfile) return { ok: false, error: errProfile.message }

  // Mantener el nombre tambien en los metadatos de Auth (lo lee la app en
  // varios lugares como el header)
  const { error: errAuth } = await db.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, nombre: datos.nombre.trim() },
  })
  if (errAuth) return { ok: false, error: errAuth.message }

  revalidatePath("/perfil")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Cambiar correo electronico
// Supabase mantiene el correo actual hasta que el usuario confirme el nuevo
// haciendo clic en el enlace que llega al correo nuevo.
// ---------------------------------------------------------------------------

export async function cambiarMiCorreo(nuevoEmail: string): Promise<{ ok: boolean; error?: string; mensaje?: string }> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { ok: false, error: "Sin sesion activa" }

  const email = nuevoEmail.trim().toLowerCase()
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Correo no valido" }
  }
  if (email === user.email?.toLowerCase()) {
    return { ok: false, error: "El correo nuevo es igual al actual" }
  }

  // Usar updateUser de la sesion del usuario para que Supabase envie
  // el correo de confirmacion al nuevo email.
  const { error } = await authClient.auth.updateUser({ email })
  if (error) return { ok: false, error: error.message }

  // Tambien sincronizar la columna email en la tabla profiles (algunas
  // consultas de la app la usan en lugar de auth.email)
  const db = createServiceClient()
  await db.from("profiles").update({ email }).eq("id", user.id)

  revalidatePath("/perfil")
  return {
    ok:      true,
    mensaje: `Se envio un enlace de confirmacion a ${email}. El cambio se completara cuando lo abras.`,
  }
}

// ---------------------------------------------------------------------------
// Cambiar contrasena
// Verifica la contrasena actual reautenticando con signInWithPassword,
// despues aplica la nueva.
// ---------------------------------------------------------------------------

export async function cambiarMiPassword(datos: {
  password_actual: string
  password_nuevo:  string
}): Promise<{ ok: boolean; error?: string }> {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user?.email) return { ok: false, error: "Sin sesion activa" }

  if (datos.password_nuevo.length < 6) {
    return { ok: false, error: "La contrasena nueva debe tener al menos 6 caracteres" }
  }

  // Verificar la contrasena actual reautenticando.
  const { error: errLogin } = await authClient.auth.signInWithPassword({
    email:    user.email,
    password: datos.password_actual,
  })
  if (errLogin) {
    return { ok: false, error: "La contrasena actual no es correcta" }
  }

  // Aplicar la nueva
  const { error } = await authClient.auth.updateUser({ password: datos.password_nuevo })
  if (error) return { ok: false, error: error.message }

  // Quitar flag de password_temporal en los metadatos
  const db = createServiceClient()
  await db.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, password_temporal: false },
  })

  revalidatePath("/perfil")
  return { ok: true }
}
