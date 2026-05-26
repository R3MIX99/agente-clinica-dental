import { redirect } from "next/navigation"
import { createAuthClient } from "@/lib/supabase/server-auth"
import { createServerClient } from "@/lib/supabase/server"
import { AgentesClient } from "./AgentesClient"

export const metadata = { title: "Agentes — Clinica Dental" }

export default async function AgentesPage() {
  const authClient = await createAuthClient()
  const { data: { session } } = await authClient.auth.getSession()
  if (!session?.user) redirect("/login")

  const { data: perfil } = await authClient
    .from("profiles")
    .select("clinica_id")
    .eq("id", session.user.id)
    .single()

  const clinicaId = perfil?.clinica_id ?? null

  if (!clinicaId) {
    return <AgentesClient agentes={[]} />
  }

  const supabase = createServerClient()
  const { data } = await supabase
    .from("agents")
    .select("id, nombre, email, role, activo, created_at")
    .eq("clinica_id", clinicaId)
    .order("created_at", { ascending: true })

  return <AgentesClient agentes={data ?? []} />
}
