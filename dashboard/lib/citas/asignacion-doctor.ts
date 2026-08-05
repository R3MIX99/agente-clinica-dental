import { createServerClient } from "@/lib/supabase/server"

// Asigna doctor(es) automaticamente a un paciente que no tiene ninguno —
// tipicamente un paciente nuevo que llego por el chat del asistente de IA,
// que se crea sin pasar por el formulario de /pacientes (donde el staff
// elige el doctor a mano). Sin esto, buscarDisponibilidad() no tiene forma
// de saber con que doctor buscar horarios.
export type ResultadoAsignacionDoctor =
  | { ok: true; yaAsignado: true }
  | { ok: true; yaAsignado: false; doctorId: string; doctorNombre: string }
  | { ok: false; motivo: "sin_doctores_en_clinica" }
  | { ok: false; motivo: "elegir_doctor"; doctores: { id: string; nombre: string }[] }

export async function asegurarDoctorAsignado(params: {
  clinicaId: string
  patientId: string
}): Promise<ResultadoAsignacionDoctor> {
  const { clinicaId, patientId } = params
  const db = createServerClient()

  const { data: existentes } = await db
    .from("patient_doctors")
    .select("doctor_id")
    .eq("clinica_id", clinicaId)
    .eq("patient_id", patientId)
    .limit(1)

  if (existentes && existentes.length > 0) {
    return { ok: true, yaAsignado: true }
  }

  const { data: doctores } = await db
    .from("doctors")
    .select("id, nombre, es_principal")
    .eq("clinica_id", clinicaId)
    .order("es_principal", { ascending: false })
    .order("created_at", { ascending: true })

  if (!doctores || doctores.length === 0) {
    return { ok: false, motivo: "sin_doctores_en_clinica" }
  }

  // Un solo doctor en la clinica, o hay uno marcado como principal: se
  // asigna solo (el resto, si hay, queda como respaldo en el mismo orden
  // que ya usa buscarDisponibilidad para el doctor de respaldo).
  const hayPrincipalClaro = doctores.length === 1 || doctores[0].es_principal

  if (!hayPrincipalClaro) {
    return {
      ok: false,
      motivo: "elegir_doctor",
      doctores: doctores.map((d) => ({ id: d.id, nombre: d.nombre })),
    }
  }

  const filas = doctores.map((d, idx) => ({
    clinica_id: clinicaId,
    patient_id: patientId,
    doctor_id: d.id,
    orden: idx,
  }))

  const { error } = await db.from("patient_doctors").insert(filas)
  if (error) {
    // No se pudo asignar (ej. condicion de carrera con otra asignacion
    // concurrente) — se trata igual que "sin doctores" para no romper el
    // flujo; el administrador puede asignar a mano si esto persiste.
    return { ok: false, motivo: "sin_doctores_en_clinica" }
  }

  return { ok: true, yaAsignado: false, doctorId: doctores[0].id, doctorNombre: doctores[0].nombre }
}

// Usada por la tool "Elegir doctor": el paciente ya eligio a cual doctor
// quiere ir cuando la clinica tiene varios y ninguno es el principal.
export async function asignarDoctorElegido(params: {
  clinicaId: string
  patientId: string
  doctorId: string
}): Promise<{ ok: boolean; error?: string; doctorNombre?: string }> {
  const { clinicaId, patientId, doctorId } = params
  const db = createServerClient()

  const { data: existentes } = await db
    .from("patient_doctors")
    .select("doctor_id")
    .eq("clinica_id", clinicaId)
    .eq("patient_id", patientId)
    .limit(1)

  if (existentes && existentes.length > 0) {
    return { ok: false, error: "Este paciente ya tiene un doctor asignado" }
  }

  const { data: doctores } = await db
    .from("doctors")
    .select("id, nombre")
    .eq("clinica_id", clinicaId)

  const elegido = (doctores ?? []).find((d) => d.id === doctorId)
  if (!elegido) {
    return { ok: false, error: "Ese doctor no pertenece a esta clinica" }
  }

  const resto = (doctores ?? []).filter((d) => d.id !== doctorId)
  const filas = [elegido, ...resto].map((d, idx) => ({
    clinica_id: clinicaId,
    patient_id: patientId,
    doctor_id: d.id,
    orden: idx,
  }))

  const { error } = await db.from("patient_doctors").insert(filas)
  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, doctorNombre: elegido.nombre }
}
