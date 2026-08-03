"use server"

import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import { passwordTemporalExpirada } from "@/lib/auth/password-temporal"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function loginAction(email: string, password: string): Promise<{ error: string } | never> {
  const supabase = await createAuthClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: "Credenciales incorrectas. Verifica tu correo y contraseña." }
  }

  const userId = data.user?.id
  const rol = data.user?.user_metadata?.rol
  const passwordTemporal = data.user?.user_metadata?.password_temporal === true
  const passwordTemporalCreadaAt = data.user?.user_metadata?.password_temporal_creada_at as
    | string
    | undefined

  // Contraseña temporal vencida (mas de 3 dias sin cambiarla): se rechaza el
  // acceso y se pide una nueva al administrador, en vez de dejarla vigente
  // indefinidamente.
  if (passwordTemporal && passwordTemporalExpirada(passwordTemporalCreadaAt)) {
    await supabase.auth.signOut()
    return { error: "Tu contraseña temporal expiró. Solicita una nueva a tu administrador." }
  }

  // Las cuentas las configura el administrador del sistema antes de
  // entregar credenciales a la clinica. Aquí solo establecemos la
  // cookie de clinica activa para que el dashboard la reconozca.
  if (userId) {
    const db = createServerClient()
    const { data: perfil } = await db
      .from("profiles")
      .select("clinica_id")
      .eq("id", userId)
      .single()

    if (perfil?.clinica_id) {
      const cookieStore = await cookies()
      cookieStore.set("clinica_activa", perfil.clinica_id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        secure: process.env.NODE_ENV === "production",
      })
    }
  }

  // Si la contraseña es la temporal generada por el administrador,
  // redirigir a perfil para que el usuario la cambie antes de continuar.
  if (passwordTemporal) {
    redirect("/perfil")
  }

  // Ir al panel segun rol
  redirect(rol === "doctor" ? "/citas" : "/conversaciones")
}

export async function logoutAction() {
  const supabase = await createAuthClient()
  await supabase.auth.signOut()

  // Limpiar cookie de clinica activa
  const cookieStore = await cookies()
  cookieStore.delete("clinica_activa")

  redirect("/login")
}
