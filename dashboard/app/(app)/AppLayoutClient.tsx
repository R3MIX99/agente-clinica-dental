"use client"

import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileHeader } from "@/components/mobile-header"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { ThemeToggle } from "@/components/theme-toggle"
import { AtencionProvider } from "@/lib/atencion-context"
import { GlobalAtencionListener } from "@/components/global-atencion-listener"
import type { Rol } from "./layout"

export function AppLayoutClient({
  children,
  rol,
  doctorId,
}: {
  children: React.ReactNode
  rol: Rol
  doctorId?: string | null
}) {
  const pathname = usePathname()

  return (
    <AtencionProvider>
      <GlobalAtencionListener />
      <div className="flex h-full" {...({ "vaul-drawer-wrapper": "" } as any)}>

        {/* Sidebar — solo escritorio */}
        <div className="hidden md:flex">
          <AppSidebar rol={rol} doctorId={doctorId} />
        </div>

        {/* Area principal */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Header movil */}
          <MobileHeader />

          {/* Topbar escritorio */}
          <header className="hidden md:flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
            <span className="flex-1 text-sm font-medium text-muted-foreground">
              Panel de Control
            </span>
            <ThemeToggle />
          </header>

          {/* Contenido con animacion de ruta */}
          {/* pb-16 en movil para no quedar tapado por la barra inferior */}
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Barra de navegacion inferior — solo movil */}
      <MobileBottomNav rol={rol} doctorId={doctorId} />
    </AtencionProvider>
  )
}
