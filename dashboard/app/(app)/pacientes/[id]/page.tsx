import { notFound } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { PacienteFichaClient } from "./PacienteFichaClient"

export const metadata = { title: "Ficha de paciente — Clinica Dental" }

export default async function PacienteFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = createServerClient()
  const { id } = await params

  const [
    { data: paciente },
    { data: asignaciones },
    { data: citasRaw },
    { data: estudios },
    { data: notas },
    { data: todosDoctores },
    { data: todosServicios },
  ] = await Promise.all([
    supabase
      .from("patients")
      .select(
        "id, nombre, telefono, email, channel, channel_user_id, notas, laboratorio, tiempo_cita_min, fecha_ingreso, created_at"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("patient_doctors")
      .select("orden, doctors(id, nombre, especialidades, email)")
      .eq("patient_id", id)
      .order("orden"),
    supabase
      .from("appointments")
      .select(
        "id, fecha_hora, status, costo, notas, services(id, nombre, duracion_min), doctors(id, nombre)"
      )
      .eq("patient_id", id)
      .order("fecha_hora", { ascending: false }),
    supabase
      .from("studies")
      .select("id, nombre, descripcion, status, fecha_indicacion, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("clinical_notes")
      .select("id, contenido, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("doctors").select("id, nombre").order("nombre"),
    supabase
      .from("services")
      .select("id, nombre, precio")
      .eq("activo", true)
      .order("nombre"),
  ])

  if (!paciente) notFound()

  // Normalizar doctores asignados al paciente
  const doctoresAsignados = (asignaciones ?? [])
    .map((a) => {
      const d = a.doctors as {
        id: string
        nombre: string
        especialidades: string[] | null
        email: string | null
      } | null
      if (!d) return null
      return { id: d.id, nombre: d.nombre, especialidades: d.especialidades, email: d.email, orden: a.orden }
    })
    .filter(Boolean)
    .sort((a, b) => a!.orden - b!.orden) as Array<{
      id: string
      nombre: string
      especialidades: string[] | null
      email: string | null
      orden: number
    }>

  // Normalizar citas
  const citas = (citasRaw ?? []).map((c) => ({
    id: c.id,
    fecha_hora: c.fecha_hora,
    status: c.status,
    costo: c.costo,
    notas: c.notas,
    servicio: c.services as { id: string; nombre: string; duracion_min: number | null } | null,
    doctor: c.doctors as { id: string; nombre: string } | null,
  }))

  return (
    <PacienteFichaClient
      paciente={paciente}
      doctoresAsignados={doctoresAsignados}
      citas={citas}
      estudios={estudios ?? []}
      notas={notas ?? []}
      todosDoctores={todosDoctores ?? []}
      todosServicios={todosServicios ?? []}
    />
  )
}
