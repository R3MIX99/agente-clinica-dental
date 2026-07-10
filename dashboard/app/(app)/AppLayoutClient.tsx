"use client"

import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileHeader } from "@/components/mobile-header"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { ThemeToggle } from "@/components/theme-toggle"
import { AtencionProvider } from "@/lib/atencion-context"
import { GlobalAtencionListener } from "@/components/global-atencion-listener"
import { SuspendidaScreen } from "./SuspendidaScreen"
import { AvisoPagoBanner } from "./AvisoPagoBanner"
import type { Rol, AvisoPago } from "./layout"
import type { ClinicaBasica } from "@/components/clinica-selector"
import type { EstadoSuscripcion } from "@/app/actions/facturacion"

export function AppLayoutClient({
  children,
  rol,
  doctorId,
  clinicaActual,
  clinicas,
  estadoSuscripcion = "prueba",
  avisoPago = null,
}: {
  children: React.ReactNode
  rol: Rol
  doctorId?: string | null
  clinicaActual: ClinicaBasica
  clinicas: ClinicaBasica[]
  estadoSuscripcion?: EstadoSuscripcion
  avisoPago?: AvisoPago
}) {
  const pathname = usePathname()

  // Rutas "fullscreen" con scroll interno propio (chat-like).
  // Necesitan h-full para que su layout interno funcione.
  // El resto usa min-h-full + spacer al final para no quedar tapado por la barra inferior.
  const esRutaFullscreen = pathname.startsWith("/conversaciones")

  return (
    <AtencionProvider>
      <GlobalAtencionListener />
      <div className="flex h-full" {...({ "vaul-drawer-wrapper": "" } as any)}>

        {/* Sidebar — solo escritorio */}
        <div className="hidden md:flex">
          <AppSidebar
            rol={rol}
            doctorId={doctorId}
            clinicaActual={clinicaActual}
            clinicas={clinicas}
          />
        </div>

        {/* Area principal */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Header movil */}
          <MobileHeader clinicaActual={clinicaActual} clinicas={clinicas} />

          {/* Topbar escritorio */}
          <header className="hidden md:flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
            <span className="flex-1 text-sm font-medium text-muted-foreground">
              Panel de Control
            </span>
            <ThemeToggle />
          </header>

          {/* Aviso de pago (solo admin/supervisor) */}
          {rol !== "doctor" && <AvisoPagoBanner aviso={avisoPago} />}

          {/* Contenido con animacion de ruta */}
          <main className={esRutaFullscreen ? "flex-1 overflow-hidden" : "flex-1 overflow-auto"}>
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className={esRutaFullscreen ? "h-full" : "min-h-full"}
              >
                <SuspendidaScreen estado={estadoSuscripcion}>
                  {children}
                </SuspendidaScreen>
              </motion.div>
            </AnimatePresence>
            {/* Spacer movil para rutas con scroll — reserva alto de la barra inferior */}
            {!esRutaFullscreen && (
              <div
                aria-hidden="true"
                className="md:hidden shrink-0"
                style={{ height: "120px" }}
              />
            )}
          </main>
        </div>
      </div>

      {/* Barra de navegacion inferior — solo movil */}
      <MobileBottomNav rol={rol} doctorId={doctorId} />
    </AtencionProvider>
  )
}
