import { listarPlanesAdmin } from "../actions"
import { PlanesClient } from "./PlanesClient"

export const dynamic = "force-dynamic"

export default async function SuperadminPlanesPage() {
  const planes = await listarPlanesAdmin()
  return <PlanesClient planesIniciales={planes} />
}
