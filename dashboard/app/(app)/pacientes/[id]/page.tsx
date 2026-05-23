import { notFound, redirect } from "next/navigation"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import { PacienteFichaClient } from "./PacienteFichaClient"

export const metadata = { title: "Ficha de paciente — Clinica Dental" }

export default async function PacienteFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const authClient = await createAuthClient()
  const { data: { session } } = await authClient.auth.getSession()
  if (!session?.user) redirect("/login")

  const { id } = await params

  const db = createServerClient()

  // Perfil + datos principales en paralelo
  const [
    { data: perfil },
    { data: paciente },
    { data: asignaciones },
    { data: citasRaw },
    { data: estudios },
    { data: notas },
    { data: todosDoctores },
    { data: todosServicios },
  ] = await Promise.all([
    authClient
      .from("profiles")
      .select("rol, doctor_id")
      .eq("id", session.user.id)
      .single(),
    db
      .from("patients")
      .select(
        "id, nombre, telefono, email, channel, channel_user_id, notas, laboratorio, tiempo_cita_min, fecha_ingreso, created_at"
      )
      .eq("id", id)
      .single(),
    db
      .from("patient_doctors")
      .select("orden, doctors(id, nombre, especialidades, email)")
      .eq("patient_id", id)
      .order("orden"),
    db
      .from("appointments")
      .select(
        "id, fecha_hora, status, costo, notas, services(id, nombre, duracion_min), doctors(id, nombre)"
      )
      .eq("patient_id", id)
      .order("fecha_hora", { ascending: false }),
    db
      .from("studies")
      .select("id, nombre, descripcion, status, fecha_indicacion, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("clinical_notes")
      .select("id, contenido, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    db.from("doctors").select("id, nombre").order("nombre"),
    db.from("services").select("id, nombre, precio").eq("activo", true).order("nombre"),
  ])

  if (!paciente) notFound()

  // Verificar acceso si es doctor: debe estar asignado a este paciente
  if (perfil?.rol === "doctor" && perfil.doctor_id) {
    const asignadoAEste = await db
      .from("patient_doctors")
      .select("id")
      .eq("patient_id", id)
      .eq("doctor_id", perfil.doctor_id)
      .maybeSingle()

    if (!asignadoAEste.data) {
      redirect("/pacientes")
    }
  }

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
