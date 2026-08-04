"use client"

import Link from "next/link"
import { WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"

// Pagina estatica sin dependencias de datos — es la que el service worker
// sirve cuando una navegacion falla por falta de conexion (ver public/sw.js).
// No debe hacer llamadas a Supabase ni vivir bajo el layout de (app), para
// poder precachearse una sola vez y quedar disponible siempre offline.
export default function OfflinePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 px-4 text-center">
      {/* img normal (no next/image): esta pagina depende de que el logo se
          vea sin conexion, y next/image pide una URL distinta (/_next/image)
          que el service worker no cachea — ver public/sw.js */}
      <img
        src="/branding/dentai-logo.png"
        alt="DentAI"
        width={1366}
        height={356}
        className="h-9 w-auto dark:hidden"
      />
      <img
        src="/branding/dentai-logo-white.png"
        alt="DentAI"
        width={1366}
        height={356}
        className="hidden h-9 w-auto dark:block"
      />

      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <WifiOff className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Sin conexión a internet</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Esta sección necesita internet para cargar. Revisa tu conexión e intenta de nuevo.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
        <Button variant="outline" asChild>
          <Link href="/citas">Ir a Citas</Link>
        </Button>
      </div>
    </div>
  )
}
