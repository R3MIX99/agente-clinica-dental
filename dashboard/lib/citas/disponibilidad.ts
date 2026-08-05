import { createServerClient } from "@/lib/supabase/server"
import {
  mexLocalToISO,
  isoToMexLocalParts,
  diaSemanaMex,
  hoyMexico,
  sumarDiasCalendario,
  formatearFechaHoraMex,
} from "@/lib/asistente/fecha"

function minutosATexto(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function horaATexto(hora: string): number {
  // "09:00:00" -> 540
  const [h, m] = hora.split(":").map(Number)
  return h * 60 + m
}

// ---------------------------------------------------------------------------
// Busqueda de disponibilidad
// ---------------------------------------------------------------------------

const DIAS_VENTANA = 10
const INTERVALO_MIN = 30
const MAX_SLOTS = 6
const MARGEN_MIN_DESDE_AHORA = 90 // no ofrecer horarios a menos de 90 min

export type SlotDisponible = {
  fecha_hora_iso: string
  fecha_texto: string
  hora_texto: string
  dia_semana: string
}

export type ResultadoDisponibilidad =
  | {
      ok: true
      doctor_id: string
      doctor_nombre: string
      fue_respaldo: boolean
      duracion_min: number
      slots: SlotDisponible[]
      hora_exacta_disponible: boolean
    }
  | { ok: false; motivo: "sin_doctor_asignado" | "sin_disponibilidad" | "paciente_no_encontrado" }

// Un parametro de n8n mal configurado (doble "=" al inicio de una
// expresion) puede llegar como "=2026-08-05" en vez de "2026-08-05" — se
// tolera aqui para no depender de que la expresion quede perfecta en n8n.
function limpiarValorTool(v?: string | null): string | null {
  if (!v) return null
  const limpio = v.replace(/^=+/, "").trim()
  return limpio || null
}

// Valida "YYYY-MM-DD" con una fecha real (evita que un mes/dia invalido del
// modelo, ej. 2026-02-30, se cuele silenciosamente).
function parseFechaDeseada(fechaDeseadaCruda?: string | null): { year: number; month: number; day: number } | null {
  const fechaDeseada = limpiarValorTool(fechaDeseadaCruda)
  if (!fechaDeseada || !/^\d{4}-\d{2}-\d{2}$/.test(fechaDeseada)) return null
  const [year, month, day] = fechaDeseada.split("-").map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return { year, month, day }
}

function esFechaPosterior(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number }
): boolean {
  return Date.UTC(a.year, a.month - 1, a.day) > Date.UTC(b.year, b.month - 1, b.day)
}

export async function buscarDisponibilidad(params: {
  clinicaId: string
  patientId: string
  servicioId?: string | null
  fechaDeseada?: string | null // "YYYY-MM-DD", tomada de la tabla de calendario del prompt
  horaDeseada?: string | null // "HH:MM" 24h
}): Promise<ResultadoDisponibilidad> {
  const { clinicaId, patientId, fechaDeseada, horaDeseada } = params
  const servicioId = limpiarValorTool(params.servicioId)
  const db = createServerClient()

  const [{ data: asignaciones }, { data: servicio }] = await Promise.all([
    db
      .from("patient_doctors")
      .select("doctor_id, orden, doctors(id, nombre)")
      .eq("clinica_id", clinicaId)
      .eq("patient_id", patientId)
      .order("orden"),
    servicioId
      ? db.from("services").select("duracion_min").eq("id", servicioId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!asignaciones || asignaciones.length === 0) {
    return { ok: false, motivo: "sin_doctor_asignado" }
  }

  const duracionMin = servicio?.duracion_min ?? 30

  const ahora = new Date()
  const hoy = hoyMexico()
  const fechaDeseadaParsed = parseFechaDeseada(fechaDeseada)
  // Si el paciente pidio un dia concreto, la busqueda arranca ahi (nunca
  // antes de hoy) para no devolver los primeros huecos genericos de hoy
  // cuando lo que se pidio fue, por ejemplo, "el jueves a las 4pm".
  const inicioVentana = fechaDeseadaParsed && esFechaPosterior(fechaDeseadaParsed, hoy) ? fechaDeseadaParsed : hoy
  const horaDeseadaLimpia = limpiarValorTool(horaDeseada)
  const horaDeseadaMin =
    horaDeseadaLimpia && /^\d{2}:\d{2}$/.test(horaDeseadaLimpia)
      ? horaATexto(horaDeseadaLimpia + ":00")
      : null
  const finVentanaIso = new Date(ahora.getTime() + (DIAS_VENTANA + 1) * 86_400_000).toISOString()
  const inicioVentanaIso = ahora.toISOString()

  for (let i = 0; i < asignaciones.length; i++) {
    const asignacion = asignaciones[i]
    const doctorId = asignacion.doctor_id
    const doctorNombre =
      (asignacion.doctors as { id: string; nombre: string } | null)?.nombre ?? "el doctor"

    const [{ data: horarios }, { data: citasOcupadas }, { data: bloqueos }] = await Promise.all([
      db.from("doctor_schedules").select("dia_semana, hora_inicio, hora_fin").eq("doctor_id", doctorId),
      db
        .from("appointments")
        .select("fecha_hora, duracion_min")
        .eq("doctor_id", doctorId)
        .in("status", ["programada", "confirmada"])
        .gte("fecha_hora", inicioVentanaIso)
        .lte("fecha_hora", finVentanaIso),
      db
        .from("bloqueos")
        .select("fecha, doctor_id, service_id")
        .eq("clinica_id", clinicaId)
        .gte("fecha", `${inicioVentana.year}-${String(inicioVentana.month).padStart(2, "0")}-${String(inicioVentana.day).padStart(2, "0")}`),
    ])

    if (!horarios || horarios.length === 0) continue // sin horario configurado, probar respaldo

    const ocupados = (citasOcupadas ?? []).map((c) => {
      const inicio = new Date(c.fecha_hora).getTime()
      const dur = c.duracion_min ?? 30
      return { inicio, fin: inicio + dur * 60_000 }
    })

    const diasBloqueados = new Set(
      (bloqueos ?? [])
        .filter((b) => !b.doctor_id || b.doctor_id === doctorId)
        .filter((b) => !b.service_id || !servicioId || b.service_id === servicioId)
        .map((b) => b.fecha as string)
    )

    const slots: SlotDisponible[] = []
    let horaExactaDisponible = false

    for (let dia = 0; dia <= DIAS_VENTANA; dia++) {
      if (slots.length >= MAX_SLOTS) break

      const { year, month, day } = sumarDiasCalendario(inicioVentana, dia)
      const fechaTexto = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      if (diasBloqueados.has(fechaTexto)) continue

      const diaSemana = diaSemanaMex(year, month, day)
      const bloquesDelDia = horarios.filter((h) => h.dia_semana === diaSemana)
      if (bloquesDelDia.length === 0) continue

      // Para el dia que el paciente pidio explicitamente no cortamos al
      // llegar a MAX_SLOTS: primero juntamos todos los huecos libres de ese
      // dia (para poder detectar si la hora exacta pedida esta libre y
      // elegir los mas cercanos a ella), y solo despues recortamos.
      const esDiaPedido = dia === 0 && !!fechaDeseadaParsed
      const candidatosDelDia: { slot: SlotDisponible; t: number }[] = []

      for (const bloque of bloquesDelDia) {
        const inicioMin = horaATexto(bloque.hora_inicio)
        const finMin = horaATexto(bloque.hora_fin)

        for (let t = inicioMin; t + duracionMin <= finMin; t += INTERVALO_MIN) {
          if (!esDiaPedido && slots.length + candidatosDelDia.length >= MAX_SLOTS) break

          const candidatoIso = mexLocalToISO(`${fechaTexto}T${minutosATexto(t)}`)
          const candidatoMs = new Date(candidatoIso).getTime()

          if (candidatoMs < Date.now() + MARGEN_MIN_DESDE_AHORA * 60_000) continue

          const finCandidatoMs = candidatoMs + duracionMin * 60_000
          const chocaConOcupado = ocupados.some(
            (o) => candidatoMs < o.fin && finCandidatoMs > o.inicio
          )
          if (chocaConOcupado) continue

          candidatosDelDia.push({
            slot: { fecha_hora_iso: candidatoIso, ...formatearFechaHoraMex(candidatoIso) },
            t,
          })
        }
      }

      if (esDiaPedido && horaDeseadaMin !== null) {
        // Chequeo directo de la hora EXACTA pedida (no solo si coincide con
        // alguno de los candidatos generados cada 30 min) — asi "las 3:35"
        // o "las 3:31" se evaluan correctamente contra el horario real del
        // doctor y las citas ya ocupadas, sin depender de la cuadricula.
        const exactoIso = mexLocalToISO(`${fechaTexto}T${minutosATexto(horaDeseadaMin)}`)
        const exactoMs = new Date(exactoIso).getTime()
        const exactoFinMs = exactoMs + duracionMin * 60_000
        const dentroDeMargen = exactoMs >= Date.now() + MARGEN_MIN_DESDE_AHORA * 60_000
        const dentroDeHorario = bloquesDelDia.some((b) => {
          const iMin = horaATexto(b.hora_inicio)
          const fMin = horaATexto(b.hora_fin)
          return horaDeseadaMin >= iMin && horaDeseadaMin + duracionMin <= fMin
        })
        const chocaExacto = ocupados.some((o) => exactoMs < o.fin && exactoFinMs > o.inicio)
        horaExactaDisponible = dentroDeMargen && dentroDeHorario && !chocaExacto

        candidatosDelDia.sort((a, b) => Math.abs(a.t - horaDeseadaMin) - Math.abs(b.t - horaDeseadaMin))
      }

      const espacioDisponible = MAX_SLOTS - slots.length
      slots.push(...candidatosDelDia.slice(0, espacioDisponible).map((c) => c.slot))
    }

    if (slots.length > 0) {
      return {
        ok: true,
        doctor_id: doctorId,
        doctor_nombre: doctorNombre,
        fue_respaldo: i > 0,
        duracion_min: duracionMin,
        slots,
        hora_exacta_disponible: horaExactaDisponible,
      }
    }
  }

  return { ok: false, motivo: "sin_disponibilidad" }
}

// Valida que un horario exacto (usado por agendar/reagendar) caiga dentro
// del horario semanal real del doctor y no coincida con un dia bloqueado.
// La revalidacion de choques con otras citas ya la hacen agendar/reagendar
// por su cuenta; esto cubre el hueco de que nunca revisaban el horario del
// doctor ni los bloqueos, solo si habia otra cita encima.
export async function horarioValidoParaDoctor(params: {
  clinicaId: string
  doctorId: string
  fechaHoraIso: string
  duracionMin: number
  servicioId?: string | null
}): Promise<boolean> {
  const { clinicaId, doctorId, fechaHoraIso, duracionMin, servicioId } = params
  const db = createServerClient()

  const { year, month, day, hour, minute } = isoToMexLocalParts(fechaHoraIso)
  const fechaTexto = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  const diaSemana = diaSemanaMex(year, month, day)
  const minutoDelDia = hour * 60 + minute

  const [{ data: horarios }, { data: bloqueos }] = await Promise.all([
    db
      .from("doctor_schedules")
      .select("hora_inicio, hora_fin")
      .eq("doctor_id", doctorId)
      .eq("dia_semana", diaSemana),
    db
      .from("bloqueos")
      .select("doctor_id, service_id")
      .eq("clinica_id", clinicaId)
      .eq("fecha", fechaTexto),
  ])

  const bloqueado = (bloqueos ?? []).some(
    (b) => (!b.doctor_id || b.doctor_id === doctorId) && (!b.service_id || !servicioId || b.service_id === servicioId)
  )
  if (bloqueado) return false

  return (horarios ?? []).some((h) => {
    const inicioMin = horaATexto(h.hora_inicio)
    const finMin = horaATexto(h.hora_fin)
    return minutoDelDia >= inicioMin && minutoDelDia + duracionMin <= finMin
  })
}
