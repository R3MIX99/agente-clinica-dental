"use server"

import { createServerClient } from "@/lib/supabase/server"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { revalidatePath } from "next/cache"

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export type ClinicaSaldo = {
  clinica_id: string
  clinica_nombre: string | null
  cuenta_id: string
  cuenta_nombre: string
  suscripcion_id: string | null
  saldo_disponible_mxn: number
  saldo_incluido_mxn: number
  consumido_mes_mxn: number
}

export type RecargaHistorial = {
  id: string
  created_at: string
  clinica_nombre: string | null
  cuenta_nombre: string
  monto_mxn: number
  estado: string
  referencia_pago: string | null
}

export type ResumenMes = {
  // Costo bruto en USD que la cuenta de Anthropic facturara
  consumido_api_usd: number
  // Costo cobrado al cliente final en MXN (con markup y tipo de cambio aplicados)
  cobrado_mxn: number
  // Tipo de cambio promedio usado en los consumos del mes
  tipo_cambio_promedio: number
  // Total recargado este mes (lo que pago el cliente para tener saldo)
  recargado_mes_mxn: number
  // Total cobrado / cargado en consumos_ia.costo_descontado_mxn este mes
  cobrado_consumos_mxn: number
  // Numero de llamadas a la API este mes
  llamadas_api: number
  // Cantidad de recargas registradas este mes
  recargas_mes: number
}

// ---------------------------------------------------------------------------
// Guard de seguridad
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
// Resumen del mes actual
// ---------------------------------------------------------------------------

export async function obtenerResumenMes(): Promise<ResumenMes> {
  await verificarSuperadmin()
  const db = createServerClient()

  const inicio = inicioMesActual()

  const [consumosRes, recargasRes] = await Promise.all([
    db
      .from("consumos_ia")
      .select("costo_api_usd, costo_descontado_mxn, tipo_cambio")
      .gte("created_at", inicio),
    db
      .from("recargas_saldo")
      .select("monto_mxn")
      .gte("created_at", inicio)
      .eq("estado", "completada"),
  ])

  const consumos = consumosRes.data ?? []
  const recargas = recargasRes.data ?? []

  let consumido_api_usd = 0
  let cobrado_consumos_mxn = 0
  let suma_tipo_cambio = 0
  for (const c of consumos) {
    consumido_api_usd     += Number(c.costo_api_usd)
    cobrado_consumos_mxn  += Number(c.costo_descontado_mxn)
    suma_tipo_cambio      += Number(c.tipo_cambio)
  }
  const tipo_cambio_promedio = consumos.length > 0
    ? suma_tipo_cambio / consumos.length
    : 0

  let recargado_mes_mxn = 0
  for (const r of recargas) {
    recargado_mes_mxn += Number(r.monto_mxn)
  }

  return {
    consumido_api_usd,
    cobrado_mxn:           cobrado_consumos_mxn,
    tipo_cambio_promedio,
    recargado_mes_mxn,
    cobrado_consumos_mxn,
    llamadas_api:          consumos.length,
    recargas_mes:          recargas.length,
  }
}

// ---------------------------------------------------------------------------
// Listar clinicas con saldo actual
// ---------------------------------------------------------------------------

export async function listarClinicasConSaldo(): Promise<ClinicaSaldo[]> {
  await verificarSuperadmin()
  const db = createServerClient()

  const [clinicasRes, suscRes, consumosRes] = await Promise.all([
    db
      .from("clinicas")
      .select("id, nombre, cuenta_id, cuentas(nombre)")
      .eq("activa", true)
      .order("nombre"),
    db
      .from("suscripciones")
      .select("id, cuenta_id, saldo_ia_disponible_mxn, planes!plan_id(saldo_ia_incluido_mxn)")
      .in("estado", ["activa", "prueba"]),
    db
      .from("consumos_ia")
      .select("clinica_id, costo_descontado_mxn")
      .gte("created_at", inicioMesActual()),
  ])

  // Primera suscripcion activa por cuenta
  const suscPorCuenta = new Map<string, { id: string; saldo: number; incluido: number }>()
  for (const s of suscRes.data ?? []) {
    if (suscPorCuenta.has(s.cuenta_id)) continue
    const plan = s.planes as { saldo_ia_incluido_mxn: number } | null
    suscPorCuenta.set(s.cuenta_id, {
      id:        s.id,
      saldo:     Number(s.saldo_ia_disponible_mxn),
      incluido:  Number(plan?.saldo_ia_incluido_mxn ?? 0),
    })
  }

  // Consumido por clinica este mes
  const consumoPorClinica = new Map<string, number>()
  for (const c of consumosRes.data ?? []) {
    consumoPorClinica.set(
      c.clinica_id,
      (consumoPorClinica.get(c.clinica_id) ?? 0) + Number(c.costo_descontado_mxn),
    )
  }

  return (clinicasRes.data ?? []).map((c) => {
    const susc = suscPorCuenta.get(c.cuenta_id)
    const cuenta = c.cuentas as { nombre: string } | null
    return {
      clinica_id:           c.id,
      clinica_nombre:       c.nombre,
      cuenta_id:            c.cuenta_id,
      cuenta_nombre:        cuenta?.nombre ?? "Sin cuenta",
      suscripcion_id:       susc?.id ?? null,
      saldo_disponible_mxn: susc?.saldo ?? 0,
      saldo_incluido_mxn:   susc?.incluido ?? 0,
      consumido_mes_mxn:    consumoPorClinica.get(c.id) ?? 0,
    }
  })
}

// ---------------------------------------------------------------------------
// Recargar saldo de una clinica
// (registra recarga + suma al saldo disponible de la suscripcion)
// ---------------------------------------------------------------------------

export async function recargarSaldo(datos: {
  clinica_id: string
  cuenta_id: string
  suscripcion_id: string
  monto_mxn: number
  referencia_pago?: string
  vigencia_fin?: string
}): Promise<{ ok: boolean; error?: string }> {
  await verificarSuperadmin()

  if (!Number.isFinite(datos.monto_mxn) || datos.monto_mxn <= 0) {
    return { ok: false, error: "El monto debe ser mayor a 0" }
  }

  const db = createServerClient()

  // 1. Registrar la recarga
  const { error: errRecarga } = await db.from("recargas_saldo").insert({
    clinica_id:      datos.clinica_id,
    cuenta_id:       datos.cuenta_id,
    suscripcion_id:  datos.suscripcion_id,
    monto_mxn:       datos.monto_mxn,
    estado:          "completada",
    referencia_pago: datos.referencia_pago?.trim() || null,
    vigencia_fin:    datos.vigencia_fin || null,
  })
  if (errRecarga) return { ok: false, error: errRecarga.message }

  // 2. Sumar al saldo disponible de la suscripcion
  // Leer el saldo actual y sumar el monto en una sola operacion
  const { data: susc } = await db
    .from("suscripciones")
    .select("saldo_ia_disponible_mxn")
    .eq("id", datos.suscripcion_id)
    .single()

  const saldoNuevo = Number(susc?.saldo_ia_disponible_mxn ?? 0) + datos.monto_mxn

  const { error: errUpd } = await db
    .from("suscripciones")
    .update({ saldo_ia_disponible_mxn: saldoNuevo })
    .eq("id", datos.suscripcion_id)
  if (errUpd) return { ok: false, error: errUpd.message }

  revalidatePath("/recargas")
  revalidatePath("/uso")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Historial reciente de recargas
// ---------------------------------------------------------------------------

export async function historialRecargas(): Promise<RecargaHistorial[]> {
  await verificarSuperadmin()
  const db = createServerClient()

  const { data: recargas, error } = await db
    .from("recargas_saldo")
    .select("id, created_at, monto_mxn, estado, referencia_pago, clinica_id, cuenta_id")
    .order("created_at", { ascending: false })
    .limit(30)

  if (error) throw new Error(error.message)
  if (!recargas || recargas.length === 0) return []

  // Cargar nombres de clinicas y cuentas en paralelo (no hay FK explicita)
  const clinicaIds = [...new Set(recargas.map((r) => r.clinica_id))]
  const cuentaIds  = [...new Set(recargas.map((r) => r.cuenta_id))]

  const [clinicasRes, cuentasRes] = await Promise.all([
    db.from("clinicas").select("id, nombre").in("id", clinicaIds),
    db.from("cuentas").select("id, nombre").in("id", cuentaIds),
  ])

  const clinicaMap = new Map<string, string | null>(
    (clinicasRes.data ?? []).map((c) => [c.id, c.nombre]),
  )
  const cuentaMap = new Map<string, string>(
    (cuentasRes.data ?? []).map((c) => [c.id, c.nombre]),
  )

  return recargas.map((r) => ({
    id:              r.id,
    created_at:      r.created_at,
    clinica_nombre:  clinicaMap.get(r.clinica_id) ?? null,
    cuenta_nombre:   cuentaMap.get(r.cuenta_id) ?? "Sin cuenta",
    monto_mxn:       Number(r.monto_mxn),
    estado:          r.estado,
    referencia_pago: r.referencia_pago,
  }))
}
