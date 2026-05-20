export interface SendAgentMessagePayload {
  conversationId: string
  channel: "telegram" | "whatsapp"
  channelUserId: string
  texto: string
  agenteId: string
}

export async function sendAgentMessage(payload: SendAgentMessagePayload): Promise<void> {
  const webhookUrl = process.env.N8N_OUTBOUND_WEBHOOK_URL
  const secret = process.env.N8N_SHARED_SECRET

  if (!webhookUrl) throw new Error("N8N_OUTBOUND_WEBHOOK_URL no configurada")
  if (!secret) throw new Error("N8N_SHARED_SECRET no configurada")

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shared-Secret": secret,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`n8n respondio ${res.status}: ${body}`)
  }
}
