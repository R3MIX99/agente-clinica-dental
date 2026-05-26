"use server"

import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function loginAction(email: string, password: string): Promise<{ error: string } | never> {
  const supabase = await createAuthClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: "Credenciales incorrectas. Verifica tu correo y contrasena." }
  }

  const userId = data.user?.id
  const rol = data.user?.user_metadata?.rol

  // Verificar si la clinica del usuario ya completo el onboarding
  if (userId) {
    const db = createServerClient()
    const { data: perfil } = await db
      .from("profiles")
      .select("clinica_id")
      .eq("id", userId)
      .single()

    if (perfil?.clinica_id) {
      // Establecer la cookie de clinica activa
      const cookieStore = await cookies()
      cookieStore.set("clinica_activa", perfil.clinica_id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        secure: process.env.NODE_ENV === "production",
      })

      // Si el onboarding no esta completado, redirigir al wizard
      const { data: clinica } = await db
        .from("clinicas")
        .select("onboarding_completado")
        .eq("id", perfil.clinica_id)
        .single()

      if (!clinica?.onboarding_completado) {
        redirect("/onboarding")
      }
    }
  }

  // Onboarding completado: ir al panel segun rol
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
