import { listarClinicasConSaldo, historialRecargas } from "./actions"
import { RecargasClient } from "./RecargasClient"

export const metadata = { title: "Recargas de saldo IA" }

export default async function RecargasPage() {
  const [clinicas, historial] = await Promise.all([
    listarClinicasConSaldo(),
    historialRecargas(),
  ])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Recargas de saldo IA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registra una recarga manual de saldo IA para cualquier clinica. El
            monto se suma al saldo disponible de la suscripcion activa.
          </p>
        </div>

        <RecargasClient clinicas={clinicas} historial={historial} />
      </div>
    </div>
  )
}
