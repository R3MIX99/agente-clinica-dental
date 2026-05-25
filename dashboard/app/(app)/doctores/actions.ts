"use server"

import { createServerClient } from "@/lib/supabase/server"
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

  // Buscar el perfil de usuario vinculado a este doctor
  const { data: perfil } = await db
    .from("profiles")
    .select("id, email")
    .eq("doctor_id", doctorId)
    .maybeSingle()

  if (!perfil || perfil.email === nuevoEmail) return

  // Actualizar email en profiles
  await db.from("profiles").update({ email: nuevoEmail }).eq("id", perfil.id)

  // Actualizar email en auth (puede requerir verificacion segun configuracion de Supabase)
  await db.auth.admin.updateUserById(perfil.id, { email: nuevoEmail })
}

export type DatosDoctor = {
  nombre: string
  email: string
  fecha_ingreso: string
  especialidades: string[]
}

export async function crearDoctor(datos: DatosDoctor) {
  const supabase = createServerClient()
  const { error } = await supabase.from("doctors").insert({
    nombre: datos.nombre.trim(),
    email: datos.email.trim() || null,
    fecha_ingreso: datos.fecha_ingreso || null,
    especialidades:
      datos.especialidades.length > 0 ? datos.especialidades : null,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/doctores")
}

export async function actualizarDoctor(id: string, datos: DatosDoctor) {
  const supabase = createServerClient()

  const emailFinal = datos.email.trim() || null

  const { error } = await supabase
    .from("doctors")
    .update({
      nombre: datos.nombre.trim(),
      email: emailFinal,
      fecha_ingreso: datos.fecha_ingreso || null,
      especialidades:
        datos.especialidades.length > 0 ? datos.especialidades : null,
    })
    .eq("id", id)
  if (error) throw new Error(error.message)

  // Sincronizar el nuevo correo al usuario vinculado (profiles + auth)
  await sincronizarEmailDoctor(supabase, id, emailFinal)

  revalidatePath("/doctores")
  revalidatePath(`/doctores/${id}`)
  revalidatePath("/usuarios")
}

export async function eliminarDoctor(id: string) {
  const supabase = createServerClient()
  const { error } = await supabase.from("doctors").delete().eq("id", id)
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
