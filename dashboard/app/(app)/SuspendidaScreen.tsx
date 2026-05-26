"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { EstadoSuscripcion } from "@/app/actions/facturacion"

// Rutas permitidas incluso cuando la suscripcion esta suspendida o cancelada.
const RUTAS_PERMITIDAS = ["/facturacion", "/ajustes"]

export function SuspendidaScreen({
  estado,
  children,
}: {
  estado: EstadoSuscripcion
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const bloqueada = estado === "suspendida" || estado === "cancelada"
  const enRutaPermitida = RUTAS_PERMITIDAS.some((r) => pathname.startsWith(r))

  if (!bloqueada || enRutaPermitida) {
    return <>{children}</>
  }

  return (
    <div className="relative h-full">
      {/* Contenido bloqueado (borroso) */}
      <div className="pointer-events-none select-none blur-sm opacity-30 h-full overflow-hidden">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="max-w-md text-center px-6 py-8 rounded-xl border border-border bg-card shadow-lg">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground">
            {estado === "cancelada" ? "Suscripcion cancelada" : "Acceso suspendido"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {estado === "cancelada"
              ? "Tu suscripcion fue cancelada. Contrata un plan para volver a usar el sistema. Tus datos estan seguros."
              : "Hay un pago pendiente en tu suscripcion. Regulariza el cobro para recuperar el acceso completo."}
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href="/facturacion">
                {estado === "cancelada" ? "Contratar plan" : "Regularizar pago"}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
