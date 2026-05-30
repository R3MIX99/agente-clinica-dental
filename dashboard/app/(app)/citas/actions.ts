"use server"

import { createServerClient } from "@/lib/supabase/server"
import { createAuthClient, resolverClinicaId } from "@/lib/supabase/server-auth"
import { sendAgentMessage } from "@/lib/n8n"
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
// Guard de permisos para doctores
// ---------------------------------------------------------------------------

async function verificarPermisosCita(datos: DatosCita, clinicaId: string) {
  const authClient = await createAuthClient()
  const { data: { session } } = await authClient.auth.getSession()
  if (!session?.user) throw new Error("No autenticado")

  const { data: perfil } = await authClient
    .from("profiles")
    .select("rol, doctor_id")
    .eq("id", session.user.id)
    .single()

  // Admin y supervisor no tienen restricciones
  if (perfil?.rol !== "doctor") return

  const doctorId = perfil.doctor_id
  if (!doctorId) throw new Error("Tu cuenta no tiene un doctor vinculado")

  if (datos.doctor_id && datos.doctor_id !== doctorId) {
    throw new Error("No puedes asignar citas a otro doctor")
  }

  if (datos.patient_id) {
    const db = createServerClient()
    const { data: asignacion } = await db
      .from("patient_doctors")
      .select("patient_id")
      .eq("clinica_id", clinicaId)
      .eq("doctor_id", doctorId)
      .eq("patient_id", datos.patient_id)
      .maybeSingle()
    if (!asignacion) {
      throw new Error("Solo puedes crear citas para tus pacientes asignados")
    }
  }
}

export type DatosCita = {
  patient_id: string
  service_id: string
  doctor_id: string
  fecha_hora: string
  status: string
  duracion_min: string
  notas: string
}

export async function crearCita(datos: DatosCita) {
  const clinicaId = await resolverClinicaId()
  await verificarPermisosCita(datos, clinicaId)
  const supabase = createServerClient()
  const { error } = await supabase.from("appointments").insert({
    clinica_id: clinicaId,
    patient_id: datos.patient_id || null,
    service_id: datos.service_id || null,
    doctor_id: datos.doctor_id || null,
    fecha_hora: mexLocalToISO(datos.fecha_hora),
    status: (datos.status || "programada") as "programada" | "confirmada" | "cancelada" | "completada" | "no_asistio",
    duracion_min: datos.duracion_min ? Number(datos.duracion_min) : null,
    notas: datos.notas || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/citas")
}

export async function actualizarCita(id: string, datos: DatosCita) {
  const clinicaId = await resolverClinicaId()
  await verificarPermisosCita(datos, clinicaId)
  const supabase = createServerClient()
  const { error } = await supabase
    .from("appointments")
    .update({
      patient_id: datos.patient_id || null,
      service_id: datos.service_id || null,
      doctor_id: datos.doctor_id || null,
      fecha_hora: mexLocalToISO(datos.fecha_hora),
      status: datos.status as "programada" | "confirmada" | "cancelada" | "completada" | "no_asistio",
      duracion_min: datos.duracion_min ? Number(datos.duracion_min) : null,
      notas: datos.notas || null,
    })
    .eq("id", id)
    .eq("clinica_id", clinicaId)
  if (error) throw new Error(error.message)
  revalidatePath("/citas")
}

export async function eliminarCita(id: string) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", id)
    .eq("clinica_id", clinicaId)
  if (error) throw new Error(error.message)
  revalidatePath("/citas")
}

export async function enviarRecordatorio(citaId: string) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const { data: cita, error } = await supabase
    .from("appointments")
    .select(
      "id, fecha_hora, patients(nombre, channel, channel_user_id), services(nombre)"
    )
    .eq("id", citaId)
    .eq("clinica_id", clinicaId)
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
    clinicaId,
    channel: paciente.channel as "telegram" | "whatsapp",
    channelUserId: paciente.channel_user_id,
    texto,
    agenteId: "sistema",
  })

  const { error: errUpd } = await supabase
    .from("appointments")
    .update({ recordatorio_enviado_at: new Date().toISOString() })
    .eq("id", citaId)
    .eq("clinica_id", clinicaId)
  if (errUpd) throw new Error(errUpd.message)

  revalidatePath("/citas")
}
