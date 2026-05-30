"use server"

import { createServerClient } from "@/lib/supabase/server"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { revalidatePath } from "next/cache"

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export type CuentaResumen = {
  id: string
  nombre: string
  email_contacto: string | null
  estado: string
  created_at: string
  plan_nombre: string | null
  suscripcion_estado: string | null
  num_clinicas: number
  num_usuarios: number
  uso_ia_mes: number
}

export type UsuarioCuenta = {
  user_id: string
  nombre: string
  email: string | null
  rol: string
  clinica_nombre: string | null
}

export type CuentaDetalle = {
  id: string
  nombre: string
  email_contacto: string | null
  estado: string
  created_at: string
  suscripcion: {
    id: string
    estado: string
    periodo: string
    inicio_periodo: string | null
    fin_periodo: string | null
    saldo_ia_disponible_mxn: number
    plan_nombre: string | null
    precio_mensual_mxn: number | null
  } | null
  clinicas: Array<{ id: string; nombre: string | null; activa: boolean }>
  usuarios: UsuarioCuenta[]
  uso_ia_mes: number
  uso_recordatorios_mes: number
  historial_pagos: Array<{
    id: string
    created_at: string
    concepto: string | null
    monto_mxn: number | null
    status: string
  }>
}

export type PlanDatos = {
  id: string
  nombre: string
  precio_mensual_mxn: number
  precio_anual_mxn: number
  max_doctores: number
  max_usuarios: number
  max_clinicas: number
  saldo_ia_incluido_mxn: number
  max_recordatorios_mes: number
  activo: boolean
  created_at: string
}

export type NuevoPlan = {
  nombre: string
  precio_mensual_mxn: number
  precio_anual_mxn: number
  max_doctores: number
  max_usuarios: number
  max_clinicas: number
  saldo_ia_incluido_mxn: number
  max_recordatorios_mes: number
}

export type MetricasSuperadmin = {
  mrr: number
  cuentas_activas: number
  cuentas_prueba: number
  cuentas_suspendidas: number
  nuevas_mes: number
  distribucion_planes: Array<{ plan_nombre: string; total: number; mrr: number }>
}

// ---------------------------------------------------------------------------
// Guard: verificar rol superadmin en cada accion
// ---------------------------------------------------------------------------

async function verificarSuperadmin() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user || user.user_metadata?.rol !== "superadmin") {
    throw new Error("Acceso denegado: se requiere rol de superadmin")
  }
  return user
}

function inicioMesActual(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// ---------------------------------------------------------------------------
// Metricas agregadas
// ---------------------------------------------------------------------------

export async function obtenerMetricas(): Promise<MetricasSuperadmin> {
  await verificarSuperadmin()
  const db = createServerClient()

  const [cuentasRes, suscRes] = await Promise.all([
    db.from("cuentas").select("id, estado, created_at"),
    db.from("suscripciones").select("cuenta_id, estado, periodo, planes!plan_id(nombre, precio_mensual_mxn, precio_anual_mxn)"),
  ])

  const cuentas = cuentasRes.data ?? []
  const suscripciones = suscRes.data ?? []
  const inicioMes = new Date(inicioMesActual())

  // MRR: suma de ingresos mensuales normalizados de suscripciones activas
  const mrr = suscripciones
    .filter((s) => s.estado === "activa")
    .reduce((acc, s) => {
      const plan = s.planes as { precio_mensual_mxn: number; precio_anual_mxn: number } | null
      if (!plan) return acc
      const precio =
        s.periodo === "anual"
          ? Number(plan.precio_anual_mxn) / 12
          : Number(plan.precio_mensual_mxn)
      return acc + precio
    }, 0)

  // Conteos por estado de cuenta
  const cuentas_activas    = cuentas.filter((c) => c.estado === "activa").length
  const cuentas_prueba     = cuentas.filter((c) => c.estado === "prueba").length
  const cuentas_suspendidas = cuentas.filter((c) => c.estado === "suspendida").length
  const nuevas_mes         = cuentas.filter((c) => new Date(c.created_at) >= inicioMes).length

  // Distribucion por plan (nombre, total suscripciones, mrr aportado)
  const planMap = new Map<string, { total: number; mrr: number }>()
  for (const s of suscripciones) {
    const plan = s.planes as { nombre: string; precio_mensual_mxn: number; precio_anual_mxn: number } | null
    if (!plan) continue
    const nombre = plan.nombre
    const precio =
      s.estado === "activa"
        ? s.periodo === "anual"
          ? Number(plan.precio_anual_mxn) / 12
          : Number(plan.precio_mensual_mxn)
        : 0
    const prev = planMap.get(nombre) ?? { total: 0, mrr: 0 }
    planMap.set(nombre, { total: prev.total + 1, mrr: prev.mrr + precio })
  }

  const distribucion_planes = [...planMap.entries()]
    .map(([plan_nombre, v]) => ({ plan_nombre, total: v.total, mrr: v.mrr }))
    .sort((a, b) => b.mrr - a.mrr)

  return {
    mrr,
    cuentas_activas,
    cuentas_prueba,
    cuentas_suspendidas,
    nuevas_mes,
    distribucion_planes,
  }
}

// ---------------------------------------------------------------------------
// Listado de cuentas (con datos agregados)
// ---------------------------------------------------------------------------

export async function listarCuentas(): Promise<CuentaResumen[]> {
  await verificarSuperadmin()
  const db = createServerClient()

  const [cuentasRes, suscRes, clinicasRes, membresiaRes, usoRes] = await Promise.all([
    db.from("cuentas")
      .select("id, nombre, email_contacto, estado, created_at")
      .order("created_at", { ascending: false }),
    db.from("suscripciones")
      .select("cuenta_id, estado, planes!plan_id(nombre)")
      .order("created_at", { ascending: false }),
    db.from("clinicas").select("cuenta_id"),
    db.from("membresias").select("cuenta_id, user_id").eq("activa", true),
    db.from("uso_metering")
      .select("cuenta_id, cantidad")
      .gte("created_at", inicioMesActual())
      .eq("tipo", "ia"),
  ])

  // Primera suscripcion por cuenta (mas reciente)
  const suscPorCuenta = new Map<string, { estado: string; plan_nombre: string | null }>()
  for (const s of suscRes.data ?? []) {
    if (suscPorCuenta.has(s.cuenta_id)) continue
    const plan = s.planes as { nombre: string } | null
    suscPorCuenta.set(s.cuenta_id, {
      estado:     s.estado,
      plan_nombre: plan?.nombre ?? null,
    })
  }

  // Conteo de clinicas por cuenta
  const clinicasPorCuenta = new Map<string, number>()
  for (const c of clinicasRes.data ?? []) {
    clinicasPorCuenta.set(c.cuenta_id, (clinicasPorCuenta.get(c.cuenta_id) ?? 0) + 1)
  }

  // Usuarios unicos por cuenta (via membresias activas)
  const usuariosPorCuenta = new Map<string, Set<string>>()
  for (const m of membresiaRes.data ?? []) {
    if (!usuariosPorCuenta.has(m.cuenta_id)) {
      usuariosPorCuenta.set(m.cuenta_id, new Set())
    }
    usuariosPorCuenta.get(m.cuenta_id)!.add(m.user_id)
  }

  // Uso de IA del mes actual por cuenta
  const usoPorCuenta = new Map<string, number>()
  for (const u of usoRes.data ?? []) {
    usoPorCuenta.set(u.cuenta_id, (usoPorCuenta.get(u.cuenta_id) ?? 0) + Number(u.cantidad))
  }

  return (cuentasRes.data ?? []).map((c) => {
    const susc = suscPorCuenta.get(c.id)
    return {
      id:                 c.id,
      nombre:             c.nombre,
      email_contacto:     c.email_contacto,
      estado:             c.estado,
      created_at:         c.created_at,
      plan_nombre:        susc?.plan_nombre ?? null,
      suscripcion_estado: susc?.estado ?? null,
      num_clinicas:       clinicasPorCuenta.get(c.id) ?? 0,
      num_usuarios:       usuariosPorCuenta.get(c.id)?.size ?? 0,
      uso_ia_mes:         usoPorCuenta.get(c.id) ?? 0,
    }
  })
}

// ---------------------------------------------------------------------------
// Detalle de una cuenta
// ---------------------------------------------------------------------------

export async function obtenerCuenta(id: string): Promise<CuentaDetalle | null> {
  await verificarSuperadmin()
  const db = createServerClient()

  const [cuentaRes, clinicasRes, suscRes, membresiaRes, usoRes, historialRes] = await Promise.all([
    db.from("cuentas")
      .select("id, nombre, email_contacto, estado, created_at")
      .eq("id", id)
      .single(),
    db.from("clinicas")
      .select("id, nombre, activa")
      .eq("cuenta_id", id)
      .order("nombre"),
    db.from("suscripciones")
      .select("id, estado, periodo, inicio_periodo, fin_periodo, saldo_ia_disponible_mxn, planes!plan_id(nombre, precio_mensual_mxn)")
      .eq("cuenta_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("membresias")
      .select("user_id, rol, clinica_id, clinicas(nombre)")
      .eq("cuenta_id", id)
      .eq("activa", true),
    db.from("uso_metering")
      .select("tipo, cantidad")
      .eq("cuenta_id", id)
      .gte("created_at", inicioMesActual()),
    db.from("historial_pagos")
      .select("id, created_at, concepto, monto_mxn, status")
      .eq("cuenta_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  if (!cuentaRes.data) return null

  // Perfiles de los usuarios de esta cuenta (separado por falta de FK directa)
  const userIds = [...new Set((membresiaRes.data ?? []).map((m) => m.user_id))]
  const profilesRes =
    userIds.length > 0
      ? await db.from("profiles").select("id, nombre, email").in("id", userIds)
      : { data: [] as Array<{ id: string; nombre: string; email: string | null }> }

  const profileMap = new Map<string, { nombre: string; email: string | null }>()
  for (const p of profilesRes.data ?? []) {
    profileMap.set(p.id, { nombre: p.nombre, email: p.email })
  }

  const usuarios: UsuarioCuenta[] = (membresiaRes.data ?? []).map((m) => {
    const perfil = profileMap.get(m.user_id)
    const clinica = m.clinicas as { nombre: string | null } | null
    return {
      user_id:       m.user_id,
      nombre:        perfil?.nombre ?? "Sin nombre",
      email:         perfil?.email ?? null,
      rol:           m.rol,
      clinica_nombre: clinica?.nombre ?? null,
    }
  })

  // Uso del mes separado por tipo
  const uso            = usoRes.data ?? []
  const uso_ia_mes     = uso.filter((u) => u.tipo === "ia").reduce((a, u) => a + Number(u.cantidad), 0)
  const uso_rec_mes    = uso.filter((u) => u.tipo === "recordatorio").reduce((a, u) => a + Number(u.cantidad), 0)

  // Suscripcion + plan
  const susc = suscRes.data
  const plan = susc?.planes as { nombre: string; precio_mensual_mxn: number } | null

  return {
    id:             cuentaRes.data.id,
    nombre:         cuentaRes.data.nombre,
    email_contacto: cuentaRes.data.email_contacto,
    estado:         cuentaRes.data.estado,
    created_at:     cuentaRes.data.created_at,
    suscripcion: susc
      ? {
          id:                     susc.id,
          estado:                 susc.estado,
          periodo:                susc.periodo,
          inicio_periodo:         susc.inicio_periodo,
          fin_periodo:            susc.fin_periodo,
          saldo_ia_disponible_mxn: susc.saldo_ia_disponible_mxn,
          plan_nombre:            plan?.nombre ?? null,
          precio_mensual_mxn:     plan?.precio_mensual_mxn ?? null,
        }
      : null,
    clinicas:           (clinicasRes.data ?? []).map((c) => ({ id: c.id, nombre: c.nombre, activa: c.activa })),
    usuarios,
    uso_ia_mes,
    uso_recordatorios_mes: uso_rec_mes,
    historial_pagos:    (historialRes.data ?? []).map((h) => ({
      id:         h.id,
      created_at: h.created_at,
      concepto:   h.concepto,
      monto_mxn:  h.monto_mxn,
      status:     h.status,
    })),
  }
}

// ---------------------------------------------------------------------------
// Suspender / Reactivar cuenta
// (Requiere confirmacion explicita en la UI antes de llamar)
// ---------------------------------------------------------------------------

export async function suspenderCuenta(id: string): Promise<{ ok: boolean; error?: string }> {
  await verificarSuperadmin()
  const db = createServerClient()

  const [r1, r2] = await Promise.all([
    db.from("cuentas").update({ estado: "suspendida" }).eq("id", id),
    // Suspende tambien las suscripciones activas o en prueba para que el
    // panel de la clinica muestre la pantalla de suspension inmediatamente.
    db.from("suscripciones")
      .update({ estado: "suspendida" } as any)
      .eq("cuenta_id", id)
      .in("estado", ["activa", "prueba"]),
  ])

  if (r1.error) return { ok: false, error: r1.error.message }
  revalidatePath("/superadmin/cuentas")
  revalidatePath(`/superadmin/cuentas/${id}`)
  return { ok: true }
}

export async function reactivarCuenta(id: string): Promise<{ ok: boolean; error?: string }> {
  await verificarSuperadmin()
  const db = createServerClient()

  const [r1, r2] = await Promise.all([
    db.from("cuentas").update({ estado: "activa" }).eq("id", id),
    // Devuelve las suscripciones suspendidas a "prueba" (estado neutro seguro).
    // Si el cliente tenia suscripcion activa de pago, el administrador puede
    // ajustarla manualmente desde la UI de planes.
    db.from("suscripciones")
      .update({ estado: "prueba" } as any)
      .eq("cuenta_id", id)
      .eq("estado", "suspendida"),
  ])

  if (r1.error) return { ok: false, error: r1.error.message }
  revalidatePath("/superadmin/cuentas")
  revalidatePath(`/superadmin/cuentas/${id}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Gestion del catalogo de planes
// ---------------------------------------------------------------------------

export async function listarPlanes(): Promise<PlanDatos[]> {
  await verificarSuperadmin()
  const db = createServerClient()

  const { data, error } = await db
    .from("planes")
    .select("id, nombre, precio_mensual_mxn, precio_anual_mxn, max_doctores, max_usuarios, max_clinicas, saldo_ia_incluido_mxn, max_recordatorios_mes, activo, created_at")
    .order("precio_mensual_mxn")

  if (error) throw new Error(error.message)
  return (data ?? []).map((p) => ({
    id:                   p.id,
    nombre:               p.nombre,
    precio_mensual_mxn:   Number(p.precio_mensual_mxn),
    precio_anual_mxn:     Number(p.precio_anual_mxn),
    max_doctores:         p.max_doctores,
    max_usuarios:         p.max_usuarios,
    max_clinicas:         p.max_clinicas,
    saldo_ia_incluido_mxn: Number(p.saldo_ia_incluido_mxn),
    max_recordatorios_mes: p.max_recordatorios_mes,
    activo:               p.activo,
    created_at:           p.created_at,
  }))
}

export async function crearPlan(datos: NuevoPlan): Promise<{ ok: boolean; error?: string }> {
  await verificarSuperadmin()
  const db = createServerClient()

  const { error } = await db.from("planes").insert({
    nombre:               datos.nombre,
    precio_mensual_mxn:   datos.precio_mensual_mxn,
    precio_anual_mxn:     datos.precio_anual_mxn,
    max_doctores:         datos.max_doctores,
    max_usuarios:         datos.max_usuarios,
    max_clinicas:         datos.max_clinicas,
    saldo_ia_incluido_mxn: datos.saldo_ia_incluido_mxn,
    max_recordatorios_mes: datos.max_recordatorios_mes,
    activo:               true,
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath("/superadmin/planes")
  return { ok: true }
}

export async function actualizarPlan(id: string, datos: NuevoPlan): Promise<{ ok: boolean; error?: string }> {
  await verificarSuperadmin()
  const db = createServerClient()

  const { error } = await db
    .from("planes")
    .update({
      nombre:               datos.nombre,
      precio_mensual_mxn:   datos.precio_mensual_mxn,
      precio_anual_mxn:     datos.precio_anual_mxn,
      max_doctores:         datos.max_doctores,
      max_usuarios:         datos.max_usuarios,
      max_clinicas:         datos.max_clinicas,
      saldo_ia_incluido_mxn: datos.saldo_ia_incluido_mxn,
      max_recordatorios_mes: datos.max_recordatorios_mes,
    })
    .eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/superadmin/planes")
  return { ok: true }
}

export async function togglePlanActivo(id: string, activo: boolean): Promise<{ ok: boolean; error?: string }> {
  await verificarSuperadmin()
  const db = createServerClient()

  const { error } = await db.from("planes").update({ activo }).eq("id", id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/superadmin/planes")
  return { ok: true }
}
