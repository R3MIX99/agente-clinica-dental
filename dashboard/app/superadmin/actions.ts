"use server"

import { createServerClient } from "@/lib/supabase/server"
import { assertSuperadmin } from "@/lib/auth/superadmin"
import { conectarTelegramBot } from "@/lib/telegram"
import { revalidatePath } from "next/cache"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type PlanResumen = {
  id: string
  nombre: string
  precio_mensual_mxn: number
  max_doctores: number
  max_usuarios: number
  max_recordatorios_mes: number
  saldo_ia_incluido_mxn: number
}

export type ClinicaAdmin = {
  clinica_id: string
  clinica_nombre: string | null
  cuenta_id: string
  cuenta_nombre: string
  cuenta_estado: string
  plan_nombre: string | null
  plan_id: string | null
  suscripcion_id: string | null
  saldo_disponible_mxn: number
  recordatorios_enviados: number
  recordatorios_tope: number
  doctores: number
  usuarios: number
  onboarding_completado: boolean
  telegram_conectado: boolean
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

export async function listarPlanes(): Promise<PlanResumen[]> {
  await assertSuperadmin()
  const db = createServerClient()
  const { data } = await db
    .from("planes")
    .select("id, nombre, precio_mensual_mxn, max_doctores, max_usuarios, max_recordatorios_mes, saldo_ia_incluido_mxn")
    .eq("activo", true)
    .order("precio_mensual_mxn")
  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precio_mensual_mxn: Number(p.precio_mensual_mxn),
    max_doctores: p.max_doctores,
    max_usuarios: p.max_usuarios,
    max_recordatorios_mes: p.max_recordatorios_mes,
    saldo_ia_incluido_mxn: Number(p.saldo_ia_incluido_mxn),
  }))
}

export async function listarClinicasAdmin(): Promise<ClinicaAdmin[]> {
  await assertSuperadmin()
  const db = createServerClient()

  const [clinicasRes, suscRes, membRes, channelsRes] = await Promise.all([
    db.from("clinicas").select("id, nombre, cuenta_id, onboarding_completado, cuentas(nombre, estado)").order("created_at"),
    db.from("suscripciones").select("id, cuenta_id, plan_id, saldo_ia_disponible_mxn, recordatorios_enviados, recordatorios_extra, estado, planes!plan_id(nombre, max_recordatorios_mes)"),
    db.from("membresias").select("clinica_id, rol, activa"),
    db.from("clinic_channels").select("clinica_id, activo, config").eq("canal", "telegram"),
  ])

  // Primera suscripcion por cuenta (activa/prueba preferente)
  const suscPorCuenta = new Map<string, any>()
  for (const s of suscRes.data ?? []) {
    const prev = suscPorCuenta.get(s.cuenta_id)
    if (!prev || (["activa", "prueba"].includes(s.estado) && !["activa", "prueba"].includes(prev.estado))) {
      suscPorCuenta.set(s.cuenta_id, s)
    }
  }

  // Conteos por clinica
  const docPorClinica = new Map<string, number>()
  const usrPorClinica = new Map<string, number>()
  for (const m of membRes.data ?? []) {
    if (!m.activa || !m.clinica_id) continue
    if (m.rol === "doctor") docPorClinica.set(m.clinica_id, (docPorClinica.get(m.clinica_id) ?? 0) + 1)
    else usrPorClinica.set(m.clinica_id, (usrPorClinica.get(m.clinica_id) ?? 0) + 1)
  }

  const tgPorClinica = new Map<string, boolean>()
  for (const c of channelsRes.data ?? []) {
    const cfg = c.config as { bot_token?: string } | null
    tgPorClinica.set(c.clinica_id, !!c.activo && !!cfg?.bot_token)
  }

  return (clinicasRes.data ?? []).map((c) => {
    const cuenta = c.cuentas as { nombre: string; estado: string } | null
    const susc = suscPorCuenta.get(c.cuenta_id)
    const plan = susc?.planes as { nombre: string; max_recordatorios_mes: number } | null
    return {
      clinica_id: c.id,
      clinica_nombre: c.nombre,
      cuenta_id: c.cuenta_id,
      cuenta_nombre: cuenta?.nombre ?? "Sin cuenta",
      cuenta_estado: cuenta?.estado ?? "prueba",
      plan_nombre: plan?.nombre ?? null,
      plan_id: susc?.plan_id ?? null,
      suscripcion_id: susc?.id ?? null,
      saldo_disponible_mxn: Number(susc?.saldo_ia_disponible_mxn ?? 0),
      recordatorios_enviados: Number(susc?.recordatorios_enviados ?? 0),
      recordatorios_tope: Number(plan?.max_recordatorios_mes ?? 0) + Number(susc?.recordatorios_extra ?? 0),
      doctores: docPorClinica.get(c.id) ?? 0,
      usuarios: usrPorClinica.get(c.id) ?? 0,
      onboarding_completado: !!c.onboarding_completado,
      telegram_conectado: tgPorClinica.get(c.id) ?? false,
    }
  })
}

// ---------------------------------------------------------------------------
// Alta de clinica nueva (cuenta + clinica + suscripcion + admin invitada)
// ---------------------------------------------------------------------------

export type DatosNuevaClinica = {
  nombre_clinica: string
  email_admin: string
  nombre_admin: string
  plan_id: string
  telefono?: string
  direccion?: string
}

export async function crearClinica(
  datos: DatosNuevaClinica,
): Promise<{ ok: boolean; error?: string; enlace_onboarding?: string }> {
  await assertSuperadmin()

  const nombreClinica = datos.nombre_clinica.trim()
  const emailAdmin = datos.email_admin.trim().toLowerCase()
  if (!nombreClinica) return { ok: false, error: "El nombre de la clinica es obligatorio." }
  if (!emailAdmin) return { ok: false, error: "El correo de la administradora es obligatorio." }
  if (!datos.plan_id) return { ok: false, error: "Selecciona un plan." }

  const db = createServerClient()

  // Plan elegido (para saldo de IA incluido)
  const { data: plan } = await db
    .from("planes")
    .select("id, saldo_ia_incluido_mxn")
    .eq("id", datos.plan_id)
    .single()
  if (!plan) return { ok: false, error: "El plan seleccionado no existe." }

  // 1. Cuenta
  const { data: cuenta, error: errCuenta } = await db
    .from("cuentas")
    .insert({ nombre: nombreClinica, email_contacto: emailAdmin, estado: "prueba" } as never)
    .select("id")
    .single()
  if (errCuenta || !cuenta) return { ok: false, error: errCuenta?.message ?? "No se pudo crear la cuenta." }

  // 2. Clinica
  const { data: clinica, error: errClinica } = await db
    .from("clinicas")
    .insert({
      cuenta_id: cuenta.id,
      nombre: nombreClinica,
      telefono: datos.telefono?.trim() || null,
      direccion: datos.direccion?.trim() || null,
      activa: true,
      onboarding_completado: false,
      onboarding_paso: 1,
    } as never)
    .select("id")
    .single()
  if (errClinica || !clinica) return { ok: false, error: errClinica?.message ?? "No se pudo crear la clinica." }

  // 3. Suscripcion con el plan elegido (abona saldo de IA incluido)
  const { error: errSusc } = await db.from("suscripciones").insert({
    cuenta_id: cuenta.id,
    plan_id: plan.id,
    estado: "prueba",
    saldo_ia_disponible_mxn: Number(plan.saldo_ia_incluido_mxn),
  } as never)
  if (errSusc) return { ok: false, error: errSusc.message }

  // 4. Invitar a la administradora (crea su acceso y la lleva al onboarding)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const { data: invitado, error: errInvite } = await db.auth.admin.inviteUserByEmail(emailAdmin, {
    data: { nombre: datos.nombre_admin.trim(), rol: "administrador" },
    redirectTo: `${appUrl}/api/auth/callback?next=/onboarding`,
  })

  if (!errInvite && invitado?.user) {
    const userId = invitado.user.id
    await db
      .from("profiles")
      .update({ nombre: datos.nombre_admin.trim(), rol: "administrador", clinica_id: clinica.id, cuenta_id: cuenta.id } as never)
      .eq("id", userId)
    await db.from("membresias").insert({
      user_id: userId,
      clinica_id: clinica.id,
      cuenta_id: cuenta.id,
      rol: "administrador",
      activa: true,
    } as never)
  }

  revalidatePath("/superadmin")
  return {
    ok: true,
    enlace_onboarding: `${appUrl}/login`,
    error: errInvite ? "Clinica creada, pero no se pudo enviar la invitacion por correo: " + errInvite.message : undefined,
  }
}

// ---------------------------------------------------------------------------
// Agregar usuarios / doctores a una clinica existente
// ---------------------------------------------------------------------------

export type MiembroNuevo = { nombre: string; email: string; rol: "doctor" | "supervisor" | "administrador" }

export async function agregarMiembros(
  clinicaId: string,
  miembros: MiembroNuevo[],
): Promise<{ ok: boolean; error?: string; agregados: number }> {
  await assertSuperadmin()
  const db = createServerClient()

  const { data: clinica } = await db.from("clinicas").select("cuenta_id").eq("id", clinicaId).single()
  if (!clinica) return { ok: false, error: "Clinica no encontrada.", agregados: 0 }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  let agregados = 0

  for (const m of miembros) {
    const email = m.email.trim().toLowerCase()
    if (!email) continue
    const { data: invitado, error } = await db.auth.admin.inviteUserByEmail(email, {
      data: { nombre: m.nombre.trim(), rol: m.rol },
      redirectTo: `${appUrl}/api/auth/callback?next=/conversaciones`,
    })
    if (error || !invitado?.user) continue
    const userId = invitado.user.id
    await db
      .from("profiles")
      .update({ nombre: m.nombre.trim(), rol: m.rol, clinica_id: clinicaId, cuenta_id: clinica.cuenta_id } as never)
      .eq("id", userId)
    await db.from("membresias").insert({
      user_id: userId,
      clinica_id: clinicaId,
      cuenta_id: clinica.cuenta_id,
      rol: m.rol,
      activa: true,
    } as never)
    agregados++
  }

  revalidatePath("/superadmin")
  return { ok: true, agregados }
}

// ---------------------------------------------------------------------------
// Recargar saldo de IA
// ---------------------------------------------------------------------------

export async function recargarSaldoIA(
  clinicaId: string,
  montoMxn: number,
): Promise<{ ok: boolean; error?: string }> {
  await assertSuperadmin()
  if (!Number.isFinite(montoMxn) || montoMxn <= 0) return { ok: false, error: "El monto debe ser mayor a 0." }

  const db = createServerClient()
  const { data: clinica } = await db.from("clinicas").select("cuenta_id").eq("id", clinicaId).single()
  if (!clinica) return { ok: false, error: "Clinica no encontrada." }

  const { data: susc } = await db
    .from("suscripciones")
    .select("id, saldo_ia_disponible_mxn")
    .eq("cuenta_id", clinica.cuenta_id)
    .in("estado", ["activa", "prueba"])
    .order("created_at")
    .limit(1)
    .maybeSingle()
  if (!susc) return { ok: false, error: "La cuenta no tiene una suscripcion activa." }

  const { error: errRecarga } = await db.from("recargas_saldo").insert({
    clinica_id: clinicaId,
    cuenta_id: clinica.cuenta_id,
    suscripcion_id: susc.id,
    monto_mxn: montoMxn,
    estado: "completada",
    referencia_pago: "superadmin",
  } as never)
  if (errRecarga) return { ok: false, error: errRecarga.message }

  const saldoNuevo = Number(susc.saldo_ia_disponible_mxn) + montoMxn
  const { error: errUpd } = await db
    .from("suscripciones")
    .update({ saldo_ia_disponible_mxn: saldoNuevo } as never)
    .eq("id", susc.id)
  if (errUpd) return { ok: false, error: errUpd.message }

  revalidatePath("/superadmin")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Sumar recordatorios extra
// ---------------------------------------------------------------------------

export async function sumarRecordatorios(
  clinicaId: string,
  cantidad: number,
): Promise<{ ok: boolean; error?: string }> {
  await assertSuperadmin()
  if (!Number.isInteger(cantidad) || cantidad <= 0) return { ok: false, error: "La cantidad debe ser un entero mayor a 0." }

  const db = createServerClient()
  const { data: clinica } = await db.from("clinicas").select("cuenta_id").eq("id", clinicaId).single()
  if (!clinica) return { ok: false, error: "Clinica no encontrada." }

  const { data: susc } = await db
    .from("suscripciones")
    .select("id, recordatorios_extra")
    .eq("cuenta_id", clinica.cuenta_id)
    .in("estado", ["activa", "prueba"])
    .order("created_at")
    .limit(1)
    .maybeSingle()
  if (!susc) return { ok: false, error: "La cuenta no tiene una suscripcion activa." }

  const { error } = await db
    .from("suscripciones")
    .update({ recordatorios_extra: Number(susc.recordatorios_extra ?? 0) + cantidad } as never)
    .eq("id", susc.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/superadmin")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Cambiar de plan
// ---------------------------------------------------------------------------

export async function cambiarPlan(
  cuentaId: string,
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  await assertSuperadmin()
  const db = createServerClient()

  const { data: susc } = await db
    .from("suscripciones")
    .select("id")
    .eq("cuenta_id", cuentaId)
    .in("estado", ["activa", "prueba"])
    .order("created_at")
    .limit(1)
    .maybeSingle()
  if (!susc) return { ok: false, error: "La cuenta no tiene una suscripcion activa." }

  const { error } = await db.from("suscripciones").update({ plan_id: planId } as never).eq("id", susc.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/superadmin")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Suspender / reactivar cuenta (sin borrar datos)
// ---------------------------------------------------------------------------

export async function cambiarEstadoCuenta(
  cuentaId: string,
  estado: "activa" | "suspendida",
): Promise<{ ok: boolean; error?: string }> {
  await assertSuperadmin()
  const db = createServerClient()
  const { error } = await db.from("cuentas").update({ estado } as never).eq("id", cuentaId)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/superadmin")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Conectar Telegram manualmente (el superadmin pega el token por la clinica)
// ---------------------------------------------------------------------------

export async function conectarTelegram(
  clinicaId: string,
  botToken: string,
): Promise<{ ok: boolean; error?: string; botUsername?: string | null }> {
  await assertSuperadmin()
  const resultado = await conectarTelegramBot(clinicaId, botToken)
  if (resultado.ok) revalidatePath("/superadmin")
  return resultado
}
