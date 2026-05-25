"use client"

import Link from "next/link"
import { useTransition } from "react"
import { Stethoscope, UserCircle, Settings, LogOut, Moon, Sun, Loader2 } from "lucide-react"
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

export function MobileHeader() {
  const { theme, setTheme } = useTheme()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      await logoutAction()
    })
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:hidden">
      {/* Logo y nombre */}
      <div className="flex items-center gap-2">
        <Stethoscope className="h-5 w-5 text-primary" aria-hidden />
        <span className="text-sm font-semibold">Clínica Dental</span>
      </div>

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
    </header>
  )
}
