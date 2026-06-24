"use server"

import { createServerClient } from "@/lib/supabase/server"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { resolverClinicaId } from "@/lib/supabase/server-auth"
import { verificarLimiteDoctores, verificarLimiteUsuarios } from "@/app/actions/uso"
import { conectarTelegramBot } from "@/lib/telegram"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

// ---------------------------------------------------------------------------
// Progreso del wizard — se guarda el paso para poder reanudar
// ---------------------------------------------------------------------------

export async function guardarProgreso(paso: number) {
  const clinicaId = await resolverClinicaId()
  const db = createServerClient()
  await db.from("clinicas").update({ onboarding_paso: paso } as never).eq("id", clinicaId)
}

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
  if (!clinica) throw new Error("Clínica no encontrada")

  // Enforcement de limites del plan (validación servidor)
  const doctoresNuevos  = miembros.filter((m) => m.rol === "doctor" && m.email.trim())
  const usuariosNuevos  = miembros.filter((m) => m.rol !== "doctor" && m.email.trim())

  if (doctoresNuevos.length > 0) {
    const limite = await verificarLimiteDoctores()
    if (!limite.permitido) throw new Error(limite.mensaje ?? "Limite de doctores alcanzado")
  }
  if (usuariosNuevos.length > 0) {
    const limite = await verificarLimiteUsuarios()
    if (!limite.permitido) throw new Error(limite.mensaje ?? "Limite de usuarios alcanzado")
  }

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

// Paso final obligatorio: conectar el bot de Telegram. Solo cuando el bot queda
// conectado se marca el onboarding como completado. No se puede omitir.
export async function conectarTelegramOnboarding(
  botToken: string,
): Promise<{ ok: boolean; error?: string; botUsername?: string | null }> {
  const clinicaId = await resolverClinicaId()
  const resultado = await conectarTelegramBot(clinicaId, botToken)
  if (!resultado.ok) return resultado

  const db = createServerClient()
  await db
    .from("clinicas")
    .update({ onboarding_completado: true, onboarding_paso: 6 } as never)
    .eq("id", clinicaId)
  revalidatePath("/onboarding")
  return resultado
}
