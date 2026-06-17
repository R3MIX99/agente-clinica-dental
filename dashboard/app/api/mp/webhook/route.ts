import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { mpGet, validarFirmaWebhook, type MpPreapproval, type MpPayment } from "@/lib/mercadopago"

// Días de gracia por defecto si no esta en config_sistema
const DIAS_GRACIA_DEFAULT = 3

// ---------------------------------------------------------------------------
// POST /api/mp/webhook
// Recibe notificaciónes de Mercado Pago y actualiza el estado de suscripciones.
// Referencia: https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Validar firma del webhook
  const xSignature = req.headers.get("x-signature") ?? ""
  const xRequestId = req.headers.get("x-request-id") ?? ""

  let body: { data?: { id?: string }; type?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo invalido" }, { status: 400 })
  }

  const dataId = body?.data?.id ?? ""

  // Validar solo si el secret esta configurado (en dev puede estar ausente)
  if (process.env.MP_WEBHOOK_SECRET) {
    const firmaValida = await validarFirmaWebhook(xSignature, xRequestId, dataId)
    if (!firmaValida) {
      return NextResponse.json({ error: "Firma invalida" }, { status: 401 })
    }
  }

  const tipo = body?.type

  // 2. Procesar segun el tipo de notificación
  if (tipo === "preapproval") {
    await procesarPreapproval(dataId)
  } else if (tipo === "payment") {
    await procesarPago(dataId)
  }
  // Otros tipos (subscription_authorized_payment, etc.) se ignoran por ahora

  // MP requiere 200 para no reintentar
  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------
// Procesar evento de suscripción (preapproval)
// ---------------------------------------------------------------------------

async function procesarPreapproval(preapprovalId: string): Promise<void> {
  if (!preapprovalId) return
  const db = createServerClient()

  let preapproval: MpPreapproval
  try {
    preapproval = await mpGet<MpPreapproval>(`/preapproval/${preapprovalId}`)
  } catch {
    return
  }

  // Buscar la suscripción por el ID del preapproval de MP
  const { data: sus } = await db
    .from("suscripciones")
    .select("id, cuenta_id, estado, plan_id")
    .eq("mp_subscription_id" as any, preapprovalId)
    .maybeSingle()

  if (!sus) return

  const estadoActual = sus.estado as string

  // Solo procesamos transiciones definitivas; "pending" no toca nada
  if (preapproval.status === "pending") return

  if (preapproval.status === "authorized") {
    // Pago confirmado: activar y aplicar el plan del external_reference
    const partes      = (preapproval.external_reference ?? "").split("_plan_")
    const planIdNuevo = partes.length > 1 ? partes[partes.length - 1] : sus.plan_id

    const { data: planData } = await db
      .from("planes")
      .select("saldo_ia_incluido_mxn")
      .eq("id", planIdNuevo)
      .maybeSingle()
    const saldoNuevo = planData ? Number(planData.saldo_ia_incluido_mxn) : undefined

    const hoy = new Date()
    const fin  = new Date(hoy)
    fin.setMonth(fin.getMonth() + 1)

    await db
      .from("suscripciones")
      .update({
        estado:                 "activa",
        plan_id:                planIdNuevo,
        mp_last_payment_status: "authorized",
        mp_next_payment_date:   preapproval.next_payment_date?.slice(0, 10) ?? null,
        periodo_gracia_fin:     null,
        inicio_periodo:         hoy.toISOString().slice(0, 10),
        fin_periodo:            fin.toISOString().slice(0, 10),
        ...(saldoNuevo !== undefined ? { saldo_ia_disponible_mxn: saldoNuevo } : {}),
      } as any)
      .eq("id", sus.id)

  } else if (preapproval.status === "paused" || preapproval.status === "cancelled") {
    // Solo suspender/cancelar si ya estaba activa (no afectar cuentas en prueba)
    if (estadoActual === "activa") {
      const nuevoEstado = preapproval.status === "paused" ? "suspendida" : "cancelada"
      await db
        .from("suscripciones")
        .update({
          estado:                 nuevoEstado,
          mp_last_payment_status: preapproval.status,
          mp_next_payment_date:   null,
        } as any)
        .eq("id", sus.id)
    }
  }

  // Registrar en historial siempre
  await db.from("historial_pagos" as any).insert({
    suscripcion_id:    sus.id,
    cuenta_id:         sus.cuenta_id,
    mp_preapproval_id: preapprovalId,
    status:            preapproval.status,
    concepto:          `Suscripción webhook: ${preapproval.status}`,
  })
}

// ---------------------------------------------------------------------------
// Procesar evento de pago individual
// ---------------------------------------------------------------------------

async function procesarPago(paymentId: string): Promise<void> {
  if (!paymentId) return
  const db = createServerClient()

  let pago: MpPayment
  try {
    pago = await mpGet<MpPayment>(`/v1/payments/${paymentId}`)
  } catch {
    return
  }

  // Buscar la suscripción por el preapproval_id del pago
  const mpPreapprovalId = pago.preapproval_id ?? pago.subscription_id
  if (!mpPreapprovalId) return

  const { data: sus } = await db
    .from("suscripciones")
    .select("id, cuenta_id, estado")
    .eq("mp_subscription_id" as any, mpPreapprovalId)
    .maybeSingle()

  if (!sus) return

  const pagoAprobado = pago.status === "approved"
  const pagoFallido  = pago.status === "rejected" || pago.status === "cancelled" || pago.status === "charged_back"

  if (pagoAprobado) {
    // Pago exitoso: activar suscripción y limpiar periodo de gracia
    const ahora = new Date()
    const finPeriodo = new Date(ahora)
    finPeriodo.setMonth(finPeriodo.getMonth() + 1)

    await db
      .from("suscripciones")
      .update({
        estado:                 "activa",
        mp_last_payment_status: "approved",
        periodo_gracia_fin:     null,
        inicio_periodo:         ahora.toISOString().slice(0, 10),
        fin_periodo:            finPeriodo.toISOString().slice(0, 10),
      } as any)
      .eq("id", sus.id)

  } else if (pagoFallido && sus.estado === "activa") {
    // Primer fallo de pago: entrar al periodo de gracia
    const { data: configRow } = await db
      .from("config_sistema")
      .select("valor")
      .eq("clave", "mp_dias_gracia")
      .maybeSingle()

    const diasGracia = Number(configRow?.valor ?? DIAS_GRACIA_DEFAULT)
    const graciafin  = new Date()
    graciafin.setDate(graciafin.getDate() + diasGracia)

    await db
      .from("suscripciones")
      .update({
        estado:                 "pago_pendiente",
        mp_last_payment_status: pago.status,
        periodo_gracia_fin:     graciafin.toISOString(),
      } as any)
      .eq("id", sus.id)
  }

  // Registrar en historial
  await db.from("historial_pagos" as any).insert({
    suscripcion_id:    sus.id,
    cuenta_id:         sus.cuenta_id,
    mp_payment_id:     String(pago.id),
    mp_preapproval_id: mpPreapprovalId,
    status:            pago.status,
    monto_mxn:         pago.transaction_amount,
    concepto:          `Pago ${pago.status}`,
  })
}
