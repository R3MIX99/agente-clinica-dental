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
  const offsetMs = asUTC.getTime() - mexAsUTC
  return new Date(asUTC.getTime() + offsetMs).toISOString()
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type DatosPaciente = {
  nombre: string
  telefono: string
  email: string
  channel: string
  channel_user_id: string
  notas: string
  laboratorio: string
  tiempo_cita_min: string
  fecha_ingreso: string
  doctores: string[]
}

export type DatosCitaRapida = {
  patient_id: string
  service_id: string
  fecha_hora: string
  status: string
  costo: string
  notas: string
}

// ---------------------------------------------------------------------------
// Pacientes
// ---------------------------------------------------------------------------

export async function crearPaciente(datos: DatosPaciente) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("patients")
    .insert({
      clinica_id: clinicaId,
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.trim() || null,
      email: datos.email.trim() || null,
      channel: (datos.channel || "telegram") as "telegram" | "whatsapp",
      channel_user_id: datos.channel_user_id.trim() || null,
      notas: datos.notas.trim() || null,
      laboratorio: datos.laboratorio.trim() || null,
      tiempo_cita_min: datos.tiempo_cita_min ? parseInt(datos.tiempo_cita_min) : null,
      fecha_ingreso: datos.fecha_ingreso || null,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)

  if (datos.doctores.length > 0) {
    const { error: errDocs } = await supabase.from("patient_doctors").insert(
      datos.doctores.map((doctorId, idx) => ({
        clinica_id: clinicaId,
        patient_id: data.id,
        doctor_id: doctorId,
        orden: idx,
      }))
    )
    if (errDocs) throw new Error(errDocs.message)
  }

  revalidatePath("/pacientes")
}

export async function actualizarPaciente(id: string, datos: DatosPaciente) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase
    .from("patients")
    .update({
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.trim() || null,
      email: datos.email.trim() || null,
      channel: (datos.channel || "telegram") as "telegram" | "whatsapp",
      channel_user_id: datos.channel_user_id.trim() || null,
      notas: datos.notas.trim() || null,
      laboratorio: datos.laboratorio.trim() || null,
      tiempo_cita_min: datos.tiempo_cita_min ? parseInt(datos.tiempo_cita_min) : null,
      fecha_ingreso: datos.fecha_ingreso || null,
    })
    .eq("id", id)
    .eq("clinica_id", clinicaId)
  if (error) throw new Error(error.message)

  const { error: errDel } = await supabase
    .from("patient_doctors")
    .delete()
    .eq("patient_id", id)
    .eq("clinica_id", clinicaId)
  if (errDel) throw new Error(errDel.message)

  if (datos.doctores.length > 0) {
    const { error: errIns } = await supabase.from("patient_doctors").insert(
      datos.doctores.map((doctorId, idx) => ({
        clinica_id: clinicaId,
        patient_id: id,
        doctor_id: doctorId,
        orden: idx,
      }))
    )
    if (errIns) throw new Error(errIns.message)
  }

  revalidatePath("/pacientes")
}

export async function eliminarPaciente(id: string) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase
    .from("patients")
    .delete()
    .eq("id", id)
    .eq("clinica_id", clinicaId)
  if (error) {
    if (error.message.includes("foreign key")) {
      throw new Error(
        "No se puede eliminar: el paciente tiene conversaciones o citas asociadas."
      )
    }
    throw new Error(error.message)
  }
  revalidatePath("/pacientes")
}

// ---------------------------------------------------------------------------
// Agendar cita desde la pagina de pacientes
// ---------------------------------------------------------------------------

export async function agendarCitaPaciente(datos: DatosCitaRapida) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase.from("appointments").insert({
    clinica_id: clinicaId,
    patient_id: datos.patient_id || null,
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
  revalidatePath("/pacientes")
  revalidatePath("/citas")
}
