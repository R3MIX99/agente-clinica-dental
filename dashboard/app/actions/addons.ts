"use server"

import { createServerClient } from "@/lib/supabase/server"
import { resolverClinicaId } from "@/lib/supabase/server-auth"
import { mpPut } from "@/lib/mercadopago"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type AddonCatalogo = {
  id: string
  clave: string
  nombre: string
  descripcion: string
  precio_mensual_mxn: number
  tipo: string
  incremento_doctores: number
  incremento_usuarios: number
  incremento_recordatorios: number
}

export type AddonContratado = {
  id: string                 // suscripcion_addons.id
  addon_id: string
  clave: string
  nombre: string
  precio_mensual_mxn: number
  tipo: string
  incremento_doctores: number
  incremento_usuarios: number
  incremento_recordatorios: number
  cantidad: number
  fecha_contratacion: string
  prorrateo_mxn: number | null
}

export type DatosAddons = {
  catalogo: AddonCatalogo[]
  contratados: AddonContratado[]
  total_mensual_addons: number
  limite_efectivo_doctores: number
  limite_efectivo_usuarios: number
  limite_efectivo_recordatorios: number
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

async function resolverContexto() {
  const clinicaId = await resolverClinicaId()
  const db = createServerClient()

  const { data: clinica } = await db
    .from("clinicas")
    .select("cuenta_id")
    .eq("id", clinicaId)
    .single()

  const cuentaId = clinica?.cuenta_id ?? ""

  const { data: sus } = await db
    .from("suscripciones")
    .select(`
      id, estado, plan_id, inicio_periodo, fin_periodo, mp_subscription_id,
      planes!plan_id(precio_mensual_mxn, max_doctores, max_usuarios, max_recordatorios_mes)
    `)
    .eq("cuenta_id", cuentaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  return { db, cuentaId, sus }
}

/** Calcula el total mensual = plan + todos los add-ons activos */
async function calcularTotalMensual(susId: string, db: ReturnType<typeof createServerClient>): Promise<number> {
  const { data: susRow } = await db
    .from("suscripciones")
    .select("plan_id, planes!plan_id(precio_mensual_mxn)")
    .eq("id", susId)
    .single()

  const planPrecio = Number((susRow?.planes as any)?.precio_mensual_mxn ?? 0)

  const { data: activos } = await (db as any)
    .from("suscripcion_addons")
    .select("cantidad, addons(precio_mensual_mxn)")
    .eq("suscripcion_id", susId)
    .eq("activo", true)

  const addonTotal = ((activos ?? []) as Array<{ cantidad: number; addons: { precio_mensual_mxn: string | number } | null }>)
    .reduce((sum, a) => sum + Number(a.addons?.precio_mensual_mxn ?? 0) * (a.cantidad ?? 1), 0)

  return planPrecio + addonTotal
}

/** Calcula el prorrateo informativo para los dias restantes del periodo */
function calcularProrrateo(precioMensual: number, inicioPeriodo: string | null, finPeriodo: string | null): number {
  if (!inicioPeriodo || !finPeriodo) return 0
  const inicio = new Date(inicioPeriodo + "T12:00:00")
  const fin    = new Date(finPeriodo   + "T12:00:00")
  const hoy    = new Date()
  const diasTotales    = Math.max((fin.getTime() - inicio.getTime()) / 86_400_000, 1)
  const diasRestantes  = Math.max((fin.getTime() - hoy.getTime())   / 86_400_000, 0)
  return Math.round((precioMensual / diasTotales) * diasRestantes * 100) / 100
}

// ---------------------------------------------------------------------------
// obtenerDatosAddons
// ---------------------------------------------------------------------------

export async function obtenerDatosAddons(): Promise<DatosAddons> {
  const { db, sus } = await resolverContexto()

  // Catalogo activo
  const { data: catalogoRaw } = await (db as any)
    .from("addons")
    .select("id, clave, nombre, descripcion, precio_mensual_mxn, tipo, incremento_doctores, incremento_usuarios, incremento_recordatorios")
    .eq("activo", true)
    .order("precio_mensual_mxn")

  const catalogo: AddonCatalogo[] = (catalogoRaw ?? []).map((a: any) => ({
    id:                         a.id,
    clave:                      a.clave,
    nombre:                     a.nombre,
    descripcion:                a.descripcion,
    precio_mensual_mxn:         Number(a.precio_mensual_mxn),
    tipo:                       a.tipo,
    incremento_doctores:        Number(a.incremento_doctores),
    incremento_usuarios:        Number(a.incremento_usuarios),
    incremento_recordatorios:   Number(a.incremento_recordatorios),
  }))

  // Add-ons contratados
  const contratados: AddonContratado[] = []
  let totalAddons = 0

  if (sus?.id) {
    const { data: contratadosRaw } = await (db as any)
      .from("suscripcion_addons")
      .select(`
        id, addon_id, cantidad, fecha_contratacion, prorrateo_mxn,
        addons(clave, nombre, precio_mensual_mxn, tipo, incremento_doctores, incremento_usuarios, incremento_recordatorios)
      `)
      .eq("suscripcion_id", sus.id)
      .eq("activo", true)
      .order("fecha_contratacion")

    for (const c of (contratadosRaw ?? []) as any[]) {
      const precio = Number(c.addons?.precio_mensual_mxn ?? 0)
      totalAddons += precio * (c.cantidad ?? 1)
      contratados.push({
        id:                       c.id,
        addon_id:                 c.addon_id,
        clave:                    c.addons?.clave ?? "",
        nombre:                   c.addons?.nombre ?? "",
        precio_mensual_mxn:       precio,
        tipo:                     c.addons?.tipo ?? "",
        incremento_doctores:      Number(c.addons?.incremento_doctores ?? 0),
        incremento_usuarios:      Number(c.addons?.incremento_usuarios ?? 0),
        incremento_recordatorios: Number(c.addons?.incremento_recordatorios ?? 0),
        cantidad:                 Number(c.cantidad ?? 1),
        fecha_contratacion:       c.fecha_contratacion,
        prorrateo_mxn:            c.prorrateo_mxn !== null ? Number(c.prorrateo_mxn) : null,
      })
    }
  }

  // Limites efectivos
  const plan = (sus?.planes as any) ?? {}
  const planMaxDoctores      = Number(plan.max_doctores ?? 0)
  const planMaxUsuarios      = Number(plan.max_usuarios ?? 0)
  const planMaxRecordatorios = Number(plan.max_recordatorios_mes ?? 0)

  const extraDoctores      = contratados.filter(a => a.tipo === "doctor").reduce((s, a) => s + a.incremento_doctores * a.cantidad, 0)
  const extraUsuarios      = contratados.filter(a => a.tipo === "usuario").reduce((s, a) => s + a.incremento_usuarios * a.cantidad, 0)
  const extraRecordatorios = contratados.filter(a => a.tipo === "recordatorios").reduce((s, a) => s + a.incremento_recordatorios * a.cantidad, 0)

  return {
    catalogo,
    contratados,
    total_mensual_addons:           totalAddons,
    limite_efectivo_doctores:       planMaxDoctores + extraDoctores,
    limite_efectivo_usuarios:       planMaxUsuarios + extraUsuarios,
    limite_efectivo_recordatorios:  planMaxRecordatorios + extraRecordatorios,
  }
}

// ---------------------------------------------------------------------------
// contratarAddon
// ---------------------------------------------------------------------------

export async function contratarAddon(addonId: string): Promise<{ ok: boolean; mensaje: string }> {
  const { db, sus } = await resolverContexto()

  if (!sus) return { ok: false, mensaje: "No se encontro la suscripcion activa." }
  if (!["prueba", "activa"].includes(sus.estado)) {
    return { ok: false, mensaje: "Solo puedes contratar add-ons con una suscripcion activa o en prueba." }
  }

  // Obtener el add-on del catalogo
  const { data: addon } = await (db as any)
    .from("addons")
    .select("id, clave, nombre, precio_mensual_mxn, tipo, incremento_doctores, incremento_usuarios, incremento_recordatorios")
    .eq("id", addonId)
    .eq("activo", true)
    .single()

  if (!addon) return { ok: false, mensaje: "Add-on no disponible." }

  // Verificar si ya existe un registro activo del mismo add-on
  const { data: existente } = await (db as any)
    .from("suscripcion_addons")
    .select("id, cantidad")
    .eq("suscripcion_id", sus.id)
    .eq("addon_id", addonId)
    .eq("activo", true)
    .maybeSingle()

  const prorrateo = calcularProrrateo(
    Number(addon.precio_mensual_mxn),
    sus.inicio_periodo ?? null,
    sus.fin_periodo ?? null,
  )

  if (existente) {
    // Incrementar cantidad
    await (db as any)
      .from("suscripcion_addons")
      .update({ cantidad: (existente.cantidad ?? 1) + 1 })
      .eq("id", existente.id)
  } else {
    // Crear nuevo registro
    await (db as any)
      .from("suscripcion_addons")
      .insert({
        suscripcion_id:    sus.id,
        addon_id:          addonId,
        cantidad:          1,
        fecha_contratacion: new Date().toISOString().slice(0, 10),
        prorrateo_mxn:     prorrateo > 0 ? prorrateo : null,
      })
  }

  // Actualizar monto en Mercado Pago si hay suscripcion activa
  const mpId = (sus as any).mp_subscription_id as string | null
  if (sus.estado === "activa" && mpId) {
    try {
      const nuevoTotal = await calcularTotalMensual(sus.id, db)
      await mpPut(
        `/preapproval/${mpId}`,
        { auto_recurring: { transaction_amount: nuevoTotal } },
        `addon-add-${sus.id}-${addonId}`,
      )
    } catch {
      // No bloquear si falla la actualizacion en MP; el cambio queda en BD
    }
  }

  return { ok: true, mensaje: `Add-on "${addon.nombre}" contratado correctamente.` }
}

// ---------------------------------------------------------------------------
// quitarAddon
// ---------------------------------------------------------------------------

export async function quitarAddon(suscripcionAddonId: string): Promise<{ ok: boolean; mensaje: string }> {
  const { db, sus } = await resolverContexto()

  if (!sus) return { ok: false, mensaje: "No se encontro la suscripcion activa." }

  // Verificar que el registro pertenece a esta suscripcion
  const { data: registro } = await (db as any)
    .from("suscripcion_addons")
    .select("id, suscripcion_id, addon_id, cantidad, addons(nombre, tipo, incremento_doctores, incremento_usuarios)")
    .eq("id", suscripcionAddonId)
    .eq("suscripcion_id", sus.id)
    .eq("activo", true)
    .maybeSingle()

  if (!registro) return { ok: false, mensaje: "Add-on no encontrado." }

  const addon = (registro as any).addons as any

  // Validar que al quitar no quede por debajo del limite actual
  // (por ejemplo, si tiene mas doctores activos que los que permite el plan sin el addon)
  if (addon?.tipo === "doctor") {
    const planMaxDoctores = Number((sus?.planes as any)?.max_doctores ?? 0)
    const { data: otrosAddons } = await (db as any)
      .from("suscripcion_addons")
      .select("cantidad, addons(incremento_doctores)")
      .eq("suscripcion_id", sus.id)
      .eq("activo", true)
      .neq("id", suscripcionAddonId)
    const extraOtros = ((otrosAddons ?? []) as any[]).reduce(
      (s: number, a: any) => s + Number(a.addons?.incremento_doctores ?? 0) * (a.cantidad ?? 1), 0
    )
    const limiteEfectivo = planMaxDoctores + extraOtros

    const clinicaId = await resolverClinicaId()
    const { count: doctoresActivos } = await db
      .from("membresias")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", clinicaId)
      .eq("rol", "doctor")
      .eq("activa", true)

    if ((doctoresActivos ?? 0) > limiteEfectivo) {
      return {
        ok: false,
        mensaje: `No puedes quitar este add-on porque tienes ${doctoresActivos} doctor(es) activos y el plan sin este add-on solo permite ${limiteEfectivo}. Desactiva un doctor primero.`,
      }
    }
  }

  // Desactivar el registro (no eliminar para conservar historial)
  await (db as any)
    .from("suscripcion_addons")
    .update({ activo: false })
    .eq("id", suscripcionAddonId)

  // Actualizar monto en Mercado Pago
  const mpId = (sus as any).mp_subscription_id as string | null
  if (sus.estado === "activa" && mpId) {
    try {
      const nuevoTotal = await calcularTotalMensual(sus.id, db)
      await mpPut(
        `/preapproval/${mpId}`,
        { auto_recurring: { transaction_amount: nuevoTotal } },
        `addon-remove-${sus.id}-${suscripcionAddonId}`,
      )
    } catch {
      // No bloquear si falla en MP
    }
  }

  return { ok: true, mensaje: `Add-on "${addon?.nombre ?? ""}" cancelado. El cambio aplica al proximo ciclo.` }
}
