// Cliente de la API de Mercado Pago — solo uso server-side.
// Nunca importar desde componentes cliente ni exponer el access token al navegador.

const MP_BASE = "https://api.mercadopago.com"

function accessToken(): string {
  const t = process.env.MP_ACCESS_TOKEN
  if (!t) throw new Error("MP_ACCESS_TOKEN no esta configurado")
  return t
}

function mpHeaders(idempotencyKey?: string): HeadersInit {
  const h: HeadersInit = {
    Authorization: `Bearer ${accessToken()}`,
    "Content-Type": "application/json",
  }
  if (idempotencyKey) {
    (h as Record<string, string>)["X-Idempotency-Key"] = idempotencyKey
  }
  return h
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function mpGet<T>(path: string): Promise<T> {
  const res = await fetch(`${MP_BASE}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken()}` },
    cache: "no-store",
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    throw new Error(`MP GET ${path} → ${res.status}: ${txt}`)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function mpPost<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`${MP_BASE}${path}`, {
    method: "POST",
    headers: mpHeaders(idempotencyKey),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    throw new Error(`MP POST ${path} → ${res.status}: ${txt}`)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------

export async function mpPut<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
  const res = await fetch(`${MP_BASE}${path}`, {
    method: "PUT",
    headers: mpHeaders(idempotencyKey),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    throw new Error(`MP PUT ${path} → ${res.status}: ${txt}`)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Tipos de respuesta de MP
// ---------------------------------------------------------------------------

export type MpPreapproval = {
  id: string
  status: "pending" | "authorized" | "paused" | "cancelled"
  reason: string
  external_reference: string
  payer_email: string
  next_payment_date?: string
  last_modified?: string
  init_point: string
  auto_recurring?: {
    frequency: number
    frequency_type: string
    transaction_amount: number
    currency_id: string
  }
}

export type MpPayment = {
  id: number
  status: "pending" | "approved" | "authorized" | "in_process" | "in_mediation" | "rejected" | "cancelled" | "refunded" | "charged_back"
  status_detail: string
  transaction_amount: number
  currency_id: string
  preapproval_id?: string
  subscription_id?: string
  external_reference?: string
  date_created: string
}

// ---------------------------------------------------------------------------
// Validacion de la firma del webhook
// ---------------------------------------------------------------------------

// Mercado Pago envia el header x-signature con el formato:
//   ts=1234567890,v1=abc123...
// El HMAC se calcula sobre: id:{data.id};request-id:{x-request-id};ts:{ts};
export async function validarFirmaWebhook(
  xSignature: string,
  xRequestId: string,
  dataId: string,
): Promise<boolean> {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return false

  const partes: Record<string, string> = {}
  for (const parte of xSignature.split(",")) {
    const [k, v] = parte.split("=")
    if (k && v) partes[k.trim()] = v.trim()
  }

  const ts = partes["ts"]
  const v1 = partes["v1"]
  if (!ts || !v1) return false

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`

  // Usar Web Crypto API (disponible en Edge y Node)
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(manifest))
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  return hex === v1
}
