"use server"

import { createServerClient } from "@/lib/supabase/server"
import { resolverClinicaId } from "@/lib/supabase/server-auth"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

// Horizonte por defecto para series mensuales indefinidas (igual que en /citas)
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
  const offsetMs = asUTC.getTime() - mexAsUTC
  return new Date(asUTC.getTime() + offsetMs).toISOString()
}

// Extrae las partes locales (Mexico City) de un ISO UTC.
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

// Genera fechas mensuales (en ISO UTC) sumando 1 mes cada vez, respetando
// el día del mes original. Si el día no existe en el mes destino, usa el último.
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
  // Recurrencia mensual (opcional)
  recurrencia_tipo?: "" | "mensual"
  // Si recurrencia_tipo es 'mensual': fecha hasta la cual generar instancias
  // (YYYY-MM-DD). Vacio = indefinido (12 meses por defecto).
  recurrencia_fin?: string
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

  const esRecurrente = datos.recurrencia_tipo === "mensual"
  const fechaBaseIso = mexLocalToISO(datos.fecha_hora)
  const status = (datos.status || "programada") as
    | "programada" | "confirmada" | "cancelada" | "completada" | "no_asistio"

  const comunes = {
    clinica_id: clinicaId,
    patient_id: datos.patient_id || null,
    service_id: datos.service_id || null,
    status,
    costo: datos.costo ? Number(datos.costo) : null,
    notas: datos.notas || null,
  }

  if (!esRecurrente) {
    const { error } = await supabase.from("appointments").insert({
      ...comunes,
      fecha_hora: fechaBaseIso,
    })
    if (error) throw new Error(error.message)
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
  revalidatePath("/pacientes")
  revalidatePath("/citas")
}

// ---------------------------------------------------------------------------
// Importar pacientes desde CSV (Excel / Google Sheets)
// ---------------------------------------------------------------------------

export type PacienteImport = {
  nombre:           string
  telefono?:        string
  email?:           string
  notas?:           string
  channel?:         string
  channel_user_id?: string
  laboratorio?:     string
  fecha_ingreso?:   string   // YYYY-MM-DD
}

export type ResultadoImport = {
  insertados:      number
  omitidos_vacios: number
  errores:         Array<{ fila: number; mensaje: string }>
}

export async function importarPacientes(
  filas: PacienteImport[],
): Promise<ResultadoImport> {
  const clinicaId = await resolverClinicaId()
  const supabase  = createServerClient()

  const errores: Array<{ fila: number; mensaje: string }> = []
  let omitidos_vacios = 0

  // Preparar filas validas para insertar en bloque
  const filasValidas: Array<{
    clinica_id:      string
    nombre:          string
    telefono:        string | null
    email:           string | null
    channel:         "telegram" | "whatsapp"
    channel_user_id: string | null
    notas:           string | null
    laboratorio:     string | null
    fecha_ingreso:   string | null
  }> = []

  filas.forEach((paciente, idx) => {
    const numFila = idx + 2  // +1 por cabecera, +1 por base-1

    const nombre = (paciente.nombre ?? "").trim()
    if (!nombre) {
      omitidos_vacios++
      return
    }

    const channelRaw = (paciente.channel ?? "telegram").trim().toLowerCase()
    const channel: "telegram" | "whatsapp" =
      channelRaw === "whatsapp" ? "whatsapp" : "telegram"

    let fecha: string | null = null
    if (paciente.fecha_ingreso) {
      const f = paciente.fecha_ingreso.trim()
      // Aceptar YYYY-MM-DD o DD/MM/YYYY
      if (/^\d{4}-\d{2}-\d{2}$/.test(f)) {
        fecha = f
      } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(f)) {
        const [d, m, y] = f.split("/")
        fecha = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
      } else {
        errores.push({ fila: numFila, mensaje: `Fecha de ingreso invalida: "${f}"` })
        return
      }
    }

    filasValidas.push({
      clinica_id:      clinicaId,
      nombre,
      telefono:        paciente.telefono?.trim()        || null,
      email:           paciente.email?.trim()           || null,
      channel,
      channel_user_id: paciente.channel_user_id?.trim() || null,
      notas:           paciente.notas?.trim()           || null,
      laboratorio:     paciente.laboratorio?.trim()     || null,
      fecha_ingreso:   fecha,
    })
  })

  if (filasValidas.length === 0) {
    return { insertados: 0, omitidos_vacios, errores }
  }

  // Insertar en bloques para no romper si la lista es muy grande
  const TAMANO_LOTE = 100
  let insertados = 0
  for (let i = 0; i < filasValidas.length; i += TAMANO_LOTE) {
    const lote = filasValidas.slice(i, i + TAMANO_LOTE)
    const { error } = await supabase.from("patients").insert(lote)
    if (error) {
      errores.push({
        fila:     i + 2,
        mensaje:  `Error al insertar lote: ${error.message}`,
      })
    } else {
      insertados += lote.length
    }
  }

  revalidatePath("/pacientes")
  return { insertados, omitidos_vacios, errores }
}
