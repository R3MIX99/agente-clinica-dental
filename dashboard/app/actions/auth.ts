"use server"

import { createAuthClient } from "@/lib/supabase/server-auth"
import { redirect } from "next/navigation"

export async function loginAction(email: string, password: string): Promise<{ error: string } | never> {
  const supabase = await createAuthClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: "Credenciales incorrectas. Verifica tu email y contrasena." }
  }

  redirect("/conversaciones")
}

export async function logoutAction() {
  const supabase = await createAuthClient()
  await supabase.auth.signOut()
  redirect("/login")
}
