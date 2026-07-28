import { redirect } from "next/navigation"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import { PacientesClient } from "./PacientesClient"

export const metadata = { title: "Pacientes — Clínica Dental" }

export default async function PacientesPage() {
  const authClient = await createAuthClient()
  const { data: { session } } = await authClient.auth.getSession()
  if (!session?.user) redirect("/login")

  const db = createServerClient()
  const ahora = new Date().toISOString()

  const { data: perfil } = await authClient
    .from("profiles")
    .select("rol, doctor_id, clinica_id")
    .eq("id", session.user.id)
    .single()

  const clinicaId = perfil?.clinica_id ?? null
  const esDoctor = perfil?.rol === "doctor"
  const doctorId = perfil?.doctor_id ?? null

  // Cuenta de doctor sin vincular a un registro de "doctors": por seguridad
  // no se le muestra nada en vez de mostrarle todos los pacientes de la clinica.
  if (!clinicaId || (esDoctor && !doctorId)) {
    return (
      <PacientesClient
        pacientes={[]}
        servicios={[]}
        doctores={[]}
        esDoctor={esDoctor}
      />
    )
  }

  const [
    { data: pacientesRaw },
    { data: citasFuturas },
    { data: asignaciones },
    { data: estudios },
    { data: servicios },
    { data: doctores },
  ] = await Promise.all([
    db
      .from("patients")
      .select(
        "id, nombre, telefono, email, channel, channel_user_id, notas, created_at, laboratorio, tiempo_cita_min, fecha_ingreso"
      )
      .eq("clinica_id", clinicaId)
      .order("nombre"),
    db
      .from("appointments")
      .select("id, patient_id, fecha_hora, services(nombre)")
      .eq("clinica_id", clinicaId)
      .gte("fecha_hora", ahora)
      .in("status", ["programada", "confirmada"])
      .order("fecha_hora"),
    db
      .from("patient_doctors")
      .select("patient_id, doctor_id, orden, doctors(id, nombre)")
      .eq("clinica_id", clinicaId)
      .order("patient_id")
      .order("orden"),
    db.from("studies").select("patient_id").eq("clinica_id", clinicaId).eq("status", "pendiente"),
    db.from("services").select("id, nombre, precio").eq("clinica_id", clinicaId).eq("activo", true).order("nombre"),
    db.from("doctors").select("id, nombre").eq("clinica_id", clinicaId).order("nombre"),
  ])

  const idsPermitidos: Set<string> | null =
    esDoctor && doctorId
      ? new Set(
          (asignaciones ?? [])
            .filter((a) => a.doctor_id === doctorId)
            .map((a) => a.patient_id)
        )
      : null

  const proximaCitaMap = new Map<
    string,
    { fecha_hora: string; servicio_nombre: string | null }
  >()
  for (const cita of citasFuturas ?? []) {
    if (!cita.patient_id) continue
    if (idsPermitidos && !idsPermitidos.has(cita.patient_id)) continue
    if (!proximaCitaMap.has(cita.patient_id)) {
      const svc = cita.services as { nombre: string } | null
      proximaCitaMap.set(cita.patient_id, {
        fecha_hora: cita.fecha_hora,
        servicio_nombre: svc?.nombre ?? null,
      })
    }
  }

  const doctorAsignMap = new Map<
    string,
    Array<{ id: string; nombre: string; orden: number }>
  >()
  for (const asig of asignaciones ?? []) {
    if (idsPermitidos && !idsPermitidos.has(asig.patient_id)) continue
    const doc = asig.doctors as { id: string; nombre: string } | null
    if (!doc) continue
    const lista = doctorAsignMap.get(asig.patient_id) ?? []
    lista.push({ id: doc.id, nombre: doc.nombre, orden: asig.orden })
    doctorAsignMap.set(asig.patient_id, lista)
  }

  const estudiosPendMap = new Map<string, number>()
  for (const e of estudios ?? []) {
    if (idsPermitidos && !idsPermitidos.has(e.patient_id)) continue
    estudiosPendMap.set(
      e.patient_id,
      (estudiosPendMap.get(e.patient_id) ?? 0) + 1
    )
  }

  const pacientes = (pacientesRaw ?? [])
    .filter((p) => !idsPermitidos || idsPermitidos.has(p.id))
    .map((p) => {
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
      esDoctor={esDoctor}
    />
  )
}
