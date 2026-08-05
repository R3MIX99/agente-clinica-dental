import { createServerClient } from "@/lib/supabase/server"
import {
  mexLocalToISO,
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
    }
  | { ok: false; motivo: "sin_doctor_asignado" | "sin_disponibilidad" | "paciente_no_encontrado" }

export async function buscarDisponibilidad(params: {
  clinicaId: string
  patientId: string
  servicioId?: string | null
}): Promise<ResultadoDisponibilidad> {
  const { clinicaId, patientId, servicioId } = params
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
  const inicioVentana = hoyMexico()
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

    for (let dia = 0; dia <= DIAS_VENTANA && slots.length < MAX_SLOTS; dia++) {
      const { year, month, day } = sumarDiasCalendario(inicioVentana, dia)
      const fechaTexto = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      if (diasBloqueados.has(fechaTexto)) continue

      const diaSemana = diaSemanaMex(year, month, day)
      const bloquesDelDia = horarios.filter((h) => h.dia_semana === diaSemana)
      if (bloquesDelDia.length === 0) continue

      for (const bloque of bloquesDelDia) {
        const inicioMin = horaATexto(bloque.hora_inicio)
        const finMin = horaATexto(bloque.hora_fin)

        for (let t = inicioMin; t + duracionMin <= finMin; t += INTERVALO_MIN) {
          if (slots.length >= MAX_SLOTS) break

          const candidatoIso = mexLocalToISO(`${fechaTexto}T${minutosATexto(t)}`)
          const candidatoMs = new Date(candidatoIso).getTime()

          if (candidatoMs < Date.now() + MARGEN_MIN_DESDE_AHORA * 60_000) continue

          const finCandidatoMs = candidatoMs + duracionMin * 60_000
          const chocaConOcupado = ocupados.some(
            (o) => candidatoMs < o.fin && finCandidatoMs > o.inicio
          )
          if (chocaConOcupado) continue

          slots.push({ fecha_hora_iso: candidatoIso, ...formatearFechaHoraMex(candidatoIso) })
        }
      }
    }

    if (slots.length > 0) {
      return {
        ok: true,
        doctor_id: doctorId,
        doctor_nombre: doctorNombre,
        fue_respaldo: i > 0,
        duracion_min: duracionMin,
        slots,
      }
    }
  }

  return { ok: false, motivo: "sin_disponibilidad" }
}
