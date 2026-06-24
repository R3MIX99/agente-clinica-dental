import { listarClinicasAdmin, listarPlanes } from "./actions"
import { SuperadminClient } from "./SuperadminClient"

// Depende de la sesion (cookies): nunca se prerenderiza en build.
export const dynamic = "force-dynamic"

export default async function SuperadminPage() {
  const [clinicas, planes] = await Promise.all([listarClinicasAdmin(), listarPlanes()])
  return <SuperadminClient clinicasIniciales={clinicas} planes={planes} />
}
