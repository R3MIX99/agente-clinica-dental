"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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
  const { error } = await supabase
    .from("doctors")
    .update({
      nombre: datos.nombre.trim(),
      email: datos.email.trim() || null,
      fecha_ingreso: datos.fecha_ingreso || null,
      especialidades:
        datos.especialidades.length > 0 ? datos.especialidades : null,
    })
    .eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/doctores")
  revalidatePath(`/doctores/${id}`)
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
