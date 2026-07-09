"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTransition } from "react"
import {
  MessageSquare, CalendarDays, Users, Stethoscope,
  UserCog, LineChart, BarChart3, Settings,
  MoreHorizontal, LogOut, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAtencion } from "@/lib/atencion-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { logoutAction } from "@/app/actions/auth"
import type { Rol } from "@/app/(app)/layout"

// Items siempre visibles en la barra inferior (admin / supervisor)
const TABS_PRIMARIOS = [
  { href: "/conversaciones", icon: MessageSquare, label: "Mensajes" },
  { href: "/citas",          icon: CalendarDays,  label: "Citas" },
  { href: "/pacientes",      icon: Users,          label: "Pacientes" },
]

// Items que abren con el dropdown "Mas" (hacia arriba)
const TABS_SECUNDARIOS = [
  { href: "/doctores",    icon: Stethoscope,  label: "Doctores" },
  { href: "/usuarios",    icon: UserCog,      label: "Usuarios" },
  { href: "/analitica",   icon: LineChart,    label: "Analítica" },
  { href: "/uso",         icon: BarChart3,    label: "Uso" },
  { href: "/ajustes",     icon: Settings,     label: "Ajustes" },
]

const TABS_DOCTOR = (doctorId?: string | null) => [
  { href: "/citas",                                         icon: CalendarDays, label: "Mis citas" },
  { href: "/pacientes",                                     icon: Users,        label: "Mis pacientes" },
  { href: doctorId ? `/doctores/${doctorId}` : "/doctores", icon: Stethoscope,  label: "Mi ficha" },
]

export function MobileBottomNav({ rol, doctorId }: { rol: Rol; doctorId?: string | null }) {
  const pathname = usePathname()
  const { hayAtencion } = useAtencion()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => { await logoutAction() })
  }

  // Rol doctor: barra simple sin "Mas"
  if (rol === "doctor") {
    const tabs = TABS_DOCTOR(doctorId)
    return (
      <nav
        aria-label="Navegacion principal movil"
        className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-border bg-background md:hidden"
        style={{ paddingBottom: "env(safe-área-inset-bottom)" }}
      >
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-16 flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn(
                "absolute top-0 h-0.5 w-8 rounded-full transition-all",
                active ? "bg-primary" : "bg-transparent"
              )} />
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.6} aria-hidden="true" />
            </Link>
          )
        })}
      </nav>
    )
  }

  // ---- Admin / Supervisor ----
  const masActivo = TABS_SECUNDARIOS.some((t) => pathname.startsWith(t.href))

  return (
    <nav
      aria-label="Navegacion principal movil"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-border bg-background md:hidden"
      style={{ paddingBottom: "env(safe-área-inset-bottom)" }}
    >
      {/* Items primarios */}
      {TABS_PRIMARIOS.map(({ href, icon: Icon, label }) => {
        const active = pathname.startsWith(href)
        const mostrarAtencion = hayAtencion && href === "/conversaciones" && !active
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-16 flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className={cn(
              "absolute top-0 h-0.5 w-8 rounded-full transition-all",
              active ? "bg-primary" : "bg-transparent"
            )} />
            <div className="relative">
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.6} aria-hidden="true" />
              {mostrarAtencion && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
              )}
            </div>
          </Link>
        )
      })}

      {/* Boton "Mas" con dropdown hacia arriba */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Más opciones"
            className={cn(
              "relative flex h-16 flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
              masActivo ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className={cn(
              "absolute top-0 h-0.5 w-8 rounded-full transition-all",
              masActivo ? "bg-primary" : "bg-transparent"
            )} />
            <MoreHorizontal className="h-5 w-5" strokeWidth={masActivo ? 2.5 : 1.6} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="top"
          align="end"
          sideOffset={8}
          className="w-56 mb-1"
        >
          {TABS_SECUNDARIOS.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <DropdownMenuItem key={href} asChild>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 cursor-pointer",
                    active && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </Link>
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            disabled={isPending}
            className="flex items-center gap-3 text-destructive focus:text-destructive cursor-pointer"
          >
            {isPending
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <LogOut className="h-4 w-4" aria-hidden="true" />}
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}
