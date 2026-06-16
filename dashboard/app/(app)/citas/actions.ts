"use server"

import { createServerClient } from "@/lib/supabase/server"
import { createAuthClient, resolverClinicaId } from "@/lib/supabase/server-auth"
import { sendAgentMessage } from "@/lib/n8n"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

// ---------------------------------------------------------------------------
// Conversion de hora local Mexico City <-> UTC
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

// Extrae las partes locales (Mexico City) de un ISO UTC
function isoToMexLocalParts(iso: string): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
} {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) =>
    parseInt(parts.find((p) => p.type === t)?.value ?? "0")
  return {
    year:   get("year"),
    month:  get("month"),
    day:    get("day"),
    hour:   get("hour"),
    minute: get("minute"),
  }
}

// Ultimo dia del mes (1-12)
function ultimoDiaMes(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Genera las fechas mensuales (en ISO UTC) a partir de una fecha base, sumando 1 mes
// cada vez, respetando el dia del mes original. Si el dia no existe en el mes
// destino (ej. 31 -> febrero), usa el ultimo dia del mes.
function generarFechasMensuales(
  fechaBaseIso: string,
  numeroInstanciasExtra: number,
): string[] {
  const { year, month, day, hour, minute } = isoToMexLocalParts(fechaBaseIso)
  const fechas: string[] = []

  for (let i = 1; i <= numeroInstanciasExtra; i++) {
    const nuevaMonthZero = month - 1 + i // 0-indexed offset
    const nuevoYear  = year + Math.floor(nuevaMonthZero / 12)
    const nuevoMonth = (nuevaMonthZero % 12) + 1 // 1-12
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

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type DatosCita = {
  patient_id: string
  service_id: string
  doctor_id: string
  fecha_hora: string
  status: string
  duracion_min: string
  notas: string
  // Recurrencia (opcional)
  recurrencia_tipo?: "mensual" | ""
  // Fecha hasta la cual generar instancias (YYYY-MM-DD). Vacio = indefinido (12 meses)
  recurrencia_fin?: string
}

// Numero de meses por defecto cuando la serie es indefinida.
// Despues se puede extender con un job que regenere periodicamente.
const HORIZONTE_INDEFINIDO_MESES = 12

// ---------------------------------------------------------------------------
// Crear cita (con soporte para series mensuales)
// ---------------------------------------------------------------------------

export async function crearCita(datos: DatosCita) {
  const clinicaId = await resolverClinicaId()
  await verificarPermisosCita(datos, clinicaId)
  const supabase = createServerClient()

  const esRecurrente = datos.recurrencia_tipo === "mensual"
  const fechaBaseIso = mexLocalToISO(datos.fecha_hora)

  // Datos comunes a todas las instancias
  const comunes = {
    clinica_id:   clinicaId,
    patient_id:   datos.patient_id || null,
    service_id:   datos.service_id || null,
    doctor_id:    datos.doctor_id || null,
    status:       (datos.status || "programada") as
      "programada" | "confirmada" | "cancelada" | "completada" | "no_asistio",
    duracion_min: datos.duracion_min ? Number(datos.duracion_min) : null,
    notas:        datos.notas || null,
  }

  if (!esRecurrente) {
    const { error } = await supabase.from("appointments").insert({
      ...comunes,
      fecha_hora: fechaBaseIso,
    })
    if (error) throw new Error(error.message)
    revalidatePath("/citas")
    return
  }

  // --- Serie mensual ---
  const serieId = randomUUID()
  const finIso = datos.recurrencia_fin || null
  const finDate = finIso ? new Date(finIso + "T23:59:59Z") : null

  // Determinar cuantas instancias futuras generar
  const fechasFuturas: string[] = []

  if (finDate) {
    // Generar hasta que la fecha de la cita sobrepase recurrencia_fin
    for (let i = 1; i <= 240; i++) { // tope de seguridad: 20 anos
      const candidato = generarFechasMensuales(fechaBaseIso, i)[i - 1]
      if (new Date(candidato).getTime() > finDate.getTime()) break
      fechasFuturas.push(candidato)
    }
  } else {
    // Indefinido: horizonte por defecto
    fechasFuturas.push(...generarFechasMensuales(fechaBaseIso, HORIZONTE_INDEFINIDO_MESES))
  }

  // Construir filas a insertar: la cita madre + las siguientes
  const filas = [
    {
      ...comunes,
      fecha_hora:        fechaBaseIso,
      serie_id:          serieId,
      recurrencia_tipo:  "mensual",
      recurrencia_fin:   finIso,
    },
    ...fechasFuturas.map((fecha) => ({
      ...comunes,
      fecha_hora:        fecha,
      serie_id:          serieId,
      recurrencia_tipo:  "mensual",
      recurrencia_fin:   finIso,
    })),
  ]

  const { error } = await supabase.from("appointments").insert(filas)
  if (error) throw new Error(error.message)
  revalidatePath("/citas")
}

// ---------------------------------------------------------------------------
// Actualizar cita (solo esta instancia — no afecta la serie)
// ---------------------------------------------------------------------------

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
      status: datos.status as
        "programada" | "confirmada" | "cancelada" | "completada" | "no_asistio",
      duracion_min: datos.duracion_min ? Number(datos.duracion_min) : null,
      notas: datos.notas || null,
    })
    .eq("id", id)
    .eq("clinica_id", clinicaId)
  if (error) throw new Error(error.message)
  revalidatePath("/citas")
}

// ---------------------------------------------------------------------------
// Eliminar cita unica
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Terminar serie recurrente
// Cancela todas las citas futuras de la serie y marca recurrencia_fin = hoy.
// Las citas ya pasadas y la cita actual se respetan.
// ---------------------------------------------------------------------------

export async function terminarSerie(serieId: string) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const ahoraIso = new Date().toISOString()
  const hoyIso   = new Date().toISOString().slice(0, 10)

  // Eliminar todas las citas futuras de la serie
  const { error: errDel } = await supabase
    .from("appointments")
    .delete()
    .eq("clinica_id", clinicaId)
    .eq("serie_id", serieId)
    .gt("fecha_hora", ahoraIso)
  if (errDel) throw new Error(errDel.message)

  // Marcar recurrencia_fin = hoy en las citas que quedan (pasadas)
  const { error: errUpd } = await supabase
    .from("appointments")
    .update({ recurrencia_fin: hoyIso })
    .eq("clinica_id", clinicaId)
    .eq("serie_id", serieId)
  if (errUpd) throw new Error(errUpd.message)

  revalidatePath("/citas")
}

// ---------------------------------------------------------------------------
// Recordatorio manual via canal
// ---------------------------------------------------------------------------

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
