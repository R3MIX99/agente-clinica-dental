import { randomBytes } from "crypto"

// Dias de vigencia de una contraseña temporal antes de que el login la rechace.
export const DIAS_VIGENCIA_PASSWORD_TEMPORAL = 3

// Genera una contraseña temporal aleatoria (no una fija compartida entre usuarios).
export function generarPasswordTemporal(): string {
  const bytes = randomBytes(6).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)
  return `Dental-${bytes}`
}

// true si una contraseña temporal ya vencio segun su fecha de creacion.
// Cuentas antiguas sin `creadaAtIso` registrado no se bloquean retroactivamente.
export function passwordTemporalExpirada(creadaAtIso: string | undefined | null): boolean {
  if (!creadaAtIso) return false
  const creada = new Date(creadaAtIso).getTime()
  if (Number.isNaN(creada)) return false
  const limite = creada + DIAS_VIGENCIA_PASSWORD_TEMPORAL * 24 * 60 * 60 * 1000
  return Date.now() > limite
}
