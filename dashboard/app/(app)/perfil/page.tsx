import { redirect } from "next/navigation"
import { obtenerMiPerfil } from "./actions"
import { PerfilClient } from "./PerfilClient"

export const metadata = { title: "Mi perfil — Clínica Dental" }

export default async function PerfilPage() {
  const perfil = await obtenerMiPerfil()
  if (!perfil) redirect("/login")

  return <PerfilClient perfil={perfil} />
}
