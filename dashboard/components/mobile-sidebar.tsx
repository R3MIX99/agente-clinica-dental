"use client"

import { useState } from "react"
import { Menu, Stethoscope } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SidebarNav } from "./sidebar-nav"
import type { Rol } from "@/app/(app)/layout"

export function MobileSidebar({ rol = "supervisor" }: { rol?: Rol }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 bg-sidebar p-0">
        <SheetHeader className="flex h-14 flex-row items-center gap-2 border-b border-sidebar-border px-4">
          <Stethoscope className="h-5 w-5 text-sidebar-primary" aria-hidden="true" />
          <SheetTitle className="text-sm font-semibold text-sidebar-foreground">Clínica Dental</SheetTitle>
        </SheetHeader>
        <div className="py-4">
          <SidebarNav rol={rol} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
