"use server"

import { createServerClient } from "@/lib/supabase/server"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { resolverClinicaId } from "@/lib/supabase/server-auth"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

// ---------------------------------------------------------------------------
// Paso 1 — Completar datos de la clinica
// ---------------------------------------------------------------------------

export type DatosClinicaOnboarding = {
  telefono?: string
  email?: string
  direccion?: string
  sitio_web?: string
  horario?: string
}

export async function guardarDatosClinica(datos: DatosClinicaOnboarding) {
  const clinicaId = await resolverClinicaId()
  const db = createServerClient()
  const { error } = await db
    .from("clinicas")
    .update({
      telefono: datos.telefono?.trim() || null,
      email: datos.email?.trim().toLowerCase() || null,
      direccion: datos.direccion?.trim() || null,
      sitio_web: datos.sitio_web?.trim() || null,
      horario: datos.horario?.trim() || null,
    } as any)
    .eq("id", clinicaId)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Paso 3 — Primeros servicios
// ---------------------------------------------------------------------------

export type DatosServicio = {
  nombre: string
  precio: string
  duracion_min: string
}

export async function guardarServicios(servicios: DatosServicio[]) {
  const clinicaId = await resolverClinicaId()
  const db = createServerClient()
  const registros = servicios
    .filter((s) => s.nombre.trim())
    .map((s) => ({
      clinica_id: clinicaId,
      nombre: s.nombre.trim(),
      precio: s.precio ? Number(s.precio) : 0,
      duracion_min: s.duracion_min ? Number(s.duracion_min) : 30,
      activo: true,
    }))
  if (registros.length === 0) return
  const { error } = await db.from("services").insert(registros as any)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Paso 4 — FAQ del agente
// ---------------------------------------------------------------------------

export async function guardarFAQ(faq: string) {
  const clinicaId = await resolverClinicaId()
  const db = createServerClient()
  const { error } = await db
    .from("clinicas")
    .update({ faq: faq.trim() || null } as any)
    .eq("id", clinicaId)
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Paso 5 — Invitar equipo
// ---------------------------------------------------------------------------

export type DatosMiembro = {
  nombre: string
  email: string
  rol: "doctor" | "supervisor"
}

export async function invitarMiembros(miembros: DatosMiembro[]) {
  if (miembros.length === 0) return

  const clinicaId = await resolverClinicaId()
  const db = createServerClient()

  // Obtener cuenta_id de la clinica
  const { data: clinica } = await db
    .from("clinicas")
    .select("cuenta_id")
    .eq("id", clinicaId)
    .single()
  if (!clinica) throw new Error("Clinica no encontrada")

  for (const miembro of miembros) {
    const emailLimpio = miembro.email.trim().toLowerCase()
    if (!emailLimpio) continue

    // Invitar via Supabase Auth (envia correo con enlace de acceso)
    const { data: invitado, error: errInvite } = await db.auth.admin.inviteUserByEmail(
      emailLimpio,
      {
        data: {
          nombre: miembro.nombre.trim(),
          rol: miembro.rol,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/auth/callback?next=/conversaciones`,
      }
    )

    if (errInvite || !invitado?.user) continue

    const userId = invitado.user.id

    // Actualizar perfil con nombre y contexto de tenant
    await db
      .from("profiles")
      .update({
        nombre: miembro.nombre.trim(),
        rol: miembro.rol,
        clinica_id: clinicaId,
        cuenta_id: clinica.cuenta_id,
      } as any)
      .eq("id", userId)

    // Crear membresia
    await db.from("membresias").insert({
      user_id: userId,
      clinica_id: clinicaId,
      cuenta_id: clinica.cuenta_id,
      rol: miembro.rol,
      activa: true,
    } as any)
  }
}

// ---------------------------------------------------------------------------
// Finalizar onboarding
// ---------------------------------------------------------------------------

export async function completarOnboarding() {
  const clinicaId = await resolverClinicaId()
  const db = createServerClient()
  await db
    .from("clinicas")
    .update({ onboarding_completado: true } as any)
    .eq("id", clinicaId)
  revalidatePath("/onboarding")
  redirect("/conversaciones")
}
