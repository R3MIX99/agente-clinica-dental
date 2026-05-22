"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type DatosAgente = {
  nombre: string
  email: string
  role: "admin" | "recepcion" | "odontologo"
  activo: boolean
}

export async function crearAgente(datos: DatosAgente) {
  const supabase = createServerClient()
  const { error } = await supabase.from("agents").insert({
    nombre: datos.nombre,
    email: datos.email || null,
    role: datos.role,
    activo: datos.activo,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/agentes")
}

export async function actualizarAgente(id: string, datos: DatosAgente) {
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
  if (error) throw new Error(error.message)
  revalidatePath("/agentes")
}

export async function toggleActivoAgente(id: string, activo: boolean) {
  const supabase = createServerClient()
  const { error } = await supabase
    .from("agents")
    .update({ activo })
    .eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/agentes")
}
