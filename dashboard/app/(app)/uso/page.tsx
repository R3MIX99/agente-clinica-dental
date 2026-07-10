import { obtenerUsoClinica } from "@/app/actions/uso"
import { UsoClient } from "./UsoClient"

export const metadata = { title: "Uso y facturación" }

export default async function UsoPage() {
  const uso = await obtenerUsoClinica()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Uso y facturación</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu suscripción, saldo de IA, recordatorios y equipo configurado.
        </p>
      </div>

      <UsoClient uso={uso} />
    </div>
  )
}
