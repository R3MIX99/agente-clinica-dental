import { createServerClient } from "@/lib/supabase/server"
import { ConversacionesClient } from "./ConversacionesClient"

export const metadata = { title: "Conversaciones — Clinica Dental" }

export default async function ConversacionesPage() {
  const supabase = createServerClient()

  const [{ data: conversaciones }, { data: agentes }, { data: papelera }] =
    await Promise.all([
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

  return (
    <ConversacionesClient
      conversaciones={conversaciones ?? []}
      agentes={agentes ?? []}
      papelera={papelera ?? []}
    />
  )
}
