import { redirect } from "next/navigation"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import { CitasClient } from "./CitasClient"

export const metadata = { title: "Citas — Clinica Dental" }

export default async function CitasPage() {
  const authClient = await createAuthClient()
  const { data: { session } } = await authClient.auth.getSession()
  if (!session?.user) redirect("/login")

  const db = createServerClient()

  // Fase 1 — perfil + datos estaticos en paralelo
  const [
    { data: perfil },
    { data: todosPacientes },
    { data: servicios },
    { data: todosDoctores },
  ] = await Promise.all([
    authClient
      .from("profiles")
      .select("rol, doctor_id, clinica_id")
      .eq("id", session.user.id)
      .single(),
    // pacientes y servicios se cargan aqui sin filtro; se filtran por clinicaId abajo
    Promise.resolve({ data: null }),
    Promise.resolve({ data: null }),
    Promise.resolve({ data: null }),
  ])

  const clinicaId = perfil?.clinica_id ?? null
  const esDoctor = perfil?.rol === "doctor"
  const doctorId = perfil?.doctor_id ?? null

  if (!clinicaId) {
    return (
      <CitasClient
        citas={[]}
        pacientes={[]}
        servicios={[]}
        doctores={[]}
        esDoctor={esDoctor}
        doctorId={doctorId}
      />
    )
  }

  // Fase 2 — datos con filtro de clinica en paralelo
  const [
    { data: pacientesRaw },
    { data: serviciosRaw },
    { data: doctoresRaw },
  ] = await Promise.all([
    db.from("patients").select("id, nombre, channel, channel_user_id").eq("clinica_id", clinicaId).order("nombre"),
    db.from("services").select("id, nombre, precio, duracion_min").eq("clinica_id", clinicaId).eq("activo", true).order("nombre"),
    db.from("doctors").select("id, nombre").eq("clinica_id", clinicaId).order("nombre"),
  ])

  // Fase 3 — citas (filtradas por clinica) + asignaciones del doctor
  let citasQuery = db
    .from("appointments")
    .select(
      "id, patient_id, service_id, doctor_id, fecha_hora, costo, duracion_min, status, recordatorio_enviado_at, notas, serie_id, recurrencia_tipo, recurrencia_fin, patients(id, nombre, channel, channel_user_id), services(id, nombre, precio, duracion_min), doctors(id, nombre)"
    )
    .eq("clinica_id", clinicaId)
    .order("fecha_hora", { ascending: false })
    .limit(200)

  if (esDoctor && doctorId) {
    citasQuery = citasQuery.eq("doctor_id", doctorId)
  }

  const [{ data: citas }, { data: asignaciones }] = await Promise.all([
    citasQuery,
    esDoctor && doctorId
      ? db.from("patient_doctors").select("patient_id").eq("clinica_id", clinicaId).eq("doctor_id", doctorId)
      : Promise.resolve({ data: null, error: null }),
  ])

  // Filtrar pacientes y doctores visibles segun el rol
  const idsPermitidos =
    esDoctor && doctorId
      ? new Set((asignaciones ?? []).map((a) => a.patient_id))
      : null

  const pacientes = idsPermitidos
    ? (pacientesRaw ?? []).filter((p) => idsPermitidos.has(p.id))
    : (pacientesRaw ?? [])

  const doctores = esDoctor && doctorId
    ? (doctoresRaw ?? []).filter((d) => d.id === doctorId)
    : (doctoresRaw ?? [])

  return (
    <CitasClient
      citas={(citas ?? []) as Parameters<typeof CitasClient>[0]["citas"]}
      pacientes={pacientes}
      servicios={(serviciosRaw ?? []) as Parameters<typeof CitasClient>[0]["servicios"]}
      doctores={doctores}
      esDoctor={esDoctor}
      doctorId={doctorId}
    />
  )
}
