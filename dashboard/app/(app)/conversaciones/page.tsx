import { createServerClient } from "@/lib/supabase/server"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { ConversacionesClient } from "./ConversacionesClient"

export const metadata = { title: "Conversaciones — Clinica Dental" }

export default async function ConversacionesPage() {
  const authClient = await createAuthClient()
  const supabase = createServerClient()

  const [
    { data: { session } },
    { data: perfil },
  ] = await Promise.all([
    authClient.auth.getSession(),
    authClient.from("profiles").select("clinica_id").maybeSingle(),
  ])

  // clinica_id del perfil del usuario autenticado
  const userId = session?.user?.id
  const { data: perfilCompleto } = userId
    ? await authClient.from("profiles").select("clinica_id").eq("id", userId).single()
    : { data: null }

  const clinicaId = perfilCompleto?.clinica_id ?? null

  if (!clinicaId) {
    const nombreUsuario: string = session?.user?.user_metadata?.nombre ?? ""
    return (
      <ConversacionesClient
        conversaciones={[]}
        agentes={[]}
        papelera={[]}
        nombreUsuario={nombreUsuario}
        agenteActual={null}
      />
    )
  }

  const [
    { data: conversaciones },
    { data: agentes },
    { data: papelera },
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
  ])

  const nombreUsuario: string = session?.user?.user_metadata?.nombre ?? ""
  const listaAgentes = agentes ?? []
  const agenteActual =
    (nombreUsuario
      ? listaAgentes.find((a) => a.nombre === nombreUsuario)
      : undefined) ?? listaAgentes[0] ?? null

  return (
    <ConversacionesClient
      conversaciones={conversaciones ?? []}
      agentes={listaAgentes}
      papelera={papelera ?? []}
      nombreUsuario={nombreUsuario}
      agenteActual={agenteActual}
    />
  )
}
