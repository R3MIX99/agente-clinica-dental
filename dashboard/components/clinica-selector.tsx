"use client"

import { useTransition } from "react"
import { ChevronsUpDown, Check, Building2 } from "lucide-react"
import { cambiarClinicaActiva } from "@/app/actions/clinica"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type ClinicaBasica = { id: string; nombre: string }

// Variante "sidebar": estilos adaptados al fondo de la barra lateral
// Variante "mobile": estilos adaptados al header movil
export function ClinicaSelector({
  clinicaActual,
  clinicas,
  variant = "sidebar",
}: {
  clinicaActual: ClinicaBasica
  clinicas: ClinicaBasica[]
  variant?: "sidebar" | "mobile"
}) {
  const [isPending, startTransition] = useTransition()

  function handleSelect(clinicaId: string) {
    if (clinicaId === clinicaActual.id || isPending) return
    startTransition(async () => {
      await cambiarClinicaActiva(clinicaId)
    })
  }

  const nombre = clinicaActual.nombre || "Clínica Dental"

  // Sin opciones multiples: solo mostrar el nombre
  if (clinicas.length <= 1) {
    return variant === "sidebar" ? (
      <span className="text-sm font-semibold text-sidebar-foreground truncate">
        {nombre}
      </span>
    ) : (
      <span className="text-sm font-semibold truncate">{nombre}</span>
    )
  }

  const triggerClass =
    variant === "sidebar"
      ? "flex items-center gap-1.5 text-sm font-semibold text-sidebar-foreground hover:opacity-75 disabled:opacity-50 max-w-[152px] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded"
      : "flex items-center gap-1.5 text-sm font-semibold hover:opacity-75 disabled:opacity-50 max-w-[180px] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button disabled={isPending} className={triggerClass}>
          <span className="truncate">{nombre}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
          Cambiar clinica
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {clinicas.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => handleSelect(c.id)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Check
              className="h-4 w-4 shrink-0"
              style={{ opacity: c.id === clinicaActual.id ? 1 : 0 }}
              aria-hidden="true"
            />
            <span className="truncate">{c.nombre || "Clínica Dental"}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
