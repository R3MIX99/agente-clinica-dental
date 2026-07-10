import { obtenerResumenSuperadmin } from "./actions"
import { ResumenClient } from "./ResumenClient"

// Depende de la sesion (cookies): nunca se prerenderiza en build.
export const dynamic = "force-dynamic"

export default async function SuperadminResumenPage() {
  const resumen = await obtenerResumenSuperadmin()
  return <ResumenClient resumen={resumen} />
}
