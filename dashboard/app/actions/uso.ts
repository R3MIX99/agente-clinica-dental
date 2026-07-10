"use server"

import { createServerClient } from "@/lib/supabase/server"
import { resolverClinicaId } from "@/lib/supabase/server-auth"

// ---------------------------------------------------------------------------
// Tipos de retorno
// ---------------------------------------------------------------------------

export type EstadoSaldo = "saludable" | "bajo" | "agotado"

export type UsoClinica = {
  plan: {
    id: string
    nombre: string
    precio_mensual_mxn: number
    saldo_ia_incluido_mxn: number
    max_doctores: number
    max_usuarios: number
    max_recordatorios_mes: number
  }
  suscripción: {
    id: string
    estado: string
    periodo: string
    inicio_periodo: string | null
    fin_periodo: string | null
  }
  saldo: {
    disponible_mxn: number
    incluido_mxn: number
    consumido_mxn: number
    pct_consumido: number
    estado: EstadoSaldo
    umbral_bajo_pct: number
  }
  recordatorios: {
    enviados: number
    max: number
    pct_usado: number
    estado: EstadoSaldo
  }
  equipo: {
    doctores_activos: number
    max_doctores: number
    usuarios_activos: number
    max_usuarios: number
  }
  ultimos_consumos: Array<{
    id: string
    created_at: string
    tokens_entrada: number
    tokens_salida: number
    costo_descontado_mxn: number
    modelo: string
  }>
  facturacion: {
    precio_mensual_mxn: number
    es_personalizado: boolean
    estado: string
    fecha_vencimiento: string | null
    historial: Array<{
      id: string
      created_at: string
      monto_mxn: number | null
      metodo: string | null
      concepto: string | null
    }>
  }
}

// ---------------------------------------------------------------------------
// obtenerUsoClinica — lectura completa para el panel /uso
// ---------------------------------------------------------------------------

export async function obtenerUsoClinica(): Promise<UsoClinica> {
  const clinicaId = await resolverClinicaId()
  const db = createServerClient()

  // Obtener cuenta_id
  const { data: clinicaRow } = await db
    .from("clinicas")
    .select("cuenta_id")
    .eq("id", clinicaId)
    .single()

  const cuentaId = clinicaRow?.cuenta_id ?? ""

  // Suscripción activa o en prueba con plan
  const { data: susData } = await db
    .from("suscripciones")
    .select(`
      id, estado, periodo, inicio_periodo, fin_periodo,
      saldo_ia_disponible_mxn, recordatorios_enviados,
      precio_personalizado_mxn, fecha_vencimiento,
      planes!plan_id (
        id, nombre, precio_mensual_mxn, saldo_ia_incluido_mxn,
        max_doctores, max_usuarios, max_recordatorios_mes
      )
    `)
    .eq("cuenta_id", cuentaId)
    .in("estado", ["activa", "prueba"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  // Historial de pagos (facturacion manual)
  const { data: historialPagos } = await db
    .from("historial_pagos")
    .select("id, created_at, monto_mxn, metodo, concepto")
    .eq("cuenta_id", cuentaId)
    .order("created_at", { ascending: false })
    .limit(6)

  // Umbral de saldo bajo desde config_sistema
  const { data: configRows } = await db
    .from("config_sistema")
    .select("clave, valor")
    .eq("clave", "ia_umbral_saldo_bajo_pct")

  const umbralPct = Number(configRows?.[0]?.valor ?? "20")

  // Conteos de equipo
  const [{ count: doctoresCount }, { count: usuariosCount }] = await Promise.all([
    db
      .from("membresias")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", clinicaId)
      .eq("rol", "doctor")
      .eq("activa", true),
    db
      .from("membresias")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", clinicaId)
      .in("rol", ["administrador", "supervisor"])
      .eq("activa", true),
  ])

  // Últimos 10 consumos de IA
  const { data: consumos } = await db
    .from("consumos_ia")
    .select("id, created_at, tokens_entrada, tokens_salida, costo_descontado_mxn, modelo")
    .eq("clinica_id", clinicaId)
    .order("created_at", { ascending: false })
    .limit(10)

  // Calculos derivados
  const plan = (susData?.planes as any) ?? {
    id: "",
    nombre: "Sin plan",
    precio_mensual_mxn: 0,
    saldo_ia_incluido_mxn: 0,
    max_doctores: 0,
    max_usuarios: 0,
    max_recordatorios_mes: 0,
  }

  const saldoDisponible = Number(susData?.saldo_ia_disponible_mxn ?? 0)
  const saldoIncluido   = Number(plan.saldo_ia_incluido_mxn ?? 0)
  const saldoConsumido  = Math.max(saldoIncluido - saldoDisponible, 0)
  const pctConsumido    = saldoIncluido > 0
    ? Math.min((saldoConsumido / saldoIncluido) * 100, 100)
    : 0
  const pctRestante = 100 - pctConsumido

  const estadoSaldo: EstadoSaldo =
    saldoDisponible <= 0       ? "agotado"
    : pctRestante <= umbralPct ? "bajo"
    : "saludable"

  const recordatoriosEnviados = Number(susData?.recordatorios_enviados ?? 0)
  const maxRecordatorios      = Number(plan.max_recordatorios_mes ?? 0)
  const pctRecordatorios      = maxRecordatorios > 0
    ? Math.min((recordatoriosEnviados / maxRecordatorios) * 100, 100)
    : 0

  const estadoRecordatorios: EstadoSaldo =
    recordatoriosEnviados >= maxRecordatorios ? "agotado"
    : pctRecordatorios >= 80                  ? "bajo"
    : "saludable"

  return {
    plan: {
      id:                    plan.id ?? "",
      nombre:                plan.nombre ?? "Sin plan",
      precio_mensual_mxn:    Number(plan.precio_mensual_mxn ?? 0),
      saldo_ia_incluido_mxn: saldoIncluido,
      max_doctores:          Number(plan.max_doctores ?? 0),
      max_usuarios:          Number(plan.max_usuarios ?? 0),
      max_recordatorios_mes: maxRecordatorios,
    },
    suscripción: {
      id:             susData?.id             ?? "",
      estado:         susData?.estado         ?? "prueba",
      periodo:        susData?.periodo        ?? "mensual",
      inicio_periodo: susData?.inicio_periodo ?? null,
      fin_periodo:    susData?.fin_periodo    ?? null,
    },
    saldo: {
      disponible_mxn:  saldoDisponible,
      incluido_mxn:    saldoIncluido,
      consumido_mxn:   saldoConsumido,
      pct_consumido:   Math.round(pctConsumido),
      estado:          estadoSaldo,
      umbral_bajo_pct: umbralPct,
    },
    recordatorios: {
      enviados:  recordatoriosEnviados,
      max:       maxRecordatorios,
      pct_usado: Math.round(pctRecordatorios),
      estado:    estadoRecordatorios,
    },
    equipo: {
      doctores_activos: doctoresCount ?? 0,
      max_doctores:     Number(plan.max_doctores ?? 0),
      usuarios_activos: usuariosCount ?? 0,
      max_usuarios:     Number(plan.max_usuarios ?? 0),
    },
    ultimos_consumos: (consumos ?? []).map((c) => ({
      id:                   c.id,
      created_at:           c.created_at,
      tokens_entrada:       c.tokens_entrada,
      tokens_salida:        c.tokens_salida,
      costo_descontado_mxn: Number(c.costo_descontado_mxn),
      modelo:               c.modelo,
    })),
    facturacion: {
      precio_mensual_mxn: (susData as any)?.precio_personalizado_mxn != null
        ? Number((susData as any).precio_personalizado_mxn)
        : Number(plan.precio_mensual_mxn ?? 0),
      es_personalizado: (susData as any)?.precio_personalizado_mxn != null,
      estado: susData?.estado ?? "prueba",
      fecha_vencimiento: (susData as any)?.fecha_vencimiento ?? null,
      historial: (historialPagos ?? []).map((h) => ({
        id:         h.id,
        created_at: h.created_at,
        monto_mxn:  h.monto_mxn != null ? Number(h.monto_mxn) : null,
        metodo:     h.metodo,
        concepto:   h.concepto,
      })),
    },
  }
}

// ---------------------------------------------------------------------------
// obtenerPlanes — lista de planes activos para el dialog de mejora
// ---------------------------------------------------------------------------

export type PlanCatalogo = {
  id: string
  nombre: string
  precio_mensual_mxn: number
  precio_anual_mxn: number
  saldo_ia_incluido_mxn: number
  max_doctores: number
  max_usuarios: number
  max_clinicas: number
  max_recordatorios_mes: number
}

export async function obtenerPlanes(): Promise<PlanCatalogo[]> {
  const db = createServerClient()
  const { data } = await db
    .from("planes")
    .select(
      "id, nombre, precio_mensual_mxn, precio_anual_mxn, saldo_ia_incluido_mxn, max_doctores, max_usuarios, max_clinicas, max_recordatorios_mes"
    )
    .eq("activo", true)
    .order("precio_mensual_mxn")
  return (data ?? []).map((p) => ({
    id:                    p.id,
    nombre:                p.nombre,
    precio_mensual_mxn:    Number(p.precio_mensual_mxn),
    precio_anual_mxn:      Number(p.precio_anual_mxn),
    saldo_ia_incluido_mxn: Number(p.saldo_ia_incluido_mxn),
    max_doctores:          Number(p.max_doctores),
    max_usuarios:          Number(p.max_usuarios),
    max_clinicas:          Number(p.max_clinicas),
    max_recordatorios_mes: Number(p.max_recordatorios_mes),
  }))
}

// ---------------------------------------------------------------------------
// Enforcement: verificar limites antes de agregar doctores o usuarios
// ---------------------------------------------------------------------------

export type ResultadoVerificacion = {
  permitido: boolean
  actual: number
  maximo: number
  mensaje?: string
}

/** Calcula los limites efectivos sumando add-ons activos al maximo del plan */
async function calcularLimitesEfectivos(
  susId: string,
  planMaxDoctores: number,
  planMaxUsuarios: number,
  db: ReturnType<typeof createServerClient>,
): Promise<{ maxDoctores: number; maxUsuarios: number }> {
  const { data: addonsActivos } = await (db as any)
    .from("suscripcion_addons")
    .select("cantidad, addons(tipo, incremento_doctores, incremento_usuarios)")
    .eq("suscripcion_id", susId)
    .eq("activo", true)

  let extraDoctores = 0
  let extraUsuarios = 0

  for (const a of (addonsActivos ?? []) as Array<{ cantidad: number; addons: { tipo: string; incremento_doctores: number; incremento_usuarios: number } | null }>) {
    extraDoctores += Number(a.addons?.incremento_doctores ?? 0) * (a.cantidad ?? 1)
    extraUsuarios += Number(a.addons?.incremento_usuarios ?? 0) * (a.cantidad ?? 1)
  }

  return {
    maxDoctores: planMaxDoctores + extraDoctores,
    maxUsuarios: planMaxUsuarios + extraUsuarios,
  }
}

export async function verificarLimiteDoctores(): Promise<ResultadoVerificacion> {
  const clinicaId = await resolverClinicaId()
  const db = createServerClient()

  const { data: clinicaRow } = await db
    .from("clinicas")
    .select("cuenta_id")
    .eq("id", clinicaId)
    .single()

  const { data: sus } = await db
    .from("suscripciones")
    .select("id, planes!plan_id(max_doctores)")
    .eq("cuenta_id", clinicaRow?.cuenta_id ?? "")
    .in("estado", ["activa", "prueba"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  const planMaxDoctores = Number((sus?.planes as any)?.max_doctores ?? 0)
  const { maxDoctores } = sus?.id
    ? await calcularLimitesEfectivos(sus.id, planMaxDoctores, 0, db)
    : { maxDoctores: planMaxDoctores }

  const { count } = await db
    .from("membresias")
    .select("id", { count: "exact", head: true })
    .eq("clinica_id", clinicaId)
    .eq("rol", "doctor")
    .eq("activa", true)

  const actual = count ?? 0
  const permitido = actual < maxDoctores

  return {
    permitido,
    actual,
    maximo: maxDoctores,
    mensaje: permitido
      ? undefined
      : `Tu plan permite hasta ${maxDoctores} doctor${maxDoctores === 1 ? "" : "es"} (incluyendo add-ons). Actualmente tienes ${actual}. Contrata el add-on "Doctor adicional" o sube de plan.`,
  }
}

export async function verificarLimiteUsuarios(): Promise<ResultadoVerificacion> {
  const clinicaId = await resolverClinicaId()
  const db = createServerClient()

  const { data: clinicaRow } = await db
    .from("clinicas")
    .select("cuenta_id")
    .eq("id", clinicaId)
    .single()

  const { data: sus } = await db
    .from("suscripciones")
    .select("id, planes!plan_id(max_usuarios)")
    .eq("cuenta_id", clinicaRow?.cuenta_id ?? "")
    .in("estado", ["activa", "prueba"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  const planMaxUsuarios = Number((sus?.planes as any)?.max_usuarios ?? 0)
  const { maxUsuarios } = sus?.id
    ? await calcularLimitesEfectivos(sus.id, 0, planMaxUsuarios, db)
    : { maxUsuarios: planMaxUsuarios }

  const { count } = await db
    .from("membresias")
    .select("id", { count: "exact", head: true })
    .eq("clinica_id", clinicaId)
    .in("rol", ["administrador", "supervisor"])
    .eq("activa", true)

  const actual = count ?? 0
  const permitido = actual < maxUsuarios

  return {
    permitido,
    actual,
    maximo: maxUsuarios,
    mensaje: permitido
      ? undefined
      : `Tu plan permite hasta ${maxUsuarios} usuario${maxUsuarios === 1 ? "" : "s"} no-doctor (incluyendo add-ons). Actualmente tienes ${actual}. Contrata el add-on "Usuario adicional" o sube de plan.`,
  }
}
