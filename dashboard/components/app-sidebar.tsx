"use client"

import { useTransition } from "react"
import { Stethoscope, LogOut, Loader2 } from "lucide-react"
import { SidebarNav } from "./sidebar-nav"
import { logoutAction } from "@/app/actions/auth"
import type { Rol } from "@/app/(app)/layout"

export function AppSidebar({ rol, doctorId }: { rol: Rol; doctorId?: string | null }) {
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      await logoutAction()
    })
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Stethoscope className="h-5 w-5 text-sidebar-primary" aria-hidden="true" />
        <span className="text-sm font-semibold text-sidebar-foreground">Clinica Dental</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav rol={rol} doctorId={doctorId} />
      </div>
      {/* Cerrar sesion */}
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
  )
}
