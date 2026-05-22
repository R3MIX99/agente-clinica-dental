import { createServerClient } from "@/lib/supabase/server"
import { CitasClient } from "./CitasClient"

export const metadata = { title: "Citas — Clinica Dental" }

export default async function CitasPage() {
  const supabase = createServerClient()

  const [{ data: citas }, { data: pacientes }, { data: servicios }, { data: doctores }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, patient_id, service_id, doctor_id, fecha_hora, costo, duracion_min, status, recordatorio_enviado_at, notas, patients(id, nombre, channel, channel_user_id), services(id, nombre, precio, duracion_min), doctors(id, nombre)"
        )
        .order("fecha_hora", { ascending: false })
        .limit(200),
      supabase
        .from("patients")
        .select("id, nombre, channel, channel_user_id")
        .order("nombre"),
      supabase
        .from("services")
        .select("id, nombre, precio, duracion_min")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("doctors")
        .select("id, nombre")
        .order("nombre"),
    ])

  return (
    <CitasClient
      citas={(citas ?? []) as Parameters<typeof CitasClient>[0]["citas"]}
      pacientes={pacientes ?? []}
      servicios={(servicios ?? []) as Parameters<typeof CitasClient>[0]["servicios"]}
      doctores={doctores ?? []}
    />
  )
}
