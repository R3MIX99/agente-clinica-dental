"use client"

import { useTransition } from "react"
import Link from "next/link"
import Image from "next/image"
import { LogOut, Loader2, User } from "lucide-react"
import { SidebarNav } from "./sidebar-nav"
import { ClinicaSelector } from "./clinica-selector"
import { logoutAction } from "@/app/actions/auth"
import type { Rol } from "@/app/(app)/layout"
import type { ClinicaBasica } from "./clinica-selector"

export function AppSidebar({
  rol,
  doctorId,
  clinicaActual,
  clinicas,
}: {
  rol: Rol
  doctorId?: string | null
  clinicaActual: ClinicaBasica
  clinicas: ClinicaBasica[]
}) {
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      await logoutAction()
    })
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Image
          src="/branding/dentai-icon.png"
          alt=""
          width={24}
          height={24}
          className="h-5 w-5 shrink-0"
          priority
        />
        <ClinicaSelector
          clinicaActual={clinicaActual}
          clinicas={clinicas}
          variant="sidebar"
        />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav rol={rol} doctorId={doctorId} />
      </div>
      {/* Mi perfil + Cerrar sesión */}
      <div className="shrink-0 border-t border-sidebar-border p-3 space-y-1">
        <Link
          href="/perfil"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <User className="h-4 w-4" aria-hidden="true" />
          Mi perfil
        </Link>
        <button
          onClick={handleLogout}
          disabled={isPending}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="h-4 w-4" aria-hidden="true" />
          )}
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
