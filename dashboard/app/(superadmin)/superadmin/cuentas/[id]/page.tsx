import { notFound } from "next/navigation"
import Link from "next/link"
import { obtenerCuenta } from "../../actions"
import { CuentaDetalleClient } from "./CuentaDetalleClient"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

export const metadata = { title: "Superadmin — Detalle de cuenta" }

export default async function CuentaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cuenta = await obtenerCuenta(id)

  if (!cuenta) notFound()

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/superadmin/cuentas">
            <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            Cuentas
          </Link>
        </Button>
      </div>

      <CuentaDetalleClient cuenta={cuenta} />
    </div>
  )
}
