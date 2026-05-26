"use server"

import { createServerClient } from "@/lib/supabase/server"
import { resolverClinicaId } from "@/lib/supabase/server-auth"
import { revalidatePath } from "next/cache"

// ---------------------------------------------------------------------------
// Conversion de hora local Mexico City → UTC
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

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type DatosCitaFicha = {
  service_id: string
  fecha_hora: string
  status: string
  costo: string
  notas: string
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
  const { error } = await supabase.from("appointments").insert({
    clinica_id: clinicaId,
    patient_id: patientId,
    service_id: datos.service_id || null,
    fecha_hora: mexLocalToISO(datos.fecha_hora),
    status: (datos.status || "programada") as
      | "programada"
      | "confirmada"
      | "cancelada"
      | "completada"
      | "no_asistio",
    costo: datos.costo ? Number(datos.costo) : null,
    notas: datos.notas || null,
  })
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
