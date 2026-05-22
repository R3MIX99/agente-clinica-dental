"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type FaqItem = {
  pregunta: string
  respuesta: string
}

export type DatosClinica = {
  nombre: string
  direccion: string
  telefono: string
  email: string
  sitio_web: string
  horario: string
  formas_pago: string
  facturacion: string
  mapa_url: string
  faq: FaqItem[]
}

export async function guardarAjustes(datos: DatosClinica) {
  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from("clinic_info")
    .select("id")
    .limit(1)
    .single()

  const payload = {
    nombre: datos.nombre || null,
    direccion: datos.direccion || null,
    telefono: datos.telefono || null,
    email: datos.email || null,
    sitio_web: datos.sitio_web || null,
    horario: datos.horario || null,
    formas_pago: datos.formas_pago || null,
    facturacion: datos.facturacion || null,
    mapa_url: datos.mapa_url || null,
    faq: datos.faq.length > 0 ? datos.faq : null,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await supabase
      .from("clinic_info")
      .update(payload)
      .eq("id", existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from("clinic_info").insert(payload)
    if (error) throw new Error(error.message)
  }

  revalidatePath("/ajustes")
}
