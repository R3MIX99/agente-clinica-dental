import { listarCuentas } from "../actions"
import { CuentasClient } from "./CuentasClient"

export const metadata = { title: "Superadmin — Cuentas" }

export default async function CuentasPage() {
  const cuentas = await listarCuentas()

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Cuentas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lista de todas las cuentas registradas en el sistema.
        </p>
      </div>
      <CuentasClient cuentas={cuentas} />
    </div>
  )
}
