"use client"

import { usePathname } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import type { EstadoSuscripcion } from "@/app/actions/facturacion"

// Rutas permitidas incluso cuando la cuenta esta suspendida o cancelada.
// Las suspensiones las maneja el administrador del sistema; el cliente no
// puede regularizarlas desde la UI, por eso no enlazamos a ninguna ruta.
const RUTAS_PERMITIDAS = ["/ajustes"]

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
            {estado === "cancelada" ? "Cuenta cancelada" : "Acceso suspendido"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {estado === "cancelada"
              ? "Tu cuenta fue cancelada. Contacta al administrador para reactivar el servicio. Tus datos estan seguros."
              : "Tu cuenta esta suspendida. Contacta al administrador para regularizar el acceso."}
          </p>
        </div>
      </div>
    </div>
  )
}
