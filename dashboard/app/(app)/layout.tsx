"use client"

import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileSidebar } from "@/components/mobile-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full">
      {/* Sidebar desktop */}
      <div className="hidden md:flex">
        <AppSidebar />
      </div>

      {/* Area principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
          <MobileSidebar />
          <Separator orientation="vertical" className="h-5 md:hidden" />
          <span className="flex-1 text-sm font-medium text-muted-foreground">
            Panel de Control
          </span>
          <ThemeToggle />
        </header>

        {/* Contenido con animacion de entrada */}
        <main className="flex-1 overflow-auto">
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
  )
}
