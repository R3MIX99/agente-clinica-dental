"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageSquare, CalendarDays, Users, UserCog, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/conversaciones", label: "Conversaciones", icon: MessageSquare },
  { href: "/citas", label: "Citas", icon: CalendarDays },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/agentes", label: "Agentes", icon: UserCog },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
]

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Navegacion principal">
      <ul className="space-y-1 px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
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
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
