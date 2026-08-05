// Helpers de fecha/hora para el asistente de IA — todo el calculo de
// "hoy", dia de la semana y conversion UTC <-> hora de Ciudad de Mexico
// vive aqui, en codigo determinista. El modelo (Claude) nunca debe
// convertir zonas horarias ni calcular dias de la semana por su cuenta:
// solo debe repetir los textos ya formateados que le devuelven las tools.

// Un ISO sin "Z" ni offset explicito (ej. el modelo mandando "2026-08-05T16:00:00"
// como si fuera la hora local de Mexico) es ambiguo: `new Date(...)` lo
// interpreta como hora LOCAL DEL SERVIDOR (UTC en Vercel), corriendo la cita
// 6 horas sin ningun error. Mejor rechazarlo que adivinar.
export function tieneZonaHorariaExplicita(iso: string): boolean {
  return /Z$|[+-]\d{2}:?\d{2}$/.test(iso)
}

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

export function mexLocalToISO(localStr: string): string {
  const asUTC = new Date(localStr + "Z")
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(asUTC)
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0")
  const mexAsUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"))
  const offsetMs = asUTC.getTime() - mexAsUTC
  return new Date(asUTC.getTime() + offsetMs).toISOString()
}

export function isoToMexLocalParts(iso: string): {
  year: number; month: number; day: number; hour: number; minute: number
} {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0")
  return {
    year: get("year"), month: get("month"), day: get("day"),
    hour: get("hour"), minute: get("minute"),
  }
}

// Fecha de "hoy" segun el calendario de Ciudad de Mexico — NUNCA usar
// new Date().getUTCFullYear()/etc para esto, porque el dia calendario en
// UTC puede ser distinto al dia calendario en Mexico (desfase de horas).
export function hoyMexico(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date())
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0")
  return { year: get("year"), month: get("month"), day: get("day") }
}

export function sumarDiasCalendario(
  base: { year: number; month: number; day: number },
  dias: number
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(base.year, base.month - 1, base.day + dias))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

// Dia de la semana (0=domingo..6=sabado) de una fecha Y-M-D, calculado a
// mediodia UTC para no cruzar de dia por el offset.
export function diaSemanaMex(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
}

function formatHora12(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  const ampm = hour < 12 ? "a.m." : "p.m."
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`
}

// Convierte un ISO (UTC, tal como se guarda en Supabase) a texto en
// espanol, hora de Ciudad de Mexico — listo para que el modelo lo use
// textualmente sin necesidad de convertir nada.
export function formatearFechaHoraMex(iso: string): {
  fecha_texto: string
  hora_texto: string
  dia_semana: string
} {
  const { year, month, day, hour, minute } = isoToMexLocalParts(iso)
  const diaSemana = diaSemanaMex(year, month, day)
  return {
    fecha_texto: `${DIAS[diaSemana]} ${day} de ${MESES[month - 1]} de ${year}`,
    hora_texto: formatHora12(hour, minute),
    dia_semana: DIAS[diaSemana],
  }
}

// Texto de "ahora" (fecha y hora actuales en Ciudad de Mexico) para
// inyectar en el system prompt del asistente, asi siempre sabe que dia es
// "hoy" sin tener que adivinarlo.
export function textoHoyMexicoCompleto(): string {
  const { year, month, day } = hoyMexico()
  const diaSemana = diaSemanaMex(year, month, day)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date())
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0")
  const horaTexto = formatHora12(get("hour"), get("minute"))
  return `${DIAS[diaSemana]} ${day} de ${MESES[month - 1]} de ${year}, ${horaTexto} (hora de Ciudad de Mexico)`
}
