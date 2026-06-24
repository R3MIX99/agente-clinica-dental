import { redirect } from "next/navigation"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import { OnboardingWizard } from "./OnboardingWizard"

export const metadata = { title: "Configuración inicial — DentalIA" }

export default async function OnboardingPage() {
  const authClient = await createAuthClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) redirect("/login")

  const db = createServerClient()

  // Leer perfil para obtener clinica_id
  const { data: perfil } = await db
    .from("profiles")
    .select("clinica_id, nombre")
    .eq("id", user.id)
    .single()

  if (!perfil?.clinica_id) redirect("/login")

  // Leer datos actuales de la clinica
  const { data: clinica } = await db
    .from("clinicas")
    .select("id, nombre, telefono, email, direccion, sitio_web, horario, onboarding_completado, onboarding_paso")
    .eq("id", perfil.clinica_id)
    .single()

  // Si ya completo onboarding, ir al panel
  if (clinica?.onboarding_completado) redirect("/conversaciones")

  // Leer servicios existentes
  const { data: servicios } = await db
    .from("services")
    .select("nombre, precio, duracion_min")
    .eq("clinica_id", perfil.clinica_id)
    .eq("activo", true)
    .limit(10)

  // Estado del canal de Telegram (para el paso final)
  const { data: canal } = await db
    .from("clinic_channels")
    .select("activo, config")
    .eq("clinica_id", perfil.clinica_id)
    .eq("canal", "telegram")
    .maybeSingle()
  const cfg = canal?.config as { bot_token?: string } | null
  const telegramConectado = !!canal?.activo && !!cfg?.bot_token

  return (
    <OnboardingWizard
      nombreUsuario={perfil.nombre ?? "Administrador"}
      clinicaInicial={{
        nombre: clinica?.nombre ?? "",
        telefono: clinica?.telefono ?? "",
        email: clinica?.email ?? "",
        direccion: clinica?.direccion ?? "",
        sitio_web: (clinica as any)?.sitio_web ?? "",
        horario: clinica?.horario ?? "",
      }}
      serviciosIniciales={(servicios ?? []).map((s) => ({
        nombre: s.nombre,
        precio: String(s.precio ?? ""),
        duracion_min: String(s.duracion_min ?? "30"),
      }))}
      pasoInicial={clinica?.onboarding_paso ?? 1}
      telegramConectado={telegramConectado}
    />
  )
}
