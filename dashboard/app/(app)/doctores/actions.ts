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
  es_principal: boolean
}

// Deja a lo sumo un doctor "principal" por clinica: si se va a marcar uno
// nuevo, primero se desmarca cualquier otro (el indice unico parcial en
// doctors.es_principal tambien lo obliga a nivel de base de datos, esto
// solo evita que el update a medias choque contra el).
async function limpiarOtrosPrincipales(
  db: ReturnType<typeof createServerClient>,
  clinicaId: string,
  idAExcluir?: string
) {
  let q = db.from("doctors").update({ es_principal: false }).eq("clinica_id", clinicaId).eq("es_principal", true)
  if (idAExcluir) q = q.neq("id", idAExcluir)
  await q
}

export async function crearDoctor(datos: DatosDoctor) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  if (datos.es_principal) {
    await limpiarOtrosPrincipales(supabase, clinicaId)
  }

  const { error } = await supabase.from("doctors").insert({
    clinica_id: clinicaId,
    nombre: datos.nombre.trim(),
    email: datos.email.trim() || null,
    fecha_ingreso: datos.fecha_ingreso || null,
    especialidades: datos.especialidades.length > 0 ? datos.especialidades : null,
    es_principal: datos.es_principal,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/doctores")
}

export async function actualizarDoctor(id: string, datos: DatosDoctor) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const emailFinal = datos.email.trim() || null

  if (datos.es_principal) {
    await limpiarOtrosPrincipales(supabase, clinicaId, id)
  }

  const { error } = await supabase
    .from("doctors")
    .update({
      nombre: datos.nombre.trim(),
      email: emailFinal,
      fecha_ingreso: datos.fecha_ingreso || null,
      especialidades: datos.especialidades.length > 0 ? datos.especialidades : null,
      es_principal: datos.es_principal,
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
