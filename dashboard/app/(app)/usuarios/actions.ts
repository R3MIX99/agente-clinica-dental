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
  doctor_email: string | null
}

export type DatosUsuario = {
  nombre: string
  email: string
  rol: "administrador" | "supervisor" | "doctor"
  activo: boolean
  doctor_id: string
}

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

  const clinicaId = perfilActual.clinica_id
  const cuentaId = perfilActual.cuenta_id
  if (!clinicaId || !cuentaId) {
    return { error: "Sin clinica activa" }
  }

  const db = createServiceClient()
  const nombreFinal = await resolverNombrePerfil(db, datos)

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

  const userId = authData.user.id

  // Actualizar perfil creado por el trigger con clinica_id y cuenta_id
  const { error: profileError } = await db
    .from("profiles")
    .update({
      nombre: nombreFinal,
      rol: datos.rol,
      activo: datos.activo,
      doctor_id: datos.rol === "doctor" && datos.doctor_id ? datos.doctor_id : null,
      email: datos.email,
      clinica_id: clinicaId,
      cuenta_id: cuentaId,
    })
    .eq("id", userId)

  if (profileError) return { error: profileError.message }

  // Crear membresia para el nuevo usuario
  const { error: memError } = await db
    .from("membresias")
    .insert({
      user_id: userId,
      cuenta_id: cuentaId,
      clinica_id: clinicaId,
      rol: datos.rol,
      activa: datos.activo,
    })

  if (memError && !memError.message.includes("duplicate")) {
    return { error: memError.message }
  }

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

  const { data: objetivo } = await db
    .from("profiles")
    .select("rol, doctor_id")
    .eq("id", id)
    .single()

  if (objetivo?.rol === "administrador" && perfilActual.rol === "supervisor") {
    return { error: "Un supervisor no puede editar a un administrador" }
  }

  const rolFinal =
    perfilActual.rol === "supervisor" && id === perfilActual.id
      ? (objetivo?.rol ?? datos.rol)
      : datos.rol

  const doctorIdFinal =
    rolFinal === "doctor"
      ? (datos.doctor_id || objetivo?.doctor_id || null)
      : null

  const nombreFinal = await resolverNombrePerfil(db, {
    ...datos,
    rol: rolFinal,
    doctor_id: doctorIdFinal ?? "",
  })

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

  const { error: authError } = rolFinal === "doctor"
    ? await db.auth.admin.updateUserById(id, {
        user_metadata: { nombre: nombreFinal, rol: rolFinal },
      })
    : await db.auth.admin.updateUserById(id, {
        email: datos.email,
        user_metadata: { nombre: nombreFinal, rol: rolFinal },
      })

  if (authError) return { error: authError.message }

  // Sincronizar rol en membresia
  if (perfilActual.clinica_id) {
    await db
      .from("membresias")
      .update({ rol: rolFinal, activa: datos.activo })
      .eq("user_id", id)
      .eq("clinica_id", perfilActual.clinica_id)
  }

  revalidatePath("/usuarios")
  return {}
}

export async function eliminarUsuario(id: string): Promise<{ error?: string }> {
  const perfilActual = await getProfile()
  if (!perfilActual) return { error: "Sin sesion activa" }
  if (perfilActual.rol === "doctor") return { error: "Sin permisos para eliminar usuarios" }

  const db = createServiceClient()
  const { data: objetivo } = await db
    .from("profiles")
    .select("rol")
    .eq("id", id)
    .single()

  if (objetivo?.rol === "administrador" && perfilActual.rol === "supervisor") {
    return { error: "Un supervisor no puede eliminar a un administrador" }
  }

  if (id === perfilActual.id) {
    return { error: "No puedes eliminar tu propia cuenta" }
  }

  const { error } = await db.auth.admin.deleteUser(id)
  if (error) return { error: error.message }

  revalidatePath("/usuarios")
  return {}
}
