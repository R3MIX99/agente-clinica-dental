"use server"

import { createServerClient } from "@/lib/supabase/server"
import { resolverClinicaId } from "@/lib/supabase/server-auth"
import { revalidatePath } from "next/cache"
import type { Json } from "@/types/supabase"

// ---------------------------------------------------------------------------
// Tipos exportados
// ---------------------------------------------------------------------------

export type FaqItem = {
  pregunta: string
  respuesta: string
}

export type DatosIdentidad = {
  nombre: string
  logo_url: string
  direccion: string
  telefono: string
  email: string
  sitio_web: string
  horario: string
  formas_pago: string
  facturacion: string
  mapa_url: string
}

export type DatosServicio = {
  nombre: string
  descripcion: string
  precio: number
  duracion_min: number
}

export type CanalTelegramPublico = {
  id: string
  activo: boolean
  webhook_url: string | null
  bot_url: string | null
  tiene_token: boolean
  updated_at: string
} | null

// ---------------------------------------------------------------------------
// Identidad de la clinica
// ---------------------------------------------------------------------------

export async function guardarIdentidad(datos: DatosIdentidad) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const { error } = await supabase
    .from("clinicas")
    .update({
      nombre:       datos.nombre       || null,
      logo_url:     datos.logo_url     || null,
      direccion:    datos.direccion    || null,
      telefono:     datos.telefono     || null,
      email:        datos.email        || null,
      sitio_web:    datos.sitio_web    || null,
      horario:      datos.horario      || null,
      formas_pago:  datos.formas_pago  || null,
      facturacion:  datos.facturacion  || null,
      mapa_url:     datos.mapa_url     || null,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", clinicaId)

  if (error) throw new Error(error.message)
  revalidatePath("/ajustes")
}

// Mantener compatibilidad con el nombre anterior
export async function guardarAjustes(datos: DatosIdentidad & { faq: FaqItem[] }) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const { error } = await supabase
    .from("clinicas")
    .update({
      nombre:       datos.nombre       || null,
      logo_url:     datos.logo_url     || null,
      direccion:    datos.direccion    || null,
      telefono:     datos.telefono     || null,
      email:        datos.email        || null,
      sitio_web:    datos.sitio_web    || null,
      horario:      datos.horario      || null,
      formas_pago:  datos.formas_pago  || null,
      facturacion:  datos.facturacion  || null,
      mapa_url:     datos.mapa_url     || null,
      faq:          datos.faq.length > 0 ? datos.faq : null,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", clinicaId)

  if (error) throw new Error(error.message)
  revalidatePath("/ajustes")
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export async function guardarFaq(faq: FaqItem[]) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const { error } = await supabase
    .from("clinicas")
    .update({
      faq:        faq.length > 0 ? faq : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clinicaId)

  if (error) throw new Error(error.message)
  revalidatePath("/ajustes")
}

// ---------------------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------------------

export async function agregarServicio(datos: DatosServicio) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const { error } = await supabase.from("services").insert({
    clinica_id:   clinicaId,
    nombre:       datos.nombre,
    descripcion:  datos.descripcion || null,
    precio:       datos.precio,
    duracion_min: datos.duracion_min || null,
    activo:       true,
  })

  if (error) throw new Error(error.message)
  revalidatePath("/ajustes")
}

export async function actualizarServicio(id: string, datos: DatosServicio) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const { error } = await supabase
    .from("services")
    .update({
      nombre:       datos.nombre,
      descripcion:  datos.descripcion || null,
      precio:       datos.precio,
      duracion_min: datos.duracion_min || null,
    })
    .eq("id", id)
    .eq("clinica_id", clinicaId)

  if (error) throw new Error(error.message)
  revalidatePath("/ajustes")
}

export async function toggleServicio(id: string, activo: boolean) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const { error } = await supabase
    .from("services")
    .update({ activo })
    .eq("id", id)
    .eq("clinica_id", clinicaId)

  if (error) throw new Error(error.message)
  revalidatePath("/ajustes")
}

export async function eliminarServicio(id: string) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("clinica_id", clinicaId)

  if (error) throw new Error(error.message)
  revalidatePath("/ajustes")
}

// ---------------------------------------------------------------------------
// Canal por clinica
//   - config.bot_token NUNCA se devuelve al cliente
//   - El cliente solo recibe: activo, webhook_url, tiene_token (boolean)
// ---------------------------------------------------------------------------

export async function guardarCanal(datos: {
  canal: "telegram" | "whatsapp"
  activo: boolean
  bot_token?: string
  webhook_url?: string
  bot_url?: string
}): Promise<{ ok: boolean; mensaje: string }> {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()

  // Obtener registro existente (incluye config para conservar token anterior)
  const { data: existente } = await supabase
    .from("clinic_channels")
    .select("id, config")
    .eq("clinica_id", clinicaId)
    .eq("canal", datos.canal)
    .maybeSingle()

  const configActual = (existente?.config as Record<string, unknown>) ?? {}

  // Solo actualizar el token si el usuario escribio uno nuevo
  const configNuevo: Record<string, unknown> = { ...configActual }
  if (datos.bot_token && datos.bot_token.trim()) {
    configNuevo.bot_token = datos.bot_token.trim()
  }
  // Actualizar URL publica del bot (se permite vaciar)
  if (datos.bot_url !== undefined) {
    const url = datos.bot_url.trim()
    if (url) configNuevo.bot_url = url
    else delete configNuevo.bot_url
  }

  const payload = {
    clinica_id:  clinicaId,
    canal:       datos.canal,
    activo:      datos.activo,
    webhook_url: datos.webhook_url?.trim() || null,
    config:      configNuevo as Json,
    updated_at:  new Date().toISOString(),
  }

  if (existente) {
    const { error } = await supabase
      .from("clinic_channels")
      .update(payload)
      .eq("id", existente.id)
    if (error) return { ok: false, mensaje: error.message }
  } else {
    const { error } = await supabase
      .from("clinic_channels")
      .insert(payload)
    if (error) return { ok: false, mensaje: error.message }
  }

  revalidatePath("/ajustes")
  return { ok: true, mensaje: "Configuración de canal guardada." }
}
