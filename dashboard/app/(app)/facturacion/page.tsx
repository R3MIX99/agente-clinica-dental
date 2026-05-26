import { obtenerFacturacion } from "@/app/actions/facturacion"
import { obtenerPlanes } from "@/app/actions/uso"
import { obtenerDatosAddons } from "@/app/actions/addons"
import { FacturacionClient } from "./FacturacionClient"

export const metadata = { title: "Facturacion" }

export default async function FacturacionPage() {
  const [datos, planes, datosAddons] = await Promise.all([
    obtenerFacturacion(),
    obtenerPlanes(),
    obtenerDatosAddons(),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Facturacion</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plan actual, estado del cobro y administracion de tu suscripcion.
        </p>
      </div>

      <FacturacionClient
        datos={datos}
        planes={planes}
        catalogo={datosAddons.catalogo}
        contratados={datosAddons.contratados}
        totalAddons={datosAddons.total_mensual_addons}
        limiteEfectivoDoctores={datosAddons.limite_efectivo_doctores}
        limiteEfectivoUsuarios={datosAddons.limite_efectivo_usuarios}
        limiteEfectivoRecordatorios={datosAddons.limite_efectivo_recordatorios}
      />
    </div>
  )
}
