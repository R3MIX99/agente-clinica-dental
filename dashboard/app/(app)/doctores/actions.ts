"use server"

import { createServerClient } from "@/lib/supabase/server"
import { resolverClinicaId } from "@/lib/supabase/server-auth"
import { revalidatePath } from "next/cache"

// ---------------------------------------------------------------------------
// Helper: sincronizar email del doctor al perfil de usuario vinculado
// ---------------------------------------------------------------------------

async function sincronizarEmailDoctor(
  db: ReturnType<typeof createServerClient>,
  doctorId: string,
  nuevoEmail: string | null
) {
  if (!nuevoEmail) return

  const { data: perfil } = await db
    .from("profiles")
    .select("id, email")
    .eq("doctor_id", doctorId)
    .maybeSingle()

  if (!perfil || perfil.email === nuevoEmail) return

  await db.from("profiles").update({ email: nuevoEmail }).eq("id", perfil.id)
  await db.auth.admin.updateUserById(perfil.id, { email: nuevoEmail })
}

export type DatosDoctor = {
  nombre: string
  email: string
  fecha_ingreso: string
  especialidades: string[]
}

export async function crearDoctor(datos: DatosDoctor) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase.from("doctors").insert({
    clinica_id: clinicaId,
    nombre: datos.nombre.trim(),
    email: datos.email.trim() || null,
    fecha_ingreso: datos.fecha_ingreso || null,
    especialidades: datos.especialidades.length > 0 ? datos.especialidades : null,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/doctores")
}

export async function actualizarDoctor(id: string, datos: DatosDoctor) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const emailFinal = datos.email.trim() || null

  const { error } = await supabase
    .from("doctors")
    .update({
      nombre: datos.nombre.trim(),
      email: emailFinal,
      fecha_ingreso: datos.fecha_ingreso || null,
      especialidades: datos.especialidades.length > 0 ? datos.especialidades : null,
    })
    .eq("id", id)
    .eq("clinica_id", clinicaId)
  if (error) throw new Error(error.message)

  await sincronizarEmailDoctor(supabase, id, emailFinal)

  revalidatePath("/doctores")
  revalidatePath(`/doctores/${id}`)
  revalidatePath("/usuarios")
}

export async function eliminarDoctor(id: string) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase
    .from("doctors")
    .delete()
    .eq("id", id)
    .eq("clinica_id", clinicaId)
  if (error) {
    if (error.message.includes("foreign key")) {
      throw new Error(
        "No se puede eliminar: el doctor tiene citas o pacientes asociados."
      )
    }
    throw new Error(error.message)
  }
  revalidatePath("/doctores")
}
