"use client"

import Link from "next/link"
import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

// Red de seguridad: si algo falla al renderizar dentro del panel (por
// ejemplo, una navegacion sin conexion que el service worker no llego a
// interceptar), se muestra esto en vez de la pantalla de error generica de
// Next.js.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h1 className="text-base font-semibold text-foreground">Algo salió mal</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          No se pudo cargar esta sección. Si no tienes conexión, prueba entrar a Citas.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => reset()}>
          Reintentar
        </Button>
        <Button asChild>
          <Link href="/citas">Ir a Citas</Link>
        </Button>
      </div>
    </div>
  )
}
