"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageSquare, CalendarDays, Users, Stethoscope, UserCog } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAtencion } from "@/lib/atencion-context"
import type { Rol } from "@/app/(app)/layout"

const TABS_ADMIN_SUPERVISOR = [
  { href: "/conversaciones", icon: MessageSquare, label: "Conversaciones" },
  { href: "/citas",          icon: CalendarDays,  label: "Citas" },
  { href: "/pacientes",      icon: Users,          label: "Pacientes" },
  { href: "/doctores",       icon: Stethoscope,    label: "Doctores" },
  { href: "/usuarios",       icon: UserCog,        label: "Usuarios" },
]

const TABS_DOCTOR = [
  { href: "/citas",     icon: CalendarDays, label: "Mis citas" },
  { href: "/pacientes", icon: Users,         label: "Mis pacientes" },
  { href: "/doctores",  icon: Stethoscope,   label: "Mi ficha" },
]

export function MobileBottomNav({ rol }: { rol: Rol }) {
  const pathname = usePathname()
  const { hayAtencion } = useAtencion()

  const TAB_ITEMS = rol === "doctor" ? TABS_DOCTOR : TABS_ADMIN_SUPERVISOR

  return (
    <nav
      aria-label="Navegacion principal movil"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-border bg-background md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TAB_ITEMS.map(({ href, icon: Icon, label }) => {
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
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {/* Indicador activo superior */}
            <span
              className={cn(
                "absolute top-0 h-0.5 w-8 rounded-full transition-all duration-200",
                active ? "bg-primary" : "bg-transparent"
              )}
            />

            {/* Icono */}
            <div className="relative">
              <Icon
                className="h-5 w-5"
                strokeWidth={active ? 2.5 : 1.6}
                aria-hidden="true"
              />
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
    </nav>
  )
}
