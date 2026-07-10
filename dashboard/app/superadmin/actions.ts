"use server"

import { createServerClient } from "@/lib/supabase/server"
import { assertSuperadmin } from "@/lib/auth/superadmin"
import { conectarTelegramBot } from "@/lib/telegram"
import { revalidatePath } from "next/cache"
import { randomBytes } from "crypto"

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
  ultima_actividad: string | null
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

  const [clinicasRes, suscRes, membRes, channelsRes, convRes] = await Promise.all([
    db.from("clinicas").select("id, nombre, cuenta_id, onboarding_completado, cuentas(nombre, estado)").order("created_at"),
    db.from("suscripciones").select("id, cuenta_id, plan_id, saldo_ia_disponible_mxn, recordatorios_enviados, recordatorios_extra, estado, planes!plan_id(nombre, max_recordatorios_mes)"),
    db.from("membresias").select("clinica_id, rol, activa"),
    db.from("clinic_channels").select("clinica_id, activo, config").eq("canal", "telegram"),
    db.from("conversations").select("clinica_id, last_message_at"),
  ])

  // Ultima actividad por clinica (mayor last_message_at de sus conversaciones)
  const actividadPorClinica = new Map<string, string>()
  for (const c of convRes.data ?? []) {
    if (!c.clinica_id || !c.last_message_at) continue
    const prev = actividadPorClinica.get(c.clinica_id)
    if (!prev || c.last_message_at > prev) actividadPorClinica.set(c.clinica_id, c.last_message_at)
  }

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
      ultima_actividad: actividadPorClinica.get(c.id) ?? null,
    }
  })
}

// ---------------------------------------------------------------------------
// Reenviar acceso/onboarding a la administradora (enlace magico)
// ---------------------------------------------------------------------------

export async function reenviarOnboarding(
  clinicaId: string,
): Promise<{ ok: boolean; error?: string; enlace?: string }> {
  await assertSuperadmin()
  const db = createServerClient()

  // Buscar el administrador de la clinica
  const { data: membresias } = await db
    .from("membresias")
    .select("user_id")
    .eq("clinica_id", clinicaId)
    .eq("rol", "administrador")
    .eq("activa", true)
    .limit(1)
  const userId = membresias?.[0]?.user_id
  if (!userId) return { ok: false, error: "La clínica no tiene una administradora activa." }

  const { data: perfil } = await db.from("profiles").select("email").eq("id", userId).single()
  const email = perfil?.email
  if (!email) return { ok: false, error: "La administradora no tiene correo registrado." }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const { data, error } = await db.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${appUrl}/api/auth/callback?next=/onboarding` },
  })
  if (error) return { ok: false, error: error.message }

  return { ok: true, enlace: data.properties?.action_link }
}

// ---------------------------------------------------------------------------
// Resumen del panel (KPIs + graficas)
// ---------------------------------------------------------------------------

export type ResumenSuperadmin = {
  mrr_mxn: number
  total_clinicas: number
  activas: number
  prueba: number
  suspendidas: number
  por_vencer: number
  vencidas: number
  ingresos_por_mes: { mes: string; monto: number }[]
  clinicas_por_mes: { mes: string; nuevas: number }[]
  por_estado: { name: string; value: number; color: string }[]
  por_plan: { plan: string; clinicas: number }[]
}

const ESTADO_COLORES: Record<string, string> = {
  activa: "#10b981",
  prueba: "#3b82f6",
  pago_pendiente: "#f59e0b",
  vencida: "#ef4444",
  suspendida: "#f97316",
  cancelada: "#94a3b8",
}

const ESTADO_ETIQUETAS: Record<string, string> = {
  activa: "Activa",
  prueba: "Prueba",
  pago_pendiente: "Pago pendiente",
  vencida: "Vencida",
  suspendida: "Suspendida",
  cancelada: "Cancelada",
}

// Devuelve las claves YYYY-MM de los ultimos n meses (incluye el actual)
function ultimosMeses(n: number): { clave: string; etiqueta: string }[] {
  const salida: { clave: string; etiqueta: string }[] = []
  const hoy = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const etiqueta = d.toLocaleDateString("es-MX", { month: "short", year: "2-digit" })
    salida.push({ clave, etiqueta })
  }
  return salida
}

function claveMes(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export async function obtenerResumenSuperadmin(): Promise<ResumenSuperadmin> {
  await assertSuperadmin()
  const db = createServerClient()

  const [suscRes, clinicasRes, pagosRes] = await Promise.all([
    db.from("suscripciones").select("estado, precio_personalizado_mxn, fecha_vencimiento, planes!plan_id(nombre, precio_mensual_mxn)"),
    db.from("clinicas").select("id, created_at"),
    db.from("historial_pagos").select("monto_mxn, created_at"),
  ])

  const suscripciones = suscRes.data ?? []
  const hoy = new Date()
  const en7dias = new Date(hoy.getTime() + 7 * 86400000)

  let mrr = 0
  let activas = 0, prueba = 0, suspendidas = 0, porVencer = 0, vencidas = 0
  const estadoCount = new Map<string, number>()
  const planCount = new Map<string, number>()

  for (const s of suscripciones) {
    const plan = s.planes as { nombre: string; precio_mensual_mxn: number } | null
    const precio = s.precio_personalizado_mxn != null
      ? Number(s.precio_personalizado_mxn)
      : Number(plan?.precio_mensual_mxn ?? 0)

    estadoCount.set(s.estado, (estadoCount.get(s.estado) ?? 0) + 1)

    if (s.estado === "activa") { activas++; mrr += precio }
    if (s.estado === "prueba") prueba++
    if (s.estado === "suspendida") suspendidas++

    if (["activa", "prueba"].includes(s.estado)) {
      planCount.set(plan?.nombre ?? "Sin plan", (planCount.get(plan?.nombre ?? "Sin plan") ?? 0) + 1)
    }

    if (s.fecha_vencimiento && s.estado !== "cancelada") {
      const venc = new Date(s.fecha_vencimiento + "T12:00:00")
      if (venc < hoy) vencidas++
      else if (venc <= en7dias) porVencer++
    }
  }

  // Ingresos por mes (ultimos 6)
  const meses = ultimosMeses(6)
  const ingresoMap = new Map<string, number>()
  for (const p of pagosRes.data ?? []) {
    if (p.monto_mxn == null) continue
    const k = claveMes(p.created_at)
    ingresoMap.set(k, (ingresoMap.get(k) ?? 0) + Number(p.monto_mxn))
  }
  const nuevaMap = new Map<string, number>()
  for (const c of clinicasRes.data ?? []) {
    const k = claveMes(c.created_at)
    nuevaMap.set(k, (nuevaMap.get(k) ?? 0) + 1)
  }

  return {
    mrr_mxn: mrr,
    total_clinicas: clinicasRes.data?.length ?? 0,
    activas,
    prueba,
    suspendidas,
    por_vencer: porVencer,
    vencidas,
    ingresos_por_mes: meses.map((m) => ({ mes: m.etiqueta, monto: ingresoMap.get(m.clave) ?? 0 })),
    clinicas_por_mes: meses.map((m) => ({ mes: m.etiqueta, nuevas: nuevaMap.get(m.clave) ?? 0 })),
    por_estado: [...estadoCount.entries()].map(([estado, value]) => ({
      name: ESTADO_ETIQUETAS[estado] ?? estado,
      value,
      color: ESTADO_COLORES[estado] ?? "#94a3b8",
    })),
    por_plan: [...planCount.entries()].map(([plan, clinicas]) => ({ plan, clinicas })),
  }
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
  revalidatePath("/superadmin/clinicas")
  return { ok: true }
}

// Activa una clinica que estaba en prueba: pone cuenta y suscripcion en "activa"
// y, si no tiene fecha de vencimiento, la fija a un mes desde hoy.
export async function activarClinica(
  cuentaId: string,
): Promise<{ ok: boolean; error?: string }> {
  await assertSuperadmin()
  const db = createServerClient()

  const { error: errCuenta } = await db
    .from("cuentas")
    .update({ estado: "activa" } as never)
    .eq("id", cuentaId)
  if (errCuenta) return { ok: false, error: errCuenta.message }

  const { data: susc } = await db
    .from("suscripciones")
    .select("id, fecha_vencimiento")
    .eq("cuenta_id", cuentaId)
    .order("created_at")
    .limit(1)
    .maybeSingle()

  if (susc) {
    const update: Record<string, unknown> = { estado: "activa" }
    if (!susc.fecha_vencimiento) {
      const venc = new Date()
      venc.setMonth(venc.getMonth() + 1)
      update.fecha_vencimiento = venc.toISOString().slice(0, 10)
    }
    const { error: errSusc } = await db
      .from("suscripciones")
      .update(update as never)
      .eq("id", susc.id)
    if (errSusc) return { ok: false, error: errSusc.message }
  }

  revalidatePath("/superadmin")
  revalidatePath("/superadmin/clinicas")
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
  if (resultado.ok) {
    revalidatePath("/superadmin")
    revalidatePath(`/superadmin/${clinicaId}`)
  }
  return resultado
}

// ===========================================================================
// Detalle de una clinica (para la pagina dedicada)
// ===========================================================================

export type MiembroDetalle = {
  user_id: string
  nombre: string
  email: string | null
  rol: string
  activa: boolean
}

export type PagoHistorial = {
  id: string
  created_at: string
  monto_mxn: number | null
  metodo: string | null
  concepto: string | null
  status: string
}

export type ClinicaDetalle = {
  clinica_id: string
  clinica_nombre: string | null
  cuenta_id: string
  cuenta_estado: string
  onboarding_completado: boolean
  telegram_conectado: boolean
  suscripcion: {
    id: string
    estado: string
    plan_id: string | null
    plan_nombre: string | null
    precio_efectivo_mxn: number
    precio_personalizado_mxn: number | null
    precio_plan_mxn: number
    fecha_vencimiento: string | null
    saldo_ia_disponible_mxn: number
    recordatorios_enviados: number
    recordatorios_tope: number
    max_doctores: number
    max_usuarios: number
  } | null
  doctores: number
  usuarios: number
  miembros: MiembroDetalle[]
  historial: PagoHistorial[]
}

export async function obtenerClinicaDetalle(clinicaId: string): Promise<ClinicaDetalle | null> {
  await assertSuperadmin()
  const db = createServerClient()

  const { data: clinica } = await db
    .from("clinicas")
    .select("id, nombre, cuenta_id, onboarding_completado, cuentas(estado)")
    .eq("id", clinicaId)
    .maybeSingle()
  if (!clinica) return null

  const [suscRes, membRes, channelRes] = await Promise.all([
    db.from("suscripciones")
      .select("id, estado, plan_id, precio_personalizado_mxn, fecha_vencimiento, saldo_ia_disponible_mxn, recordatorios_enviados, recordatorios_extra, planes!plan_id(nombre, precio_mensual_mxn, max_doctores, max_usuarios, max_recordatorios_mes)")
      .eq("cuenta_id", clinica.cuenta_id)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    db.from("membresias").select("user_id, rol, activa").eq("clinica_id", clinicaId),
    db.from("clinic_channels").select("activo, config").eq("clinica_id", clinicaId).eq("canal", "telegram").maybeSingle(),
  ])

  const membresias = membRes.data ?? []
  const userIds = membresias.map((m) => m.user_id)
  const { data: perfiles } = userIds.length > 0
    ? await db.from("profiles").select("id, nombre, email").in("id", userIds)
    : { data: [] as { id: string; nombre: string; email: string | null }[] }
  const perfilMap = new Map((perfiles ?? []).map((p) => [p.id, p]))

  const miembros: MiembroDetalle[] = membresias.map((m) => {
    const p = perfilMap.get(m.user_id)
    return {
      user_id: m.user_id,
      nombre: p?.nombre ?? "—",
      email: p?.email ?? null,
      rol: m.rol,
      activa: m.activa,
    }
  })

  const doctores = miembros.filter((m) => m.rol === "doctor" && m.activa).length
  const usuarios = miembros.filter((m) => m.rol !== "doctor" && m.activa).length

  const { data: historial } = await db
    .from("historial_pagos")
    .select("id, created_at, monto_mxn, metodo, concepto, status")
    .eq("cuenta_id", clinica.cuenta_id)
    .order("created_at", { ascending: false })
    .limit(20)

  const s = suscRes.data
  const plan = s?.planes as { nombre: string; precio_mensual_mxn: number; max_doctores: number; max_usuarios: number; max_recordatorios_mes: number } | null
  const precioPlan = Number(plan?.precio_mensual_mxn ?? 0)
  const precioPers = s?.precio_personalizado_mxn != null ? Number(s.precio_personalizado_mxn) : null

  return {
    clinica_id: clinica.id,
    clinica_nombre: clinica.nombre,
    cuenta_id: clinica.cuenta_id,
    cuenta_estado: (clinica.cuentas as { estado: string } | null)?.estado ?? "prueba",
    onboarding_completado: !!clinica.onboarding_completado,
    telegram_conectado: !!channelRes.data?.activo && !!(channelRes.data?.config as { bot_token?: string } | null)?.bot_token,
    suscripcion: s ? {
      id: s.id,
      estado: s.estado,
      plan_id: s.plan_id,
      plan_nombre: plan?.nombre ?? null,
      precio_efectivo_mxn: precioPers ?? precioPlan,
      precio_personalizado_mxn: precioPers,
      precio_plan_mxn: precioPlan,
      fecha_vencimiento: s.fecha_vencimiento,
      saldo_ia_disponible_mxn: Number(s.saldo_ia_disponible_mxn ?? 0),
      recordatorios_enviados: Number(s.recordatorios_enviados ?? 0),
      recordatorios_tope: Number(plan?.max_recordatorios_mes ?? 0) + Number(s.recordatorios_extra ?? 0),
      max_doctores: Number(plan?.max_doctores ?? 0),
      max_usuarios: Number(plan?.max_usuarios ?? 0),
    } : null,
    doctores,
    usuarios,
    miembros,
    historial: (historial ?? []).map((h) => ({
      id: h.id,
      created_at: h.created_at,
      monto_mxn: h.monto_mxn != null ? Number(h.monto_mxn) : null,
      metodo: h.metodo,
      concepto: h.concepto,
      status: h.status,
    })),
  }
}

// ===========================================================================
// Crear usuario con contrasena temporal
// ===========================================================================

function generarPasswordTemporal(): string {
  const bytes = randomBytes(6).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)
  return `Dental-${bytes}`
}

export async function crearUsuarioConPassword(
  clinicaId: string,
  datos: { nombre: string; email: string; rol: "doctor" | "supervisor" | "administrador" },
): Promise<{ ok: boolean; error?: string; password?: string }> {
  await assertSuperadmin()
  const db = createServerClient()

  const email = datos.email.trim().toLowerCase()
  if (!email) return { ok: false, error: "El correo es obligatorio." }
  if (!datos.nombre.trim()) return { ok: false, error: "El nombre es obligatorio." }

  const { data: clinica } = await db.from("clinicas").select("cuenta_id").eq("id", clinicaId).single()
  if (!clinica) return { ok: false, error: "Clínica no encontrada." }

  const password = generarPasswordTemporal()

  const { data: creado, error: errCrear } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: datos.nombre.trim(), rol: datos.rol, password_temporal: true },
  })
  if (errCrear || !creado?.user) {
    return { ok: false, error: errCrear?.message ?? "No se pudo crear el usuario." }
  }

  const userId = creado.user.id
  await db.from("profiles").update({
    nombre: datos.nombre.trim(),
    rol: datos.rol,
    clinica_id: clinicaId,
    cuenta_id: clinica.cuenta_id,
    email,
  } as never).eq("id", userId)

  await db.from("membresias").insert({
    user_id: userId,
    clinica_id: clinicaId,
    cuenta_id: clinica.cuenta_id,
    rol: datos.rol,
    activa: true,
  } as never)

  revalidatePath(`/superadmin/${clinicaId}`)
  return { ok: true, password }
}

export async function cambiarActivoMiembro(
  clinicaId: string,
  userId: string,
  activa: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await assertSuperadmin()
  const db = createServerClient()
  const { error } = await db
    .from("membresias")
    .update({ activa } as never)
    .eq("clinica_id", clinicaId)
    .eq("user_id", userId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/superadmin/${clinicaId}`)
  return { ok: true }
}

// ===========================================================================
// Facturacion manual: precio, vencimiento y registro de pagos
// ===========================================================================

export async function fijarPrecioVencimiento(
  cuentaId: string,
  datos: { precio_mxn: number | null; fecha_vencimiento: string | null },
): Promise<{ ok: boolean; error?: string }> {
  await assertSuperadmin()
  const db = createServerClient()

  const { data: susc } = await db
    .from("suscripciones")
    .select("id")
    .eq("cuenta_id", cuentaId)
    .order("created_at")
    .limit(1)
    .maybeSingle()
  if (!susc) return { ok: false, error: "La cuenta no tiene suscripción." }

  const { error } = await db
    .from("suscripciones")
    .update({
      precio_personalizado_mxn: datos.precio_mxn,
      fecha_vencimiento: datos.fecha_vencimiento,
    } as never)
    .eq("id", susc.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/superadmin")
  return { ok: true }
}

export async function registrarPago(
  cuentaId: string,
  datos: { monto_mxn: number; metodo: string; nota?: string },
): Promise<{ ok: boolean; error?: string }> {
  const admin = await assertSuperadmin()
  const db = createServerClient()

  if (!Number.isFinite(datos.monto_mxn) || datos.monto_mxn <= 0) {
    return { ok: false, error: "El monto debe ser mayor a 0." }
  }

  const { data: susc } = await db
    .from("suscripciones")
    .select("id, fecha_vencimiento")
    .eq("cuenta_id", cuentaId)
    .order("created_at")
    .limit(1)
    .maybeSingle()
  if (!susc) return { ok: false, error: "La cuenta no tiene suscripción." }

  // Registrar el pago
  const { error: errPago } = await db.from("historial_pagos").insert({
    suscripcion_id: susc.id,
    cuenta_id: cuentaId,
    status: "pagado",
    monto_mxn: datos.monto_mxn,
    metodo: datos.metodo.trim() || "manual",
    concepto: datos.nota?.trim() || "Pago de suscripción",
    registrado_por: admin.email ?? "superadmin",
  } as never)
  if (errPago) return { ok: false, error: errPago.message }

  // Avanzar el vencimiento un mes (desde el vencimiento actual si es futuro, si no desde hoy)
  const base = susc.fecha_vencimiento
    ? new Date(susc.fecha_vencimiento + "T12:00:00")
    : new Date()
  const ahora = new Date()
  const desde = base > ahora ? base : ahora
  desde.setMonth(desde.getMonth() + 1)
  const nuevoVenc = desde.toISOString().slice(0, 10)

  const { error: errSusc } = await db
    .from("suscripciones")
    .update({
      estado: "activa",
      fecha_vencimiento: nuevoVenc,
      recordatorio_2d_at: null,
      recordatorio_vencido_at: null,
    } as never)
    .eq("id", susc.id)
  if (errSusc) return { ok: false, error: errSusc.message }

  await db.from("cuentas").update({ estado: "activa" } as never).eq("id", cuentaId)

  revalidatePath("/superadmin")
  revalidatePath(`/superadmin`)
  return { ok: true }
}
