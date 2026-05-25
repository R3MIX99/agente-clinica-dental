import { createServerClient } from "@/lib/supabase/server"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { ConversacionesClient } from "./ConversacionesClient"

export const metadata = { title: "Conversaciones — Clinica Dental" }

export default async function ConversacionesPage() {
  const authClient = await createAuthClient()
  const supabase = createServerClient()

  const [
    { data: { session } },
    { data: conversaciones },
    { data: agentes },
    { data: papelera },
  ] = await Promise.all([
    authClient.auth.getSession(),
    supabase
      .from("conversations")
      .select(
        "id, channel, mode, status, last_message_at, assigned_agent_id, patients(id, nombre, channel, channel_user_id), agents(nombre)"
      )
      .is("deleted_at", null)
      .order("last_message_at", { ascending: false }),
    supabase
      .from("agents")
      .select("id, nombre, role")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("conversations")
      .select(
        "id, channel, mode, status, last_message_at, assigned_agent_id, patients(id, nombre, channel, channel_user_id), agents(nombre)"
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ])

  // Nombre del usuario actual (del JWT — sin llamada extra a la BD)
  const nombreUsuario: string =
    session?.user?.user_metadata?.nombre ?? ""

  // Buscar el registro de agente que corresponde al usuario logueado (por nombre).
  // Si no hay coincidencia, cae al primer agente disponible como respaldo.
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
