import { redirect } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { obtenerSuperadmin } from "@/lib/auth/superadmin"
import { logoutAction } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Superadmin — DentalIA" }

// El area de superadmin depende de la sesion: se renderiza en cada peticion.
export const dynamic = "force-dynamic"

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  // Candado de servidor: correo permitido, verificado y via Google.
  const user = await obtenerSuperadmin()
  if (!user) redirect("/login")

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Panel de superadmin</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">Cerrar sesión</Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
