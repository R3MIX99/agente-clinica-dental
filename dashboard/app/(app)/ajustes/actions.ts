"use server"

import { createServerClient } from "@/lib/supabase/server"
import { resolverClinicaId } from "@/lib/supabase/server-auth"
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
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

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

  const { error } = await supabase
    .from("clinicas")
    .update(payload)
    .eq("id", clinicaId)
  if (error) throw new Error(error.message)

  revalidatePath("/ajustes")
}
