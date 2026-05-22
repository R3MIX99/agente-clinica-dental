import { notFound } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { DoctorFichaClient } from "./DoctorFichaClient"

export const metadata = { title: "Ficha de doctor — Clinica Dental" }

export default async function DoctorFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = createServerClient()
  const { id } = await params

  const ahora = new Date().toISOString()

  const [
    { data: doctor },
    { data: horarios },
    { data: citasRaw },
  ] = await Promise.all([
    supabase
      .from("doctors")
      .select("id, nombre, email, especialidades, fecha_ingreso, created_at")
      .eq("id", id)
      .single(),
    supabase
      .from("doctor_schedules")
      .select("id, dia_semana, hora_inicio, hora_fin, created_at")
      .eq("doctor_id", id)
      .order("dia_semana")
      .order("hora_inicio"),
    supabase
      .from("appointments")
      .select(
        "id, fecha_hora, status, notas, patients(id, nombre), services(id, nombre, duracion_min)"
      )
      .eq("doctor_id", id)
      .gte("fecha_hora", ahora)
      .in("status", ["programada", "confirmada"])
      .order("fecha_hora"),
  ])

  if (!doctor) notFound()

  const citas = (citasRaw ?? []).map((c) => ({
    id: c.id,
    fecha_hora: c.fecha_hora,
    status: c.status,
    notas: c.notas,
    paciente: c.patients as { id: string; nombre: string } | null,
    servicio: c.services as {
      id: string
      nombre: string
      duracion_min: number | null
    } | null,
  }))

  return (
    <DoctorFichaClient
      doctor={doctor}
      horarios={horarios ?? []}
      citas={citas}
    />
  )
}
