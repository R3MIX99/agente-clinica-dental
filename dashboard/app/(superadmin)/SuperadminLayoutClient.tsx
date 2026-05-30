"use client"

import { useTransition } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Shield, BarChart3, Building2, CreditCard, LogOut, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { logoutAction } from "@/app/actions/auth"

const NAV_ITEMS = [
  { href: "/superadmin",         label: "Metricas",  icon: BarChart3  },
  { href: "/superadmin/cuentas", label: "Cuentas",   icon: Building2  },
  { href: "/superadmin/planes",  label: "Planes",    icon: CreditCard },
]

export function SuperadminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      await logoutAction()
    })
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="hidden md:flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <Shield className="h-5 w-5 shrink-0 text-sidebar-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-sidebar-foreground">Superadmin</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4" aria-label="Navegacion superadmin">
          <ul className="space-y-1 px-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/superadmin"
                  ? pathname === "/superadmin"
                  : pathname.startsWith(href)
              return (
                <li key={href}>
                  <Link
                    href={href}
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

        <div className="shrink-0 border-t border-sidebar-border p-3">
          <button
            onClick={handleLogout}
            disabled={isPending}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="h-4 w-4" aria-hidden="true" />
            )}
            Cerrar sesion
          </button>
        </div>
      </aside>

      {/* Area principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="hidden md:flex h-14 shrink-0 items-center border-b border-border bg-background px-6">
          <span className="text-sm font-medium text-muted-foreground">Panel de administracion del SaaS</span>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
