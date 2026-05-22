"use server"

import { createServerClient } from "@/lib/supabase/server"
import { sendAgentMessage } from "@/lib/n8n"
import { revalidatePath } from "next/cache"

// ---------------------------------------------------------------------------
// Conversion de hora local Mexico City → UTC
// ---------------------------------------------------------------------------

// El input datetime-local entrega "YYYY-MM-DDTHH:mm" sin zona horaria.
// PostgreSQL lo almacenaria como UTC, causando un desplazamiento de 5-6 horas
// al mostrarlo. Esta funcion trata el string como hora de Mexico City y
// devuelve el ISO UTC correcto, usando Intl para respetar el horario de verano.
function mexLocalToISO(localStr: string): string {
  // Si ya trae zona horaria (Z, +HH:mm, -HH:mm), no tocar.
  if (!localStr || localStr.includes("Z") || /[+-]\d{2}:\d{2}$/.test(localStr)) {
    return localStr
  }

  // Paso 1: tratar el valor como UTC temporal (referencia de calculo).
  const asUTC = new Date(
    localStr.length === 16 ? localStr + ":00Z" : localStr + "Z"
  )

  // Paso 2: obtener las partes de hora que Mexico City muestra en ese instante UTC.
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

  // Paso 3: construir el timestamp "Mexico City como UTC" para medir el offset.
  const mexAsUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute")
  )

  // Paso 4: offset = referencia_UTC - mexico_como_UTC (positivo si MX esta atras de UTC).
  const offsetMs = asUTC.getTime() - mexAsUTC

  // Paso 5: hora UTC real = hora_local_como_UTC + offset.
  return new Date(asUTC.getTime() + offsetMs).toISOString()
}

export type DatosCita = {
  patient_id: string
  service_id: string
  doctor_id: string
  fecha_hora: string
  status: string
  costo: string
  notas: string
}

export async function crearCita(datos: DatosCita) {
  const supabase = createServerClient()
  const { error } = await supabase.from("appointments").insert({
    patient_id: datos.patient_id || null,
    service_id: datos.service_id || null,
    doctor_id: datos.doctor_id || null,
    fecha_hora: mexLocalToISO(datos.fecha_hora),
    status: (datos.status || "programada") as "programada" | "confirmada" | "cancelada" | "completada" | "no_asistio",
    costo: datos.costo ? Number(datos.costo) : null,
    notas: datos.notas || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/citas")
}

export async function actualizarCita(id: string, datos: DatosCita) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from("appointments")
    .update({
      patient_id: datos.patient_id || null,
      service_id: datos.service_id || null,
      doctor_id: datos.doctor_id || null,
      fecha_hora: mexLocalToISO(datos.fecha_hora),
      status: datos.status as "programada" | "confirmada" | "cancelada" | "completada" | "no_asistio",
      costo: datos.costo ? Number(datos.costo) : null,
      notas: datos.notas || null,
    })
    .eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/citas")
}

export async function eliminarCita(id: string) {
  const supabase = createServerClient()
  const { error } = await supabase.from("appointments").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/citas")
}

export async function enviarRecordatorio(citaId: string) {
  const supabase = createServerClient()

  const { data: cita, error } = await supabase
    .from("appointments")
    .select(
      "id, fecha_hora, patients(nombre, channel, channel_user_id), services(nombre)"
    )
    .eq("id", citaId)
    .single()

  if (error || !cita) throw new Error("Cita no encontrada")

  const paciente = cita.patients as {
    nombre: string
    channel: string
    channel_user_id: string | null
  } | null
  const servicio = cita.services as { nombre: string } | null

  if (!paciente?.channel_user_id) {
    throw new Error(
      "El paciente no tiene ID de canal configurado. No se puede enviar el recordatorio."
    )
  }

  const fecha = new Date(cita.fecha_hora).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })

  const texto = `Hola ${paciente.nombre}, le recordamos su cita${
    servicio ? ` de ${servicio.nombre}` : ""
  } programada para el ${fecha}. Si necesita reprogramar o cancelar, por favor comuniquese con anticipacion.`

  await sendAgentMessage({
    conversationId: citaId,
    channel: paciente.channel as "telegram" | "whatsapp",
    channelUserId: paciente.channel_user_id,
    texto,
    agenteId: "sistema",
  })

  const { error: errUpd } = await supabase
    .from("appointments")
    .update({ recordatorio_enviado_at: new Date().toISOString() })
    .eq("id", citaId)
  if (errUpd) throw new Error(errUpd.message)

  revalidatePath("/citas")
}
