"use server"

import { cookies } from "next/headers"
import { createServerClient } from "@/lib/supabase/server"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { redirect } from "next/navigation"

// Cambia la clinica activa del usuario.
// Válida que el usuario tenga membresia activa en la clinica solicitada
// antes de escribir la cookie — previene suplantacion de tenant.
export async function cambiarClinicaActiva(clinicaId: string) {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) throw new Error("Sin sesión activa")

  const db = createServerClient()
  const { data } = await db
    .from("membresias")
    .select("clinica_id")
    .eq("user_id", user.id)
    .eq("clinica_id", clinicaId)
    .eq("activa", true)
    .maybeSingle()

  if (!data?.clinica_id) {
    throw new Error("No tienes acceso a esa clinica")
  }

  const cookieStore = await cookies()
  cookieStore.set("clinica_activa", clinicaId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 días
    secure: process.env.NODE_ENV === "production",
  })

  redirect("/conversaciones")
}
