"use server"

import { createServerClient } from "@/lib/supabase/server"
import { createAuthClient, resolverClinicaId } from "@/lib/supabase/server-auth"
import { mpGet, mpPost, mpPut, type MpPreapproval } from "@/lib/mercadopago"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type EstadoSuscripcion =
  | "prueba"
  | "activa"
  | "pago_pendiente"
  | "vencida"
  | "suspendida"
  | "cancelada"

export type DatosFacturacion = {
  plan: {
    id: string
    nombre: string
    precio_mensual_mxn: number
  }
  suscripcion: {
    id: string
    estado: EstadoSuscripcion
    periodo: string
    inicio_periodo: string | null
    fin_periodo: string | null
    mp_subscription_id: string | null
    mp_payer_email: string | null
    mp_next_payment_date: string | null
    mp_last_payment_status: string | null
    periodo_gracia_fin: string | null
  }
  historial: Array<{
    id: string
    created_at: string
    status: string
    monto_mxn: number | null
    concepto: string | null
    mp_payment_id: string | null
  }>
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

async function resolverCuentaId(): Promise<{ clinicaId: string; cuentaId: string }> {
  const clinicaId = await resolverClinicaId()
  const db = createServerClient()
  const { data } = await db
    .from("clinicas")
    .select("cuenta_id")
    .eq("id", clinicaId)
    .single()
  return { clinicaId, cuentaId: data?.cuenta_id ?? "" }
}

async function resolverSuscripcionActual(cuentaId: string) {
  const db = createServerClient()
  const { data } = await db
    .from("suscripciones")
    .select(`
      id, estado, periodo, inicio_periodo, fin_periodo,
      mp_subscription_id, mp_payer_email, mp_next_payment_date,
      mp_last_payment_status, periodo_gracia_fin, plan_id,
      planes(id, nombre, precio_mensual_mxn)
    `)
    .eq("cuenta_id", cuentaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()
  return data
}

// ---------------------------------------------------------------------------
// obtenerFacturacion
// ---------------------------------------------------------------------------

export async function obtenerFacturacion(): Promise<DatosFacturacion> {
  const { cuentaId } = await resolverCuentaId()
  const db = createServerClient()

  const sus = await resolverSuscripcionActual(cuentaId)

  // Verificar si el periodo de gracia expiro
  if (
    sus?.estado === "pago_pendiente" &&
    sus.periodo_gracia_fin &&
    new Date(sus.periodo_gracia_fin) < new Date()
  ) {
    await db
      .from("suscripciones")
      .update({ estado: "suspendida" } as any)
      .eq("id", sus.id)
    ;(sus as any).estado = "suspendida"
  }

  const plan = (sus?.planes as any) ?? { id: "", nombre: "Sin plan", precio_mensual_mxn: 0 }

  // Historial de los ultimos 10 pagos
  const { data: historial } = await db
    .from("historial_pagos")
    .select("id, created_at, status, monto_mxn, concepto, mp_payment_id")
    .eq("cuenta_id", cuentaId)
    .order("created_at", { ascending: false })
    .limit(10)

  return {
    plan: {
      id:                 plan.id,
      nombre:             plan.nombre,
      precio_mensual_mxn: Number(plan.precio_mensual_mxn ?? 0),
    },
    suscripcion: {
      id:                    sus?.id ?? "",
      estado:                (sus?.estado ?? "prueba") as EstadoSuscripcion,
      periodo:               sus?.periodo ?? "mensual",
      inicio_periodo:        sus?.inicio_periodo ?? null,
      fin_periodo:           sus?.fin_periodo ?? null,
      mp_subscription_id:    (sus as any)?.mp_subscription_id ?? null,
      mp_payer_email:        (sus as any)?.mp_payer_email ?? null,
      mp_next_payment_date:  (sus as any)?.mp_next_payment_date ?? null,
      mp_last_payment_status:(sus as any)?.mp_last_payment_status ?? null,
      periodo_gracia_fin:    (sus as any)?.periodo_gracia_fin ?? null,
    },
    historial: (historial ?? []).map((h) => ({
      id:             h.id,
      created_at:     h.created_at,
      status:         h.status,
      monto_mxn:      h.monto_mxn !== null ? Number(h.monto_mxn) : null,
      concepto:       h.concepto,
      mp_payment_id:  h.mp_payment_id,
    })),
  }
}

// ---------------------------------------------------------------------------
// iniciarCheckout — crea el preapproval en MP y retorna la URL de pago
// ---------------------------------------------------------------------------

export async function iniciarCheckout(planId: string): Promise<{ url: string }> {
  const { cuentaId } = await resolverCuentaId()
  const db = createServerClient()
  const auth = await createAuthClient()

  const { data: { user } } = await auth.auth.getUser()
  const email = user?.email ?? ""

  // Datos del plan
  const { data: plan } = await db
    .from("planes")
    .select("nombre, precio_mensual_mxn")
    .eq("id", planId)
    .single()

  if (!plan) throw new Error("Plan no encontrado")

  // Suscripcion activa del cuenta
  const sus = await resolverSuscripcionActual(cuentaId)
  if (!sus) throw new Error("Suscripcion no encontrada")

  // Si ya existe un preapproval pendiente en MP, cancelarlo antes de crear uno nuevo
  const mpIdAnterior = (sus as any).mp_subscription_id as string | null
  if (mpIdAnterior) {
    try {
      const actual = await mpGet<MpPreapproval>(`/preapproval/${mpIdAnterior}`)
      if (actual.status === "pending") {
        await mpPut(`/preapproval/${mpIdAnterior}`, { status: "cancelled" }, `cancel-${mpIdAnterior}`)
      }
    } catch {
      // Si el preapproval no existe en MP, continuar normalmente
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002"

  const preapproval = await mpPost<MpPreapproval>(
    "/preapproval",
    {
      reason:             `Plan ${plan.nombre} - Agente Dental`,
      external_reference: `cuenta_${cuentaId}`,
      payer_email:        email,
      auto_recurring: {
        frequency:          1,
        frequency_type:     "months",
        transaction_amount: Number(plan.precio_mensual_mxn),
        currency_id:        "MXN",
      },
      back_url: `${appUrl}/facturacion/resultado`,
      status:   "pending",
    },
    `checkout-${cuentaId}-${planId}`
  )

  // Guardar el nuevo preapproval ID y actualizar el plan
  await db
    .from("suscripciones")
    .update({
      mp_subscription_id: preapproval.id,
      mp_payer_email:     email,
      plan_id:            planId,
    } as any)
    .eq("id", sus.id)

  return { url: preapproval.init_point }
}

// ---------------------------------------------------------------------------
// confirmarCheckout — verifica el preapproval tras regresar de MP
// ---------------------------------------------------------------------------

export async function confirmarCheckout(preapprovalId: string): Promise<{
  estado: EstadoSuscripcion
  mensaje: string
}> {
  const db = createServerClient()

  // Buscar suscripcion por mp_subscription_id
  const { data: sus } = await db
    .from("suscripciones")
    .select("id, cuenta_id, plan_id, estado")
    .eq("mp_subscription_id" as any, preapprovalId)
    .maybeSingle()

  if (!sus) {
    return { estado: "pago_pendiente", mensaje: "No se encontro la suscripcion asociada al pago." }
  }

  // Consultar estado del preapproval en MP
  let preapproval: MpPreapproval
  try {
    preapproval = await mpGet<MpPreapproval>(`/preapproval/${preapprovalId}`)
  } catch {
    return { estado: sus.estado as EstadoSuscripcion, mensaje: "No se pudo verificar el estado del pago. Intenta en unos momentos." }
  }

  // Mapear estado de MP a nuestro estado
  const mapaEstado: Record<string, EstadoSuscripcion> = {
    authorized: "activa",
    paused:     "suspendida",
    cancelled:  "cancelada",
    pending:    "pago_pendiente",
  }
  const nuevoEstado: EstadoSuscripcion = mapaEstado[preapproval.status] ?? "pago_pendiente"

  // Calcular inicio y fin de periodo
  const hoy   = new Date()
  const fin   = new Date(hoy)
  fin.setMonth(fin.getMonth() + 1)

  await db
    .from("suscripciones")
    .update({
      estado:                nuevoEstado,
      mp_payer_email:        preapproval.payer_email,
      mp_next_payment_date:  preapproval.next_payment_date?.slice(0, 10) ?? null,
      mp_last_payment_status: preapproval.status,
      inicio_periodo:        hoy.toISOString().slice(0, 10),
      fin_periodo:           fin.toISOString().slice(0, 10),
      periodo_gracia_fin:    null,
    } as any)
    .eq("id", sus.id)

  // Registrar en historial
  if (nuevoEstado === "activa") {
    await db.from("historial_pagos" as any).insert({
      suscripcion_id:    sus.id,
      cuenta_id:         sus.cuenta_id,
      mp_preapproval_id: preapprovalId,
      status:            "authorized",
      concepto:          "Suscripcion activada",
    })
  }

  const mensajes: Record<EstadoSuscripcion, string> = {
    activa:        "Suscripcion activada correctamente. Ya puedes usar todas las funciones de tu plan.",
    pago_pendiente:"El pago esta pendiente de autorizacion. Revisa tu cuenta de Mercado Pago.",
    suspendida:    "La suscripcion ha sido suspendida.",
    cancelada:     "La suscripcion fue cancelada.",
    prueba:        "Continuas en periodo de prueba.",
    vencida:       "La suscripcion ha vencido.",
  }

  return { estado: nuevoEstado, mensaje: mensajes[nuevoEstado] }
}

// ---------------------------------------------------------------------------
// cancelarSuscripcion
// ---------------------------------------------------------------------------

export async function cancelarSuscripcion(): Promise<{ ok: boolean; mensaje: string }> {
  const { cuentaId } = await resolverCuentaId()
  const db = createServerClient()

  const sus = await resolverSuscripcionActual(cuentaId)
  if (!sus) return { ok: false, mensaje: "Suscripcion no encontrada." }

  const mpId = (sus as any).mp_subscription_id as string | null

  // Cancelar en MP si existe el preapproval
  if (mpId) {
    try {
      await mpPut(`/preapproval/${mpId}`, { status: "cancelled" }, `cancel-sub-${sus.id}`)
    } catch {
      // Si falla en MP, continuamos cancelando localmente
    }
  }

  await db
    .from("suscripciones")
    .update({
      estado:             "cancelada",
      mp_last_payment_status: "cancelled",
    } as any)
    .eq("id", sus.id)

  await db.from("historial_pagos" as any).insert({
    suscripcion_id:    sus.id,
    cuenta_id:         cuentaId,
    mp_preapproval_id: mpId,
    status:            "cancelled",
    concepto:          "Suscripcion cancelada por el usuario",
  })

  return { ok: true, mensaje: "Suscripcion cancelada. Tus datos se conservan intactos." }
}

// ---------------------------------------------------------------------------
// verificarGraciaSuscripcion — llamado por el layout para aplicar suspension
// ---------------------------------------------------------------------------

export async function verificarGraciaSuscripcion(susId: string): Promise<void> {
  const db = createServerClient()
  await db
    .from("suscripciones")
    .update({ estado: "suspendida" } as any)
    .eq("id", susId)
    .eq("estado", "pago_pendiente")
    .lt("periodo_gracia_fin" as any, new Date().toISOString())
}
