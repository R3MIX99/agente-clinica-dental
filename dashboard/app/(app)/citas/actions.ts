"use server"

import { createServerClient } from "@/lib/supabase/server"
import { createAuthClient, resolverClinicaId } from "@/lib/supabase/server-auth"
import { sendAgentMessage } from "@/lib/n8n"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

// ---------------------------------------------------------------------------
// Conversión de hora local Mexico City <-> UTC
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

// Último día del mes (1-12)
function ultimoDiaMes(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// Genera las fechas mensuales (en ISO UTC) a partir de una fecha base, sumando 1 mes
// cada vez, respetando el día del mes original. Si el día no existe en el mes
// destino (ej. 31 -> febrero), usa el último día del mes.
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

async function verificarPermisosCita(
  datos: DatosCita,
  clinicaId: string
): Promise<{ esDoctor: boolean }> {
  const authClient = await createAuthClient()
  const { data: { session } } = await authClient.auth.getSession()
  if (!session?.user) throw new Error("No autenticado")

  const { data: perfil } = await authClient
    .from("profiles")
    .select("rol, doctor_id")
    .eq("id", session.user.id)
    .single()

  // Admin y supervisor no tienen restricciones
  if (perfil?.rol !== "doctor") return { esDoctor: false }

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

  return { esDoctor: true }
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

// Número de meses por defecto cuando la serie es indefinida.
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
  const { esDoctor } = await verificarPermisosCita(datos, clinicaId)
  const supabase = createServerClient()

  const nuevaFechaIso = mexLocalToISO(datos.fecha_hora)

  // Estado actual y fecha original de la cita
  const { data: actual } = await supabase
    .from("appointments")
    .select("patient_id, service_id, doctor_id, status, fecha_hora, duracion_min, notas")
    .eq("id", id)
    .eq("clinica_id", clinicaId)
    .single()

  // Un doctor solo puede reagendar (cambiar fecha y hora); el resto de los
  // campos se preservan del registro original sin importar lo que llegue
  // en el formulario.
  const datosAplicados = esDoctor && actual
    ? {
        patient_id:   actual.patient_id,
        service_id:   actual.service_id,
        doctor_id:    actual.doctor_id,
        status:       actual.status,
        duracion_min: actual.duracion_min,
        notas:        actual.notas,
      }
    : {
        patient_id:   datos.patient_id || null,
        service_id:   datos.service_id || null,
        doctor_id:    datos.doctor_id || null,
        status:       datos.status,
        duracion_min: datos.duracion_min ? Number(datos.duracion_min) : null,
        notas:        datos.notas || null,
      }

  // Si la cita estaba "por reagendar" y se le cambia la fecha, vuelve a "programada":
  // reagendar una cita cerrada la reactiva automaticamente.
  let statusFinal = datosAplicados.status
  const estabaPorReagendar =
    actual?.status === "por_reagendar" || datosAplicados.status === "por_reagendar"
  const cambioFecha = !!actual && actual.fecha_hora !== nuevaFechaIso
  if (estabaPorReagendar && cambioFecha) {
    statusFinal = "programada"
  }

  const { error } = await supabase
    .from("appointments")
    .update({
      patient_id: datosAplicados.patient_id,
      service_id: datosAplicados.service_id,
      doctor_id: datosAplicados.doctor_id,
      fecha_hora: nuevaFechaIso,
      status: statusFinal as
        "programada" | "confirmada" | "cancelada" | "completada" | "no_asistio" | "por_reagendar",
      duracion_min: datosAplicados.duracion_min,
      notas: datosAplicados.notas,
    })
    .eq("id", id)
    .eq("clinica_id", clinicaId)
  if (error) throw new Error(error.message)
  revalidatePath("/citas")
}

// ---------------------------------------------------------------------------
// Eliminar cita única
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
// Editar duración de una serie recurrente
// Permite cambiar la fecha de fin de la serie a una fecha posterior (genera
// nuevas instancias), una fecha anterior (elimina las futuras que sobran)
// o volverla indefinida (genera el horizonte por defecto desde la última).
// Solo afecta a citas futuras — las pasadas se respetan siempre.
// ---------------------------------------------------------------------------

export type DatosEditarSerie = {
  modo:           "indefinido" | "n_meses" | "fecha"
  meses?:         number
  fecha?:         string  // YYYY-MM-DD
}

export async function editarSerie(
  serieId: string,
  datos: DatosEditarSerie,
): Promise<{ ok: boolean; error?: string }> {
  const clinicaId = await resolverClinicaId()
  const supabase  = createServerClient()

  // Cargar todas las citas de la serie ordenadas por fecha ascendente
  const { data: citasSerie, error: errCargar } = await supabase
    .from("appointments")
    .select("id, fecha_hora, patient_id, service_id, doctor_id, duracion_min, notas, status")
    .eq("clinica_id", clinicaId)
    .eq("serie_id", serieId)
    .order("fecha_hora", { ascending: true })

  if (errCargar) return { ok: false, error: errCargar.message }
  if (!citasSerie || citasSerie.length === 0) {
    return { ok: false, error: "La serie no existe o esta vacia" }
  }

  // Fecha base de la serie (primera cita): mantiene día/hora a replicar
  const citaBase = citasSerie[0]
  const ultimaCita = citasSerie[citasSerie.length - 1]
  const ahoraMs = Date.now()

  // Calcular nueva recurrencia_fin (ISO YYYY-MM-DD) o null para indefinido
  let nuevaRecurrenciaFin: string | null = null
  if (datos.modo === "fecha") {
    if (!datos.fecha) return { ok: false, error: "Seleccióna la fecha de fin" }
    nuevaRecurrenciaFin = datos.fecha
  } else if (datos.modo === "n_meses") {
    if (!datos.meses || datos.meses < 1) {
      return { ok: false, error: "Número de meses invalido" }
    }
    // N meses despues de la primera cita de la serie
    const base = new Date(citaBase.fecha_hora)
    base.setMonth(base.getMonth() + datos.meses)
    nuevaRecurrenciaFin = base.toISOString().slice(0, 10)
  }
  // indefinido => nuevaRecurrenciaFin queda null

  // Limite efectivo para nuevas instancias:
  // - Con fecha de fin: timestamp del día + 23:59:59 UTC
  // - Indefinido: HORIZONTE_INDEFINIDO_MESES despues de la cita base
  let limiteMs: number
  if (nuevaRecurrenciaFin) {
    limiteMs = new Date(nuevaRecurrenciaFin + "T23:59:59Z").getTime()
  } else {
    const horizonte = new Date(citaBase.fecha_hora)
    horizonte.setMonth(horizonte.getMonth() + HORIZONTE_INDEFINIDO_MESES)
    limiteMs = horizonte.getTime()
  }

  // ----- Acortar serie: borrar citas futuras posteriores al limite -----
  const ahoraIso = new Date().toISOString()
  const fechaCorteIso = new Date(limiteMs).toISOString()
  const { error: errDel } = await supabase
    .from("appointments")
    .delete()
    .eq("clinica_id", clinicaId)
    .eq("serie_id", serieId)
    .gt("fecha_hora", ahoraIso)            // solo futuras
    .gt("fecha_hora", fechaCorteIso)       // posteriores al nuevo limite
  if (errDel) return { ok: false, error: errDel.message }

  // ----- Extender serie: generar citas faltantes hasta el limite -----
  const ultimaFechaActualMs = new Date(ultimaCita.fecha_hora).getTime()
  const nuevasFilas: Array<{
    clinica_id:        string
    serie_id:          string
    recurrencia_tipo:  string
    recurrencia_fin:   string | null
    patient_id:        string | null
    service_id:        string | null
    doctor_id:         string | null
    duracion_min:      number | null
    notas:             string | null
    status:            "programada" | "confirmada" | "cancelada" | "completada" | "no_asistio"
    fecha_hora:        string
  }> = []

  if (limiteMs > ultimaFechaActualMs) {
    // Generar candidatos desde la cita base hasta encontrar uno > ultimaCita
    // y luego hasta limiteMs.
    for (let i = 1; i <= 240; i++) {
      const candidato = generarFechasMensuales(citaBase.fecha_hora, i)[i - 1]
      const t = new Date(candidato).getTime()
      if (t <= ultimaFechaActualMs) continue       // ya existe
      if (t > limiteMs) break
      nuevasFilas.push({
        clinica_id:       clinicaId,
        serie_id:         serieId,
        recurrencia_tipo: "mensual",
        recurrencia_fin:  nuevaRecurrenciaFin,
        patient_id:       citaBase.patient_id,
        service_id:       citaBase.service_id,
        doctor_id:        citaBase.doctor_id,
        duracion_min:     citaBase.duracion_min,
        notas:            citaBase.notas,
        status:           "programada",
        fecha_hora:       candidato,
      })
    }

    if (nuevasFilas.length > 0) {
      const { error: errInsert } = await supabase
        .from("appointments")
        .insert(nuevasFilas)
      if (errInsert) return { ok: false, error: errInsert.message }
    }
  }

  // ----- Actualizar recurrencia_fin en todas las filas remanentes -----
  const { error: errUpd } = await supabase
    .from("appointments")
    .update({ recurrencia_fin: nuevaRecurrenciaFin })
    .eq("clinica_id", clinicaId)
    .eq("serie_id", serieId)
  if (errUpd) return { ok: false, error: errUpd.message }

  revalidatePath("/citas")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Resolver la conversacion activa de un paciente (para mensajes del sistema)
// El WF03 valida el mensaje contra una conversacion real; por eso no se puede
// usar el id de la cita. Devuelve el id de la conversacion mas reciente del
// paciente en la clinica, o null si no tiene ninguna.
// ---------------------------------------------------------------------------

async function resolverConversacionPaciente(
  supabase: ReturnType<typeof createServerClient>,
  clinicaId: string,
  patientId: string | null,
): Promise<string | null> {
  if (!patientId) return null
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("clinica_id", clinicaId)
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

// ---------------------------------------------------------------------------
// Cierre de dia / bloqueo por servicio
// Bloquea una fecha (toda la clinica o solo un servicio), reagenda las citas
// afectadas (status por_reagendar) y avisa a cada paciente por su canal.
// ---------------------------------------------------------------------------

export type DatosCerrarDia = {
  fecha: string          // YYYY-MM-DD (hora local Mexico)
  service_id?: string    // vacio = toda la clinica ese dia
  motivo?: string
}

export async function cerrarDia(
  datos: DatosCerrarDia,
): Promise<{ ok: boolean; error?: string; afectadas?: number; avisadas?: number }> {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  if (!datos.fecha) return { ok: false, error: "Selecciona la fecha a cerrar." }

  // 1. Registrar el bloqueo
  const { error: errB } = await supabase.from("bloqueos").insert({
    clinica_id: clinicaId,
    fecha: datos.fecha,
    service_id: datos.service_id || null,
    motivo: datos.motivo?.trim() || null,
  })
  if (errB) return { ok: false, error: errB.message }

  // 2. Rango del dia en zona horaria de Mexico
  const inicio = mexLocalToISO(datos.fecha + "T00:00")
  const fin = mexLocalToISO(datos.fecha + "T23:59")

  let q = supabase
    .from("appointments")
    .select("id, service_id, patient_id, patients(nombre, channel, channel_user_id), services(nombre)")
    .eq("clinica_id", clinicaId)
    .gte("fecha_hora", inicio)
    .lte("fecha_hora", fin)
    .in("status", ["programada", "confirmada"])
  if (datos.service_id) q = q.eq("service_id", datos.service_id)

  const { data: citas, error: errC } = await q
  if (errC) return { ok: false, error: errC.message }

  // 3. Datos de la clinica para el mensaje de reagenda
  const { data: clinica } = await supabase
    .from("clinicas")
    .select("google_reserva_url, telefono, nombre")
    .eq("id", clinicaId)
    .single()

  const reservaUrl = clinica?.google_reserva_url?.trim() || null
  const fechaTxt = new Date(inicio).toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  let avisadas = 0

  for (const cita of citas ?? []) {
    const paciente = cita.patients as {
      nombre: string
      channel: string
      channel_user_id: string | null
    } | null
    const servicio = cita.services as { nombre: string } | null

    // Marcar la cita como por reagendar
    await supabase
      .from("appointments")
      .update({ status: "por_reagendar" })
      .eq("id", cita.id)
      .eq("clinica_id", clinicaId)

    // Avisar al paciente si tiene canal y una conversacion activa
    const conversacionId = await resolverConversacionPaciente(
      supabase,
      clinicaId,
      (cita as { patient_id: string | null }).patient_id,
    )
    if (paciente?.channel_user_id && conversacionId) {
      const motivoTxt = datos.motivo?.trim() ? ` (${datos.motivo.trim()})` : ""
      const comoReagendar = reservaUrl
        ? `Puede reagendar en este enlace: ${reservaUrl}`
        : `Por favor comuniquese con la clinica${clinica?.telefono ? ` al ${clinica.telefono}` : ""} para reagendar.`
      const texto =
        `Hola ${paciente.nombre}, le informamos que su cita` +
        `${servicio ? ` de ${servicio.nombre}` : ""} del ${fechaTxt} necesita reprogramarse${motivoTxt}. ` +
        comoReagendar

      try {
        await sendAgentMessage({
          conversationId: conversacionId,
          clinicaId,
          channel: paciente.channel as "telegram" | "whatsapp",
          channelUserId: paciente.channel_user_id,
          texto,
          agenteId: "sistema",
        })
        avisadas++
      } catch {
        // Si falla el envio a un paciente, continuar con los demas
      }
    }
  }

  // 4. Marcar el bloqueo como notificado
  await supabase
    .from("bloqueos")
    .update({ notificado_at: new Date().toISOString() })
    .eq("clinica_id", clinicaId)
    .eq("fecha", datos.fecha)
    .is("notificado_at", null)

  revalidatePath("/citas")
  return { ok: true, afectadas: citas?.length ?? 0, avisadas }
}

export async function reabrirDia(bloqueoId: string): Promise<{ ok: boolean; error?: string }> {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase
    .from("bloqueos")
    .delete()
    .eq("id", bloqueoId)
    .eq("clinica_id", clinicaId)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/citas")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Estado de pago de una cita
// ---------------------------------------------------------------------------

export async function marcarPago(
  citaId: string,
  estado: "pendiente" | "pagado",
): Promise<{ ok: boolean; error?: string }> {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase
    .from("appointments")
    .update({ estado_pago: estado })
    .eq("id", citaId)
    .eq("clinica_id", clinicaId)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/citas")
  return { ok: true }
}

// Envia al paciente los datos de pago/transferencia de la clinica.
export async function enviarDatosPago(citaId: string): Promise<{ ok: boolean; error?: string }> {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const { data: cita } = await supabase
    .from("appointments")
    .select("id, costo, patient_id, patients(nombre, channel, channel_user_id), services(nombre)")
    .eq("id", citaId)
    .eq("clinica_id", clinicaId)
    .single()
  if (!cita) return { ok: false, error: "Cita no encontrada." }

  const paciente = cita.patients as {
    nombre: string
    channel: string
    channel_user_id: string | null
  } | null
  if (!paciente?.channel_user_id) return { ok: false, error: "El paciente no tiene canal configurado." }

  const conversacionId = await resolverConversacionPaciente(supabase, clinicaId, cita.patient_id)
  if (!conversacionId) {
    return { ok: false, error: "El paciente no tiene una conversación activa para enviarle el mensaje." }
  }

  const { data: clinica } = await supabase
    .from("clinicas")
    .select("datos_pago, nombre")
    .eq("id", clinicaId)
    .single()

  if (!clinica?.datos_pago?.trim()) {
    return { ok: false, error: "No hay datos de pago configurados. Agregalos en Ajustes." }
  }

  const servicio = cita.services as { nombre: string } | null
  const montoTxt = cita.costo != null
    ? ` por un monto de $${Number(cita.costo).toLocaleString("es-MX")} MXN`
    : ""
  const texto =
    `Hola ${paciente.nombre}, aqui estan los datos para el pago de su cita` +
    `${servicio ? ` de ${servicio.nombre}` : ""}${montoTxt}:\n\n${clinica.datos_pago.trim()}\n\n` +
    `Una vez realizado el pago, por favor envienos su comprobante. Gracias.`

  try {
    await sendAgentMessage({
      conversationId: conversacionId,
      clinicaId,
      channel: paciente.channel as "telegram" | "whatsapp",
      channelUserId: paciente.channel_user_id,
      texto,
      agenteId: "sistema",
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo enviar el mensaje." }
  }
  return { ok: true }
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
      "id, fecha_hora, patient_id, patients(nombre, channel, channel_user_id), services(nombre)"
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

  const conversacionId = await resolverConversacionPaciente(supabase, clinicaId, cita.patient_id)
  if (!conversacionId) {
    throw new Error("El paciente no tiene una conversación activa para enviarle el recordatorio.")
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
    conversationId: conversacionId,
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
