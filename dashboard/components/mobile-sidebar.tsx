"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SidebarNav } from "./sidebar-nav"
import type { Rol } from "@/app/(app)/layout"

export function MobileSidebar({ rol = "supervisor" }: { rol?: Rol }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 bg-sidebar p-0">
        <SheetHeader className="flex h-14 flex-row items-center gap-2 border-b border-sidebar-border px-4">
          <img src="/branding/dentai-icon.png" alt="" width={24} height={24} className="h-5 w-5" />
          <SheetTitle className="text-sm font-semibold text-sidebar-foreground">DentAI</SheetTitle>
        </SheetHeader>
        <div className="py-4">
          <SidebarNav rol={rol} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
