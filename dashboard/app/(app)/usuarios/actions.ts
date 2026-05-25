"use server"

import { createServerClient as createServiceClient } from "@/lib/supabase/server"
import { getProfile } from "@/lib/supabase/server-auth"
import { revalidatePath } from "next/cache"

export type PerfilUsuario = {
  id: string
  nombre: string
  email: string | null
  rol: "administrador" | "supervisor" | "doctor"
  activo: boolean
  doctor_id: string | null
  doctor_nombre: string | null
  // Correo del registro en doctors — es el que se muestra para usuarios con rol doctor
  doctor_email: string | null
}

export type DatosUsuario = {
  nombre: string
  email: string
  rol: "administrador" | "supervisor" | "doctor"
  activo: boolean
  doctor_id: string
}

// Resuelve el nombre que tendra el perfil: si es doctor vinculado, usa el nombre del doctor.
async function resolverNombrePerfil(
  db: ReturnType<typeof createServiceClient>,
  datos: DatosUsuario
): Promise<string> {
  if (datos.rol === "doctor" && datos.doctor_id) {
    const { data } = await db
      .from("doctors")
      .select("nombre")
      .eq("id", datos.doctor_id)
      .single()
    if (data?.nombre) return data.nombre
  }
  return datos.nombre
}

export async function crearUsuario(datos: DatosUsuario): Promise<{ error?: string }> {
  const perfilActual = await getProfile()
  if (!perfilActual || perfilActual.rol === "doctor") {
    return { error: "Sin permisos para crear usuarios" }
  }

  const db = createServiceClient()

  // Si es doctor vinculado, el nombre viene del registro del doctor
  const nombreFinal = await resolverNombrePerfil(db, datos)

  // Crear cuenta en Supabase Auth (envia invitacion por email)
  const { data: authData, error: authError } = await db.auth.admin.inviteUserByEmail(
    datos.email,
    { data: { nombre: nombreFinal, rol: datos.rol } }
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
      nombre: nombreFinal,
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
  // Se incluye doctor_id para preservarlo al editar (el campo ya no se muestra en el form)
  const { data: objetivo } = await db
    .from("profiles")
    .select("rol, doctor_id")
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

  // El doctor_id se preserva desde la BD; el formulario ya no lo envia
  const doctorIdFinal =
    rolFinal === "doctor"
      ? (datos.doctor_id || objetivo?.doctor_id || null)
      : null

  // Si es doctor vinculado, el nombre viene del registro del doctor
  const nombreFinal = await resolverNombrePerfil(db, {
    ...datos,
    rol: rolFinal,
    doctor_id: doctorIdFinal ?? "",
  })

  // Actualizar perfil — email solo se toca para no-doctores (campo bloqueado en UI)
  const { error: profileError } = rolFinal === "doctor"
    ? await db
        .from("profiles")
        .update({ nombre: nombreFinal, rol: rolFinal, activo: datos.activo, doctor_id: doctorIdFinal })
        .eq("id", id)
    : await db
        .from("profiles")
        .update({ nombre: nombreFinal, rol: rolFinal, activo: datos.activo, doctor_id: doctorIdFinal, email: datos.email })
        .eq("id", id)

  if (profileError) return { error: profileError.message }

  // Actualizar metadata en auth; email solo para no-doctores
  const { error: authError } = rolFinal === "doctor"
    ? await db.auth.admin.updateUserById(id, {
        user_metadata: { nombre: nombreFinal, rol: rolFinal },
      })
    : await db.auth.admin.updateUserById(id, {
        email: datos.email,
        user_metadata: { nombre: nombreFinal, rol: rolFinal },
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
