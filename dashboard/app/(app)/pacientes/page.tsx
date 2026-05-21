import { createServerClient } from "@/lib/supabase/server"
import { PacientesClient } from "./PacientesClient"

export const metadata = { title: "Pacientes — Clinica Dental" }

export default async function PacientesPage() {
  const supabase = createServerClient()

  const ahora = new Date().toISOString()

  const [
    { data: pacientesRaw },
    { data: citasFuturas },
    { data: asignaciones },
    { data: estudios },
    { data: servicios },
    { data: doctores },
  ] = await Promise.all([
    supabase
      .from("patients")
      .select(
        "id, nombre, telefono, email, channel, channel_user_id, notas, created_at, laboratorio, tiempo_cita_min, fecha_ingreso"
      )
      .order("nombre"),
    supabase
      .from("appointments")
      .select("id, patient_id, fecha_hora, services(nombre)")
      .gte("fecha_hora", ahora)
      .in("status", ["programada", "confirmada"])
      .order("fecha_hora"),
    supabase
      .from("patient_doctors")
      .select("patient_id, doctor_id, orden, doctors(id, nombre)")
      .order("patient_id")
      .order("orden"),
    supabase
      .from("studies")
      .select("patient_id")
      .eq("status", "pendiente"),
    supabase
      .from("services")
      .select("id, nombre, precio")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("doctors")
      .select("id, nombre")
      .order("nombre"),
  ])

  // Mapa: patient_id → proxima cita futura
  const proximaCitaMap = new Map<
    string,
    { fecha_hora: string; servicio_nombre: string | null }
  >()
  for (const cita of citasFuturas ?? []) {
    if (!cita.patient_id) continue
    if (!proximaCitaMap.has(cita.patient_id)) {
      const svc = cita.services as { nombre: string } | null
      proximaCitaMap.set(cita.patient_id, {
        fecha_hora: cita.fecha_hora,
        servicio_nombre: svc?.nombre ?? null,
      })
    }
  }

  // Mapa: patient_id → doctores ordenados
  const doctorAsignMap = new Map<
    string,
    Array<{ id: string; nombre: string; orden: number }>
  >()
  for (const asig of asignaciones ?? []) {
    const doc = asig.doctors as { id: string; nombre: string } | null
    if (!doc) continue
    const lista = doctorAsignMap.get(asig.patient_id) ?? []
    lista.push({ id: doc.id, nombre: doc.nombre, orden: asig.orden })
    doctorAsignMap.set(asig.patient_id, lista)
  }

  // Mapa: patient_id → cantidad de estudios pendientes
  const estudiosPendMap = new Map<string, number>()
  for (const e of estudios ?? []) {
    estudiosPendMap.set(
      e.patient_id,
      (estudiosPendMap.get(e.patient_id) ?? 0) + 1
    )
  }

  const pacientes = (pacientesRaw ?? []).map((p) => {
    const asigs = (doctorAsignMap.get(p.id) ?? []).sort(
      (a, b) => a.orden - b.orden
    )
    return {
      ...p,
      proxima_cita: proximaCitaMap.get(p.id) ?? null,
      doctor_principal: asigs[0] ?? null,
      doctores_respaldo: asigs.slice(1),
      estudios_pendientes: estudiosPendMap.get(p.id) ?? 0,
    }
  })

  return (
    <PacientesClient
      pacientes={pacientes}
      servicios={servicios ?? []}
      doctores={doctores ?? []}
    />
  )
}
