import "server-only"
import { randomBytes } from "crypto"
import { createServerClient } from "@/lib/supabase/server"

// secret_token de Telegram: 1-256 caracteres en [A-Za-z0-9_-].
// Telegram lo reenvia en el header X-Telegram-Bot-Api-Secret-Token de cada update,
// y n8n lo usa para resolver a que clinica pertenece el bot.
export function generarSecretToken(): string {
  return randomBytes(24).toString("hex")
}

export type ResultadoTelegram = {
  ok: boolean
  error?: string
  botUsername?: string | null
}

// Conecta (o reconecta) el bot de Telegram de una clinica:
//   1. Valida el token contra getMe.
//   2. Reutiliza o genera el secret_token de la clinica.
//   3. Registra el webhook del bot hacia n8n con ese secret_token.
//   4. Guarda token + secret_token en clinic_channels (config jsonb) y activa el canal.
// El bot_token nunca sale del servidor ni se versiona.
export async function conectarTelegramBot(
  clinicaId: string,
  botTokenRaw: string,
): Promise<ResultadoTelegram> {
  const token = botTokenRaw.trim()
  if (!token) return { ok: false, error: "El token del bot esta vacio." }

  const inboundUrl = process.env.N8N_TELEGRAM_INBOUND_URL
  if (!inboundUrl) {
    return { ok: false, error: "Falta configurar N8N_TELEGRAM_INBOUND_URL en el servidor." }
  }

  // 1. Validar token
  let botUsername: string | null = null
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const me = await meRes.json()
    if (!me.ok) {
      return { ok: false, error: "Token de bot invalido. Revisa el token que te dio BotFather." }
    }
    botUsername = me.result?.username ?? null
  } catch {
    return { ok: false, error: "No se pudo contactar a Telegram para validar el token." }
  }

  const db = createServerClient()

  // 2. Reutilizar secret_token si la clinica ya tenia uno
  const { data: canalExistente } = await db
    .from("clinic_channels")
    .select("config")
    .eq("clinica_id", clinicaId)
    .eq("canal", "telegram")
    .maybeSingle()

  const secretToken =
    (canalExistente?.config as { secret_token?: string } | null)?.secret_token ||
    generarSecretToken()

  // 3. Registrar webhook en Telegram
  try {
    const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: inboundUrl,
        secret_token: secretToken,
        allowed_updates: ["message"],
      }),
    })
    const set = await setRes.json()
    if (!set.ok) {
      return {
        ok: false,
        error: "Telegram rechazo el webhook: " + (set.description ?? "error desconocido"),
      }
    }
  } catch {
    return { ok: false, error: "No se pudo registrar el webhook en Telegram." }
  }

  // 4. Guardar en clinic_channels (upsert por clinica + canal)
  const config = {
    bot_token: token,
    secret_token: secretToken,
    bot_username: botUsername,
  }
  const { error } = await db
    .from("clinic_channels")
    .upsert(
      {
        clinica_id: clinicaId,
        canal: "telegram",
        activo: true,
        config,
        webhook_url: inboundUrl,
      } as never,
      { onConflict: "clinica_id,canal" },
    )
  if (error) return { ok: false, error: error.message }

  return { ok: true, botUsername }
}

// Indica si una clinica ya tiene su canal de Telegram conectado (token + activo).
export async function telegramConectado(clinicaId: string): Promise<boolean> {
  const db = createServerClient()
  const { data } = await db
    .from("clinic_channels")
    .select("activo, config")
    .eq("clinica_id", clinicaId)
    .eq("canal", "telegram")
    .maybeSingle()
  const cfg = data?.config as { bot_token?: string } | null
  return !!data?.activo && !!cfg?.bot_token
}
