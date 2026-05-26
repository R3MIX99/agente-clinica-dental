"use server"

import { createServerClient } from "@/lib/supabase/server"
import { resolverClinicaId } from "@/lib/supabase/server-auth"
import { revalidatePath } from "next/cache"

export type DatosAgente = {
  nombre: string
  email: string
  role: "admin" | "recepcion" | "odontologo"
  activo: boolean
}

export async function crearAgente(datos: DatosAgente) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase.from("agents").insert({
    clinica_id: clinicaId,
    nombre: datos.nombre,
    email: datos.email || null,
    role: datos.role,
    activo: datos.activo,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/agentes")
}

export async function actualizarAgente(id: string, datos: DatosAgente) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase
    .from("agents")
    .update({
      nombre: datos.nombre,
      email: datos.email || null,
      role: datos.role,
      activo: datos.activo,
    })
    .eq("id", id)
    .eq("clinica_id", clinicaId)
  if (error) throw new Error(error.message)
  revalidatePath("/agentes")
}

export async function toggleActivoAgente(id: string, activo: boolean) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase
    .from("agents")
    .update({ activo })
    .eq("id", id)
    .eq("clinica_id", clinicaId)
  if (error) throw new Error(error.message)
  revalidatePath("/agentes")
}
