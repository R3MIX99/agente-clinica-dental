"use client"

import { AlertTriangle } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { AvisoPago } from "./layout"

export function AvisoPagoBanner({ aviso }: { aviso: AvisoPago }) {
  if (!aviso) return null

  const fechaTxt = new Date(aviso.fecha + "T12:00:00").toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric",
  })

  const vencido = aviso.tipo === "vencido"
  const mensaje = vencido
    ? `Tu pago venció el ${fechaTxt}. Regulariza tu suscripción para no perder el servicio.`
    : `Tu pago vence el ${fechaTxt}. Realiza tu pago para mantener el servicio activo.`

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b px-4 py-2 text-sm",
        vencido
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300",
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{mensaje}</span>
      <Link href="/uso" className="shrink-0 font-medium underline underline-offset-2">
        Ver facturación
      </Link>
    </div>
  )
}
