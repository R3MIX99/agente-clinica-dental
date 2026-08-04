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
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
