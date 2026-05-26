"use server"

import { createServerClient } from "@/lib/supabase/server"
import { resolverClinicaId } from "@/lib/supabase/server-auth"
import { revalidatePath } from "next/cache"

export type DatosBloqueHorario = {
  dia_semana: string
  hora_inicio: string
  hora_fin: string
}

export async function agregarBloqueHorario(
  doctorId: string,
  datos: DatosBloqueHorario
) {
  const dia = parseInt(datos.dia_semana)
  if (isNaN(dia) || dia < 0 || dia > 6) throw new Error("Dia invalido")
  if (!datos.hora_inicio || !datos.hora_fin)
    throw new Error("Hora de inicio y fin son requeridas")
  if (datos.hora_fin <= datos.hora_inicio)
    throw new Error("La hora de fin debe ser posterior a la de inicio")

  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase.from("doctor_schedules").insert({
    clinica_id: clinicaId,
    doctor_id: doctorId,
    dia_semana: dia,
    hora_inicio: datos.hora_inicio,
    hora_fin: datos.hora_fin,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/doctores/${doctorId}`)
}

export async function eliminarBloqueHorario(
  scheduleId: string,
  doctorId: string
) {
  const clinicaId = await resolverClinicaId()
  const supabase = createServerClient()
  const { error } = await supabase
    .from("doctor_schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("clinica_id", clinicaId)
  if (error) throw new Error(error.message)
  revalidatePath(`/doctores/${doctorId}`)
}
