"use server"

import { createServerClient as createServiceClient } from "@/lib/supabase/server"
import { getProfile } from "@/lib/supabase/server-auth"
import { generarPasswordTemporal } from "@/lib/auth/password-temporal"
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

export async function crearUsuario(
  datos: DatosUsuario
): Promise<{ error?: string; password?: string }> {
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

  // Creación directa con contraseña temporal aleatoria (no una fija
  // compartida). El usuario debera cambiarla desde /perfil al iniciar
  // sesión (se le redirige automáticamente cuando password_temporal: true
  // en los metadatos), y vence a los pocos dias si no la cambia.
  const passwordTemporal = generarPasswordTemporal()
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email:         datos.email,
    password:      passwordTemporal,
    email_confirm: true,
    user_metadata: {
      nombre:                      nombreFinal,
      rol:                         datos.rol,
      password_temporal:           true,
      password_temporal_creada_at: new Date().toISOString(),
    },
  })

  if (authError) {
    if (authError.message.toLowerCase().includes("already") || authError.message.toLowerCase().includes("registered")) {
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
  return { password: passwordTemporal }
}

export async function editarUsuario(
  id: string,
  datos: DatosUsuario
): Promise<{ error?: string; password?: string }> {
  const perfilActual = await getProfile()
  if (!perfilActual || perfilActual.rol === "doctor") {
    return { error: "Sin permisos para editar usuarios" }
  }
  if (!perfilActual.clinica_id) {
    return { error: "Sin clinica activa" }
  }

  const db = createServiceClient()

  const { data: objetivo } = await db
    .from("profiles")
    .select("rol, doctor_id, clinica_id")
    .eq("id", id)
    .single()

  if (!objetivo || objetivo.clinica_id !== perfilActual.clinica_id) {
    return { error: "Usuario no encontrado" }
  }

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
        .eq("clinica_id", perfilActual.clinica_id)
    : await db
        .from("profiles")
        .update({ nombre: nombreFinal, rol: rolFinal, activo: datos.activo, doctor_id: doctorIdFinal, email: datos.email })
        .eq("id", id)
        .eq("clinica_id", perfilActual.clinica_id)

  if (profileError) return { error: profileError.message }

  // Preservar flags existentes en los metadatos (ej. password_temporal) en
  // vez de sobreescribirlos, ya que updateUserById reemplaza el objeto entero.
  const { data: usuarioAuth } = await db.auth.admin.getUserById(id)
  const metadataPrevia = usuarioAuth?.user?.user_metadata ?? {}

  const { error: authError } = rolFinal === "doctor"
    ? await db.auth.admin.updateUserById(id, {
        user_metadata: { ...metadataPrevia, nombre: nombreFinal, rol: rolFinal },
      })
    : await db.auth.admin.updateUserById(id, {
        email: datos.email,
        user_metadata: { ...metadataPrevia, nombre: nombreFinal, rol: rolFinal },
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
  if (!perfilActual) return { error: "Sin sesión activa" }
  if (perfilActual.rol === "doctor") return { error: "Sin permisos para eliminar usuarios" }
  if (!perfilActual.clinica_id) return { error: "Sin clinica activa" }

  const db = createServiceClient()
  const { data: objetivo } = await db
    .from("profiles")
    .select("rol, clinica_id")
    .eq("id", id)
    .single()

  if (!objetivo || objetivo.clinica_id !== perfilActual.clinica_id) {
    return { error: "Usuario no encontrado" }
  }

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

// ---------------------------------------------------------------------------
// Resetear contraseña — genera una nueva contraseña temporal aleatoria
// (reemplaza a la anterior) y vuelve a arrancar el plazo de vigencia.
// ---------------------------------------------------------------------------

export async function resetearPasswordUsuario(
  id: string
): Promise<{ error?: string; password?: string }> {
  const perfilActual = await getProfile()
  if (!perfilActual || perfilActual.rol === "doctor") {
    return { error: "Sin permisos para resetear contraseñas" }
  }
  if (!perfilActual.clinica_id) return { error: "Sin clinica activa" }

  const db = createServiceClient()
  const { data: objetivo } = await db
    .from("profiles")
    .select("rol, nombre, clinica_id")
    .eq("id", id)
    .single()

  if (!objetivo || objetivo.clinica_id !== perfilActual.clinica_id) {
    return { error: "Usuario no encontrado" }
  }

  if (objetivo.rol === "administrador" && perfilActual.rol === "supervisor") {
    return { error: "Un supervisor no puede resetear la contraseña de un administrador" }
  }

  const nuevaPassword = generarPasswordTemporal()
  const { error } = await db.auth.admin.updateUserById(id, {
    password: nuevaPassword,
    user_metadata: {
      nombre:                       objetivo.nombre,
      rol:                          objetivo.rol,
      password_temporal:            true,
      password_temporal_creada_at:  new Date().toISOString(),
    },
  })
  if (error) return { error: error.message }

  return { password: nuevaPassword }
}
