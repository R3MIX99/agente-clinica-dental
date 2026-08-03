// Generador de contraseña temporal sugerida en el cliente (Web Crypto).
// Es solo una sugerencia editable por el superadmin — la validacion real
// (longitud minima, etc.) ocurre en el servidor.
export function generarPasswordSugerida(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)
  return `Dental-${b64}`
}
