"use client"

import * as React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Envuelve un boton de solo icono con un tooltip estilizado (en vez del
// tooltip nativo del navegador via `title`) para que se entienda que hace
// cada icono sin necesidad de texto visible junto a el.
export function IconTooltip({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        {/* Oculto en telefono: en touch el tap puede abrir el tooltip antes
            del click, y no aporta nada sin cursor de mouse. */}
        <TooltipContent className="hidden md:inline-flex">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
