import { listarClinicasAdmin, listarPlanes } from "./actions"
import { SuperadminClient } from "./SuperadminClient"

export default async function SuperadminPage() {
  const [clinicas, planes] = await Promise.all([listarClinicasAdmin(), listarPlanes()])
  return <SuperadminClient clinicasIniciales={clinicas} planes={planes} />
}
