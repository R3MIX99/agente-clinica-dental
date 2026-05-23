"use server"

import { createServerClient as createServiceClient } from "@/lib/supabase/server"
import { createAuthClient, getProfile } from "@/lib/supabase/server-auth"
import { revalidatePath } from "next/cache"

export type PerfilUsuario = {
  id: string
  nombre: string
  email: string | null
  rol: "administrador" | "supervisor" | "doctor"
  activo: boolean
  doctor_id: string | null
  doctor_nombre: string | null
}

export async function listarUsuarios(): Promise<PerfilUsuario[]> {
  const db = createServiceClient()
  const { data, error } = await db
    .from("profiles")
    .select("id, nombre, email, rol, activo, doctor_id, doctors(nombre)")
    .order("nombre")

  if (error) throw new Error(error.message)

  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    email: p.email,
    rol: p.rol as PerfilUsuario["rol"],
    activo: p.activo,
    doctor_id: p.doctor_id,
    doctor_nombre: (p.doctors as { nombre: string } | null)?.nombre ?? null,
  }))
}

export type DatosUsuario = {
  nombre: string
  email: string
  rol: "administrador" | "supervisor" | "doctor"
  activo: boolean
  doctor_id: string
}

export async function crearUsuario(datos: DatosUsuario): Promise<{ error?: string }> {
  const perfilActual = await getProfile()
  if (!perfilActual || perfilActual.rol === "doctor") {
    return { error: "Sin permisos para crear usuarios" }
  }

  const db = createServiceClient()

  // Crear cuenta en Supabase Auth (envia invitacion por email)
  const { data: authData, error: authError } = await db.auth.admin.inviteUserByEmail(
    datos.email,
    { data: { nombre: datos.nombre, rol: datos.rol } }
  )

  if (authError) {
    if (authError.message.includes("already registered")) {
      return { error: "Ya existe un usuario con ese email" }
    }
    return { error: authError.message }
  }

  // Actualizar perfil creado por el trigger
  const userId = authData.user.id
  const { error: profileError } = await db
    .from("profiles")
    .update({
      nombre: datos.nombre,
      rol: datos.rol,
      activo: datos.activo,
      doctor_id: datos.rol === "doctor" && datos.doctor_id ? datos.doctor_id : null,
      email: datos.email,
    })
    .eq("id", userId)

  if (profileError) return { error: profileError.message }

  revalidatePath("/usuarios")
  return {}
}

export async function editarUsuario(
  id: string,
  datos: DatosUsuario
): Promise<{ error?: string }> {
  const perfilActual = await getProfile()
  if (!perfilActual || perfilActual.rol === "doctor") {
    return { error: "Sin permisos para editar usuarios" }
  }

  const db = createServiceClient()

  // Verificar si el objetivo es administrador (supervisores no pueden editar admins)
  const { data: objetivo } = await db
    .from("profiles")
    .select("rol")
    .eq("id", id)
    .single()

  if (objetivo?.rol === "administrador" && perfilActual.rol === "supervisor") {
    return { error: "Un supervisor no puede editar a un administrador" }
  }

  // Supervisores no pueden cambiar su propio rol — se conserva el rol actual
  const rolFinal =
    perfilActual.rol === "supervisor" && id === perfilActual.id
      ? (objetivo?.rol ?? datos.rol)
      : datos.rol

  // Actualizar perfil
  const { error: profileError } = await db
    .from("profiles")
    .update({
      nombre: datos.nombre,
      rol: rolFinal,
      activo: datos.activo,
      doctor_id: rolFinal === "doctor" && datos.doctor_id ? datos.doctor_id : null,
      email: datos.email,
    })
    .eq("id", id)

  if (profileError) return { error: profileError.message }

  // Actualizar email en auth si cambio
  const { error: authError } = await db.auth.admin.updateUserById(id, {
    email: datos.email,
    user_metadata: { nombre: datos.nombre, rol: rolFinal },
  })

  if (authError) return { error: authError.message }

  revalidatePath("/usuarios")
  return {}
}

export async function eliminarUsuario(id: string): Promise<{ error?: string }> {
  const perfilActual = await getProfile()
  if (!perfilActual) return { error: "Sin sesion activa" }
  if (perfilActual.rol === "doctor") return { error: "Sin permisos para eliminar usuarios" }

  // Verificar si el objetivo es administrador (supervisores no pueden borrar admins)
  const db = createServiceClient()
  const { data: objetivo } = await db
    .from("profiles")
    .select("rol")
    .eq("id", id)
    .single()

  if (
    objetivo?.rol === "administrador" &&
    perfilActual.rol === "supervisor"
  ) {
    return { error: "Un supervisor no puede eliminar a un administrador" }
  }

  // Impedir que el usuario se elimine a si mismo
  if (id === perfilActual.id) {
    return { error: "No puedes eliminar tu propia cuenta" }
  }

  const { error } = await db.auth.admin.deleteUser(id)
  if (error) return { error: error.message }

  revalidatePath("/usuarios")
  return {}
}
