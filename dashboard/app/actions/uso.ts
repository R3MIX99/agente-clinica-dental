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
  suscripcion: {
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

  // Suscripcion activa o en prueba con plan
  const { data: susData } = await db
    .from("suscripciones")
    .select(`
      id, estado, periodo, inicio_periodo, fin_periodo,
      saldo_ia_disponible_mxn, recordatorios_enviados,
      planes (
        id, nombre, precio_mensual_mxn, saldo_ia_incluido_mxn,
        max_doctores, max_usuarios, max_recordatorios_mes
      )
    `)
    .eq("cuenta_id", cuentaId)
    .in("estado", ["activa", "prueba"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

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

  // Ultimos 10 consumos de IA
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
    suscripcion: {
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
    .select("planes(max_doctores)")
    .eq("cuenta_id", clinicaRow?.cuenta_id ?? "")
    .in("estado", ["activa", "prueba"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  const maxDoctores = Number((sus?.planes as any)?.max_doctores ?? 0)

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
      : `Tu plan permite hasta ${maxDoctores} doctor${maxDoctores === 1 ? "" : "es"}. Actualmente tienes ${actual}. Sube de plan para agregar mas.`,
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
    .select("planes(max_usuarios)")
    .eq("cuenta_id", clinicaRow?.cuenta_id ?? "")
    .in("estado", ["activa", "prueba"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  const maxUsuarios = Number((sus?.planes as any)?.max_usuarios ?? 0)

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
      : `Tu plan permite hasta ${maxUsuarios} usuario${maxUsuarios === 1 ? "" : "s"} no-doctor. Actualmente tienes ${actual}. Sube de plan para agregar mas.`,
  }
}
