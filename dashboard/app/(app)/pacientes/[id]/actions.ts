"use server"

import { createServerClient } from "@/lib/supabase/server"
import { resolverClinicaId } from "@/lib/supabase/server-auth"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

// Horizonte por defecto para series mensuales indefinidas
const HORIZONTE_INDEFINIDO_MESES = 12

// ---------------------------------------------------------------------------
// Conversión de hora local Mexico City → UTC
// ---------------------------------------------------------------------------

function mexLocalToISO(localStr: string): string {
  if (!localStr || localStr.includes("Z") || /[+-]\d{2}:\d{2}$/.test(localStr)) {
    return localStr
  }
  const asUTC = new Date(
    localStr.length === 16 ? localStr + ":00Z" : localStr + "Z"
  )
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(asUTC)
  const get = (t: string) =>
    parseInt(parts.find((p) => p.type === t)?.value ?? "0")
  const mexAsUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute")
  )
  return new Date(asUTC.getTime() + (asUTC.getTime() - mexAsUTC)).toISOString()
}

function isoToMexLocalParts(iso: string): {
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

function ultimoDiaMes(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Genera fechas mensuales en ISO UTC, respetando el día del mes original.
// Si el día no existe en algún mes destino, usa el último día disponible.
function generarFechasMensuales(
  fechaBaseIso: string,
  numeroInstanciasExtra: number,
): string[] {
  const { year, month, day, hour, minute } = isoToMexLocalParts(fechaBaseIso)
  const fechas: string[] = []
  for (let i = 1; i <= numeroInstanciasExtra; i++) {
    const nuevaMonthZero = month - 1 + i
    const nuevoYear  = year + Math.floor(nuevaMonthZero / 12)
    const nuevoMonth = (nuevaMonthZero % 12) + 1
    const diaMax     = ultimoDiaMes(nuevoYear, nuevoMonth)
    const nuevoDia   = Math.min(day, diaMax)
    const localStr = [
      String(nuevoYear).padStart(4, "0"),
      String(nuevoMonth).padStart(2, "0"),
      String(nuevoDia).padStart(2, "0"),
    ].join("-") + "T" + [
      String(hour).padStart(2, "0"),
      String(minute).padStart(2, "0"),
    ].join(":")
    fechas.push(mexLocalToISO(localStr))
  }
  return fechas
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type DatosCitaFicha = {
  service_id: string
  fecha_hora: string
  status: string
  costo: string
  notas: string
  // Recurrencia mensual (opcional)
  recurrencia_tipo?: "" | "mensual"
  // Fecha hasta la cual generar instancias (YYYY-MM-DD). Vacío = indefinido (12 meses).
  recurrencia_fin?: string
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

export async function agregarNotaClinica(patientId: string, contenido: string) {
  if (!contenido.trim()) throw new Error("El contenido de la nota no puede estar vacio")
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase.from("clinical_notes").insert({
    clinica_id: clinicaId,
    patient_id: patientId,
    contenido: contenido.trim(),
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/pacientes/${patientId}`)
}

export async function actualizarDoctoresFicha(
  patientId: string,
  doctores: string[]
) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error: errDel } = await supabase
    .from("patient_doctors")
    .delete()
    .eq("patient_id", patientId)
    .eq("clinica_id", clinicaId)
  if (errDel) throw new Error(errDel.message)

  if (doctores.length > 0) {
    const { error: errIns } = await supabase.from("patient_doctors").insert(
      doctores.map((doctorId, idx) => ({
        clinica_id: clinicaId,
        patient_id: patientId,
        doctor_id: doctorId,
        orden: idx,
      }))
    )
    if (errIns) throw new Error(errIns.message)
  }

  revalidatePath(`/pacientes/${patientId}`)
  revalidatePath("/pacientes")
}

export async function agendarCitaFicha(
  patientId: string,
  datos: DatosCitaFicha
) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const esRecurrente = datos.recurrencia_tipo === "mensual"
  const fechaBaseIso = mexLocalToISO(datos.fecha_hora)
  const status = (datos.status || "programada") as
    | "programada" | "confirmada" | "cancelada" | "completada" | "no_asistio"

  const comunes = {
    clinica_id: clinicaId,
    patient_id: patientId,
    service_id: datos.service_id || null,
    status,
    costo:      datos.costo ? Number(datos.costo) : null,
    notas:      datos.notas || null,
  }

  if (!esRecurrente) {
    const { error } = await supabase.from("appointments").insert({
      ...comunes,
      fecha_hora: fechaBaseIso,
    })
    if (error) throw new Error(error.message)
    revalidatePath(`/pacientes/${patientId}`)
    revalidatePath("/pacientes")
    revalidatePath("/citas")
    return
  }

  // ---- Serie mensual ----
  const serieId = randomUUID()
  const finIso = datos.recurrencia_fin || null
  const finDate = finIso ? new Date(finIso + "T23:59:59Z") : null

  const fechasFuturas: string[] = []
  if (finDate) {
    for (let i = 1; i <= 240; i++) {
      const candidato = generarFechasMensuales(fechaBaseIso, i)[i - 1]
      if (new Date(candidato).getTime() > finDate.getTime()) break
      fechasFuturas.push(candidato)
    }
  } else {
    fechasFuturas.push(...generarFechasMensuales(fechaBaseIso, HORIZONTE_INDEFINIDO_MESES))
  }

  const filas = [
    {
      ...comunes,
      fecha_hora:       fechaBaseIso,
      serie_id:         serieId,
      recurrencia_tipo: "mensual",
      recurrencia_fin:  finIso,
    },
    ...fechasFuturas.map((fecha) => ({
      ...comunes,
      fecha_hora:       fecha,
      serie_id:         serieId,
      recurrencia_tipo: "mensual",
      recurrencia_fin:  finIso,
    })),
  ]

  const { error } = await supabase.from("appointments").insert(filas)
  if (error) throw new Error(error.message)
  revalidatePath(`/pacientes/${patientId}`)
  revalidatePath("/pacientes")
  revalidatePath("/citas")
}

export async function eliminarNotaClinica(notaId: string, patientId: string) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase
    .from("clinical_notes")
    .delete()
    .eq("id", notaId)
    .eq("clinica_id", clinicaId)
  if (error) throw new Error(error.message)
  revalidatePath(`/pacientes/${patientId}`)
}

export async function eliminarCitaFicha(citaId: string, patientId: string) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", citaId)
    .eq("clinica_id", clinicaId)
  if (error) throw new Error(error.message)
  revalidatePath(`/pacientes/${patientId}`)
  revalidatePath("/pacientes")
  revalidatePath("/citas")
}
