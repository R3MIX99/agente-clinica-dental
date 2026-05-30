import { listarPlanes } from "../actions"
import { PlanesClient } from "./PlanesClient"

export const metadata = { title: "Superadmin — Planes" }

export default async function PlanesPage() {
  const planes = await listarPlanes()

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Catalogo de planes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administra los planes disponibles para los clientes del SaaS.
        </p>
      </div>
      <PlanesClient planes={planes} />
    </div>
  )
}
