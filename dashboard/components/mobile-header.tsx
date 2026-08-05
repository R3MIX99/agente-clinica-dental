"use client"

import Link from "next/link"
import { useTransition } from "react"
import { UserCircle, Settings, LogOut, Moon, Sun, Loader2, User } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { logoutAction } from "@/app/actions/auth"
import { NotificationsBell } from "./notifications-bell"
import { ClinicaSelector } from "./clinica-selector"
import type { ClinicaBasica } from "./clinica-selector"

export function MobileHeader({
  clinicaActual,
  clinicas,
}: {
  clinicaActual: ClinicaBasica
  clinicas: ClinicaBasica[]
}) {
  const { theme, setTheme } = useTheme()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      await logoutAction()
    })
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:hidden">
      {/* Logo y nombre / selector de clinica */}
      <div className="flex items-center gap-2 min-w-0">
        {/* img normal (no next/image) para que se vea offline — ver public/sw.js */}
        <img
          src="/branding/dentai-icon.png"
          alt=""
          width={24}
          height={24}
          className="h-5 w-5 shrink-0"
        />
        <ClinicaSelector
          clinicaActual={clinicaActual}
          clinicas={clinicas}
          variant="mobile"
        />
      </div>

      <div className="flex items-center gap-1">
      <NotificationsBell clinicaId={clinicaActual.id} />
      {/* Menú de usuario */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Menú de usuario">
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UserCircle className="h-5 w-5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href="/perfil" className="flex items-center gap-2 cursor-pointer">
              <User className="h-4 w-4" />
              Mi perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/ajustes" className="flex items-center gap-2 cursor-pointer">
              <Settings className="h-4 w-4" />
              Ajustes
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center gap-2 cursor-pointer"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            Modo {theme === "dark" ? "claro" : "oscuro"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            disabled={isPending}
            className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  )
}
