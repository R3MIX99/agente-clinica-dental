import { notFound, redirect } from "next/navigation"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import { DoctorFichaClient } from "./DoctorFichaClient"

export const metadata = { title: "Ficha de doctor — Clínica Dental" }

export default async function DoctorFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const authClient = await createAuthClient()
  const { data: { session } } = await authClient.auth.getSession()
  if (!session?.user) redirect("/login")

  const { id } = await params

  const { data: perfil } = await authClient
    .from("profiles")
    .select("rol, doctor_id, clinica_id")
    .eq("id", session.user.id)
    .single()

  if (perfil?.rol === "doctor") {
    if (!perfil.doctor_id || perfil.doctor_id !== id) {
      if (perfil.doctor_id) redirect(`/doctores/${perfil.doctor_id}`)
      else redirect("/citas")
    }
  }

  const clinicaId = perfil?.clinica_id ?? null
  const db = createServerClient()
  const ahora = new Date().toISOString()

  const [
    { data: doctor },
    { data: horarios },
    { data: citasRaw },
    { data: pacientesRaw },
  ] = await Promise.all([
    db
      .from("doctors")
      .select("id, nombre, email, especialidades, fecha_ingreso, created_at")
      .eq("id", id)
      .single(),
    db
      .from("doctor_schedules")
      .select("id, dia_semana, hora_inicio, hora_fin, created_at")
      .eq("doctor_id", id)
      .order("dia_semana")
      .order("hora_inicio"),
    db
      .from("appointments")
      .select(
        "id, fecha_hora, status, notas, patients(id, nombre), services(id, nombre, duracion_min)"
      )
      .eq("doctor_id", id)
      .eq("clinica_id", clinicaId ?? "")
      .gte("fecha_hora", ahora)
      .in("status", ["programada", "confirmada"])
      .order("fecha_hora"),
    db
      .from("patient_doctors")
      .select("orden, patients(id, nombre, telefono, email, channel)")
      .eq("doctor_id", id)
      .eq("clinica_id", clinicaId ?? ""),
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

  const pacientes = (pacientesRaw ?? [])
    .map((pd) => {
      const p = pd.patients as {
        id: string
        nombre: string
        telefono: string | null
        email: string | null
        channel: string | null
      } | null
      if (!p) return null
      return {
        id: p.id,
        nombre: p.nombre,
        telefono: p.telefono,
        email: p.email,
        channel: p.channel,
        orden: pd.orden,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a!.nombre.localeCompare(b!.nombre)) as Array<{
    id: string
    nombre: string
    telefono: string | null
    email: string | null
    channel: string | null
    orden: number
  }>

  return (
    <DoctorFichaClient
      doctor={doctor}
      horarios={horarios ?? []}
      citas={citas}
      pacientes={pacientes}
    />
  )
}
