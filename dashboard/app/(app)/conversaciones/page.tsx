import { createServerClient } from "@/lib/supabase/server"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { resolverClinicaId } from "@/lib/supabase/server-auth"
import { ConversacionesClient } from "./ConversacionesClient"

export const metadata = { title: "Conversaciones — Clínica Dental" }

export default async function ConversacionesPage() {
  const authClient = await createAuthClient()
  const supabase = createServerClient()

  // Leer el nombre desde profiles (fuente de verdad), no de los metadatos
  // del JWT que solo se actualizan al iniciar sesión de nuevo.
  const { data: { user } } = await authClient.auth.getUser()
  let nombreUsuario = ""
  if (user) {
    const { data: perfilUsuario } = await supabase
      .from("profiles")
      .select("nombre")
      .eq("id", user.id)
      .single()
    nombreUsuario = perfilUsuario?.nombre ?? user.user_metadata?.nombre ?? ""
  }

  // Resolver clinica activa con la misma logica que el resto del sistema:
  // 1. Cookie "clinica_activa" validada contra membresias
  // 2. Primera membresia activa
  // 3. profiles.clinica_id como fallback
  let clinicaId: string | null = null
  try {
    clinicaId = await resolverClinicaId()
  } catch {
    // Sin clinica activa — se muestra pantalla vacia
  }

  if (!clinicaId) {
    return (
      <ConversacionesClient
        conversaciones={[]}
        agentes={[]}
        papelera={[]}
        nombreUsuario={nombreUsuario}
        agenteActual={null}
        botUrl={null}
      />
    )
  }

  const [
    { data: conversaciones },
    { data: agentes },
    { data: papelera },
    { data: canal },
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select(
        "id, channel, mode, status, last_message_at, assigned_agent_id, patients(id, nombre, channel, channel_user_id), agents(nombre)"
      )
      .eq("clinica_id", clinicaId)
      .is("deleted_at", null)
      .order("last_message_at", { ascending: false }),
    supabase
      .from("agents")
      .select("id, nombre, role")
      .eq("clinica_id", clinicaId)
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("conversations")
      .select(
        "id, channel, mode, status, last_message_at, assigned_agent_id, patients(id, nombre, channel, channel_user_id), agents(nombre)"
      )
      .eq("clinica_id", clinicaId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("clinic_channels")
      .select("config")
      .eq("clinica_id", clinicaId)
      .eq("canal", "telegram")
      .maybeSingle(),
  ])

  const listaAgentes = agentes ?? []
  const agenteActual =
    (nombreUsuario
      ? listaAgentes.find((a) => a.nombre === nombreUsuario)
      : undefined) ?? listaAgentes[0] ?? null

  const botUrl =
    ((canal?.config as Record<string, unknown> | undefined)?.bot_url as string | undefined) ?? null

  return (
    <ConversacionesClient
      conversaciones={conversaciones ?? []}
      agentes={listaAgentes}
      papelera={papelera ?? []}
      nombreUsuario={nombreUsuario}
      agenteActual={agenteActual}
      botUrl={botUrl}
    />
  )
}
