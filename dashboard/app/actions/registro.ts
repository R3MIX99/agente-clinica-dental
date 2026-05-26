"use server"

import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export type DatosRegistro = {
  nombre: string
  email: string
  password: string
  telefono: string
  clinicaNombre: string
  clinicaTelefono: string
  clinicaEmail: string
  clinicaDireccion: string
  zonaHoraria: string
  planId: string
}

// Registra una nueva cuenta, crea la primera clinica y deja al usuario
// como administrador con una suscripcion en estado de prueba (14 dias).
// El alta de la cuenta de Supabase Auth la realiza el propio usuario
// a traves del formulario de registro — no se crea por terceros.
export async function registrarCuenta(
  datos: DatosRegistro
): Promise<{ error?: string; confirmacionPendiente?: boolean }> {
  const authClient = await createAuthClient()

  // 1. Crear usuario en Supabase Auth
  const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
    email: datos.email.trim().toLowerCase(),
    password: datos.password,
    options: {
      data: {
        nombre: datos.nombre.trim(),
        rol: "administrador",
      },
      // Redirigir al callback de confirmacion que apunta al onboarding
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/auth/callback?next=/onboarding`,
    },
  })

  if (signUpError) {
    if (
      signUpError.message.toLowerCase().includes("already registered") ||
      signUpError.message.toLowerCase().includes("already exists")
    ) {
      return { error: "Ya existe una cuenta con ese correo electronico." }
    }
    return { error: "Error al crear la cuenta. Intentalo de nuevo." }
  }

  const userId = signUpData.user?.id
  if (!userId) {
    return { error: "Error al crear la cuenta. Intentalo de nuevo." }
  }

  const db = createServerClient() // service_role para operaciones de BD

  // 2. Crear cuenta (empresa)
  const { data: cuenta, error: errCuenta } = await db
    .from("cuentas")
    .insert({
      nombre: datos.clinicaNombre.trim(),
      email_contacto: datos.email.trim().toLowerCase(),
    })
    .select("id")
    .single()

  if (errCuenta || !cuenta) {
    return { error: "Error al crear la cuenta. Intentalo de nuevo." }
  }

  // 3. Crear primera clinica
  const { data: clinica, error: errClinica } = await db
    .from("clinicas")
    .insert({
      cuenta_id: cuenta.id,
      nombre: datos.clinicaNombre.trim(),
      telefono: datos.clinicaTelefono.trim() || null,
      email: datos.clinicaEmail.trim().toLowerCase() || null,
      direccion: datos.clinicaDireccion.trim() || null,
      zona_horaria: datos.zonaHoraria,
      activa: true,
      onboarding_completado: false,
    } as any)
    .select("id")
    .single()

  if (errClinica || !clinica) {
    await db.from("cuentas").delete().eq("id", cuenta.id)
    return { error: "Error al crear la clinica. Intentalo de nuevo." }
  }

  // 4. Actualizar perfil (el trigger ya lo creo, solo completamos los campos de tenant)
  await db
    .from("profiles")
    .update({
      nombre: datos.nombre.trim(),
      rol: "administrador",
      clinica_id: clinica.id,
      cuenta_id: cuenta.id,
    } as any)
    .eq("id", userId)

  // 5. Crear membresia
  await db.from("membresias").insert({
    user_id: userId,
    clinica_id: clinica.id,
    cuenta_id: cuenta.id,
    rol: "administrador",
    activa: true,
  } as any)

  // 6. Crear suscripcion en estado de prueba (14 dias)
  const inicio = new Date()
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + 14)

  await db.from("suscripciones").insert({
    cuenta_id: cuenta.id,
    plan_id: datos.planId,
    estado: "prueba",
    periodo: "mensual",
    inicio_periodo: inicio.toISOString().split("T")[0],
    fin_periodo: fin.toISOString().split("T")[0],
  } as any)

  // 7. Si hay sesion inmediata (sin confirmacion de correo), establecer cookie y redirigir
  if (signUpData.session) {
    const cookieStore = await cookies()
    cookieStore.set("clinica_activa", clinica.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === "production",
    })
    redirect("/onboarding")
  }

  // Sin sesion: se requiere confirmacion de correo electronico
  return { confirmacionPendiente: true }
}
