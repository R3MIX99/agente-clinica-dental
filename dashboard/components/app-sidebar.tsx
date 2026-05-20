"use client"

import { Stethoscope } from "lucide-react"
import { SidebarNav } from "./sidebar-nav"

export function AppSidebar() {
  return (
    <aside className="flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Stethoscope className="h-5 w-5 text-sidebar-primary" aria-hidden="true" />
        <span className="text-sm font-semibold text-sidebar-foreground">Clínica Dental</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav />
      </div>
    </aside>
  )
}
