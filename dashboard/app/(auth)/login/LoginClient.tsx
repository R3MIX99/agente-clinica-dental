"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Stethoscope, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginAction } from "@/app/actions/auth"
import { createClient } from "@/lib/supabase/client"

const esquema = z.object({
  email: z.string().email("Ingresa un correo electrónico válido"),
  password: z.string().min(1, "La contraseña es requerida"),
})

type Campos = z.infer<typeof esquema>

export function LoginClient() {
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Campos>({
    resolver: zodResolver(esquema),
  })

  function onSubmit(datos: Campos) {
    startTransition(async () => {
      const resultado = await loginAction(datos.email, datos.password)
      if (resultado?.error) {
        toast.error(resultado.error)
      }
    })
  }

  function accederComoSuperadmin() {
    const supabase = createClient()
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/superadmin`,
      },
    })
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Stethoscope className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Clínica Dental</h1>
        <p className="text-sm text-muted-foreground">Panel de control</p>
      </div>

      {/* Formulario */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-medium text-foreground mb-5">Iniciar sesión</h2>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nombre@clinica.com"
              {...register("email")}
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register("password")}
              aria-invalid={!!errors.password}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full mt-2" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
                Iniciando sesión...
              </>
            ) : (
              "Iniciar sesión"
            )}
          </Button>
        </form>

        <div className="mt-5 border-t border-border pt-4">
          <button
            type="button"
            onClick={accederComoSuperadmin}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Acceso de superadministrador
          </button>
        </div>
      </div>
    </div>
  )
}
