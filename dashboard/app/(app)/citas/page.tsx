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

  // Perfil en paralelo con el resto de los datos
  const [
    { data: perfil },
    { data: pacientes },
    { data: servicios },
    { data: doctores },
  ] = await Promise.all([
    authClient
      .from("profiles")
      .select("rol, doctor_id")
      .eq("id", session.user.id)
      .single(),
    db.from("patients").select("id, nombre, channel, channel_user_id").order("nombre"),
    db.from("services").select("id, nombre, precio, duracion_min").eq("activo", true).order("nombre"),
    db.from("doctors").select("id, nombre").order("nombre"),
  ])

  const esDoctor = perfil?.rol === "doctor"
  const doctorId = perfil?.doctor_id ?? null

  // Citas: si es doctor, filtrar solo las suyas
  let citasQuery = db
    .from("appointments")
    .select(
      "id, patient_id, service_id, doctor_id, fecha_hora, costo, duracion_min, status, recordatorio_enviado_at, notas, patients(id, nombre, channel, channel_user_id), services(id, nombre, precio, duracion_min), doctors(id, nombre)"
    )
    .order("fecha_hora", { ascending: false })
    .limit(200)

  if (esDoctor && doctorId) {
    citasQuery = citasQuery.eq("doctor_id", doctorId)
  }

  const { data: citas } = await citasQuery

  return (
    <CitasClient
      citas={(citas ?? []) as Parameters<typeof CitasClient>[0]["citas"]}
      pacientes={pacientes ?? []}
      servicios={(servicios ?? []) as Parameters<typeof CitasClient>[0]["servicios"]}
      doctores={doctores ?? []}
    />
  )
}
