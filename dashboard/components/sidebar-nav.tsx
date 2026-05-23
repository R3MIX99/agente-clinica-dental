"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageSquare, CalendarDays, Users, UserCog, Settings, Stethoscope } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAtencion } from "@/lib/atencion-context"

const navItems = [
  { href: "/conversaciones", label: "Conversaciones", icon: MessageSquare },
  { href: "/citas", label: "Citas", icon: CalendarDays },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/doctores", label: "Doctores", icon: Stethoscope },
  { href: "/usuarios", label: "Usuarios", icon: UserCog },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
]

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { hayAtencion } = useAtencion()

  return (
    <nav aria-label="Navegacion principal">
      <ul className="space-y-1 px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          const mostrarAtencion = hayAtencion && href === "/conversaciones" && !active
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <div className="relative shrink-0">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {mostrarAtencion && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                  )}
                </div>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
