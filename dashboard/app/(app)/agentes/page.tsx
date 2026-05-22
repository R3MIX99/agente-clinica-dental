import { createServerClient } from "@/lib/supabase/server"
import { AgentesClient } from "./AgentesClient"

export const metadata = { title: "Agentes — Clinica Dental" }

export default async function AgentesPage() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("agents")
    .select("id, nombre, email, role, activo, created_at")
    .order("created_at", { ascending: true })

  return <AgentesClient agentes={data ?? []} />
}
