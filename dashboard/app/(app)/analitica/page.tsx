import { obtenerAnalitica } from "@/app/actions/analitica"
import { AnaliticaClient } from "./AnaliticaClient"

export const metadata = { title: "Analitica" }

export default async function AnaliticaPage() {
  const fin    = new Date()
  const inicio = new Date()
  inicio.setDate(inicio.getDate() - 30)
  inicio.setHours(0, 0, 0, 0)
  fin.setHours(23, 59, 59, 999)

  const datos = await obtenerAnalitica(inicio.toISOString(), fin.toISOString())

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Analitica</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Actividad del agente de IA: conversaciones, mensajes y rendimiento del periodo.
        </p>
      </div>

      <AnaliticaClient datos={datos} />
    </div>
  )
}
