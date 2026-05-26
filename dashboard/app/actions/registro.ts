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
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/auth/callback?next=/onboarding`,
    },
  })

  // Clasificar el error de signUp
  if (signUpError) {
    const msg = signUpError.message.toLowerCase()
    const code = (signUpError as any).code ?? ""

    if (msg.includes("already registered") || msg.includes("already exists")) {
      return { error: "Ya existe una cuenta con ese correo electronico. Intenta iniciar sesion." }
    }

    // Rate limit de correos: el usuario YA existe en Auth pero los registros de BD
    // pueden no haberse creado (si una sesion anterior fallo). Continuamos con el
    // userId que Supabase devuelve aunque el correo de confirmacion no se haya reenviado.
    const esRateLimit =
      code === "over_email_send_rate_limit" ||
      msg.includes("rate limit") ||
      msg.includes("only request this after")

    if (esRateLimit && signUpData?.user) {
      // Seguir adelante — el userId esta disponible; manejar abajo
    } else if (esRateLimit) {
      return {
        error:
          "Ese correo ya tiene un registro pendiente de confirmacion. Revisa tu bandeja de entrada o espera unos minutos para volver a intentarlo.",
      }
    } else {
      return { error: "Error al crear la cuenta. Intentalo de nuevo." }
    }
  }

  const userId = signUpData?.user?.id
  if (!userId) {
    return { error: "Error al crear la cuenta. Intentalo de nuevo." }
  }

  const db = createServerClient() // service_role — bypasses RLS

  // Verificar si el usuario ya tiene clinica_id asignado (registro previo parcial)
  const { data: perfilExistente } = await db
    .from("profiles")
    .select("clinica_id, cuenta_id")
    .eq("id", userId)
    .single()

  if (perfilExistente?.clinica_id) {
    // Los registros de BD ya existen desde un intento anterior —
    // solo indicar que se requiere confirmacion de correo
    return { confirmacionPendiente: true }
  }

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

  // 4. Actualizar perfil (el trigger ya lo creo al hacer signUp)
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

  // 6. Crear suscripcion en estado de prueba (14 dias) con saldo de IA incluido del plan
  const inicio = new Date()
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + 14)

  // Obtener el saldo incluido del plan seleccionado
  const { data: planSeleccionado } = await db
    .from("planes")
    .select("saldo_ia_incluido_mxn")
    .eq("id", datos.planId)
    .single()

  await db.from("suscripciones").insert({
    cuenta_id: cuenta.id,
    plan_id: datos.planId,
    estado: "prueba",
    periodo: "mensual",
    inicio_periodo: inicio.toISOString().split("T")[0],
    fin_periodo: fin.toISOString().split("T")[0],
    saldo_ia_disponible_mxn: planSeleccionado?.saldo_ia_incluido_mxn ?? 0,
  } as any)

  // 7. Sesion inmediata (email confirmation desactivado) → cookie + redirect
  if (signUpData?.session) {
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

  // Sin sesion: correo de confirmacion pendiente
  return { confirmacionPendiente: true }
}
