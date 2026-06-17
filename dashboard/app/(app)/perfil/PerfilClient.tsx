"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { AlertTriangle, Loader2, Lock, Mail, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  actualizarMiPerfil,
  cambiarMiCorreo,
  cambiarMiPassword,
  type PerfilCompleto,
} from "./actions"

const ROL_LABELS: Record<string, string> = {
  administrador: "Administrador",
  supervisor:    "Supervisor",
  doctor:        "Doctor",
}

export function PerfilClient({ perfil }: { perfil: PerfilCompleto }) {
  const router = useRouter()

  return (
    <div className="p-6 pb-20 md:pb-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Cabecera */}
        <div>
          <h1 className="text-xl font-semibold">Mi perfil</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra tus datos personales, correo y contraseña.
          </p>
        </div>

        {/* Aviso de contraseña temporal */}
        {perfil.password_temporal && (
          <div className="flex gap-3 rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Cambia tu contraseña temporal
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                Estás usando la contraseña que te asignó el administrador. Por
                seguridad, cámbiala desde la sección de abajo antes de continuar.
              </p>
            </div>
          </div>
        )}

        {/* Datos generales */}
        <DatosGeneralesCard perfil={perfil} onActualizar={() => router.refresh()} />

        {/* Cambiar correo */}
        <CorreoCard perfil={perfil} onActualizar={() => router.refresh()} />

        {/* Cambiar contraseña */}
        <PasswordCard perfilUserId={perfil.id} onCambiada={() => router.refresh()} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Datos generales (nombre, rol, clinica)
// ---------------------------------------------------------------------------

function DatosGeneralesCard({
  perfil,
  onActualizar,
}: {
  perfil: PerfilCompleto
  onActualizar: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const { register, handleSubmit, formState: { errors } } = useForm<{ nombre: string }>({
    defaultValues: { nombre: perfil.nombre },
  })

  const onSubmit = handleSubmit((datos) => {
    startTransition(async () => {
      const res = await actualizarMiPerfil({ nombre: datos.nombre })
      if (res.ok) {
        toast.success("Perfil actualizado")
        onActualizar()
      } else {
        toast.error(res.error ?? "Error al actualizar el perfil")
      }
    })
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <User className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base">Datos generales</CardTitle>
            <CardDescription>Tu nombre y rol en la clinica.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input
              id="nombre"
              {...register("nombre", { required: "El nombre es requerido" })}
              disabled={isPending}
            />
            {errors.nombre && (
              <p className="text-xs text-destructive">{errors.nombre.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Rol</p>
              <Badge variant="secondary">
                {ROL_LABELS[perfil.rol] ?? perfil.rol}
              </Badge>
            </div>
            {perfil.clinica_nombre && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Clínica</p>
                <p className="text-sm font-medium">{perfil.clinica_nombre}</p>
              </div>
            )}
            {perfil.doctor_nombre && (
              <div className="space-y-1 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Doctor asignado</p>
                <p className="text-sm font-medium">{perfil.doctor_nombre}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Cambiar correo
// ---------------------------------------------------------------------------

function CorreoCard({
  perfil,
  onActualizar,
}: {
  perfil: PerfilCompleto
  onActualizar: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [editando, setEditando] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ email: string }>({
    defaultValues: { email: "" },
  })

  function cancelar() {
    setEditando(false)
    reset({ email: "" })
  }

  const onSubmit = handleSubmit((datos) => {
    startTransition(async () => {
      const res = await cambiarMiCorreo(datos.email)
      if (res.ok) {
        toast.success(res.mensaje ?? "Correo actualizado")
        setEditando(false)
        reset({ email: "" })
        onActualizar()
      } else {
        toast.error(res.error ?? "Error al cambiar el correo")
      }
    })
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base">Correo electrónico</CardTitle>
            <CardDescription>
              Es el correo con el que inicias sesión.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!editando ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{perfil.email ?? "Sin correo"}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
              Cambiar
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email_nuevo">Nuevo correo</Label>
              <Input
                id="email_nuevo"
                type="email"
                placeholder="nuevo@correo.com"
                autoComplete="email"
                {...register("email", {
                  required: "Ingresa el nuevo correo",
                  pattern: {
                    value:   /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Correo no válido",
                  },
                })}
                disabled={isPending}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Te llegará un enlace de confirmación al correo nuevo. El cambio
                se completa cuando lo abras desde ahí.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={cancelar} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
                ) : (
                  "Enviar enlace de confirmación"
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Cambiar contraseña
// ---------------------------------------------------------------------------

type FormPassword = {
  password_actual: string
  password_nuevo:  string
  password_confirmar: string
}

function PasswordCard({
  perfilUserId,
  onCambiada,
}: {
  perfilUserId: string
  onCambiada: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormPassword>({
    defaultValues: { password_actual: "", password_nuevo: "", password_confirmar: "" },
  })

  // Forzar uso del id en algún side-effect para que no sea unused — ayuda
  // también a resetear si cambia el usuario.
  useEffect(() => { reset() }, [perfilUserId, reset])

  const passwordNuevo = watch("password_nuevo")

  const onSubmit = handleSubmit((datos) => {
    if (datos.password_nuevo !== datos.password_confirmar) {
      toast.error("Las contraseñas no coinciden")
      return
    }
    startTransition(async () => {
      const res = await cambiarMiPassword({
        password_actual: datos.password_actual,
        password_nuevo:  datos.password_nuevo,
      })
      if (res.ok) {
        toast.success("Contraseña actualizada")
        reset()
        onCambiada()
      } else {
        toast.error(res.error ?? "Error al cambiar la contraseña")
      }
    })
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base">Contraseña</CardTitle>
            <CardDescription>
              Cambia tu contraseña de acceso al panel.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password_actual">Contraseña actual</Label>
            <Input
              id="password_actual"
              type="password"
              autoComplete="current-password"
              {...register("password_actual", { required: "Ingresa tu contraseña actual" })}
              disabled={isPending}
            />
            {errors.password_actual && (
              <p className="text-xs text-destructive">{errors.password_actual.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password_nuevo">Contraseña nueva</Label>
            <Input
              id="password_nuevo"
              type="password"
              autoComplete="new-password"
              {...register("password_nuevo", {
                required: "Ingresa la contraseña nueva",
                minLength: { value: 6, message: "Al menos 6 caracteres" },
              })}
              disabled={isPending}
            />
            {errors.password_nuevo && (
              <p className="text-xs text-destructive">{errors.password_nuevo.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password_confirmar">Confirmar contraseña nueva</Label>
            <Input
              id="password_confirmar"
              type="password"
              autoComplete="new-password"
              {...register("password_confirmar", {
                required: "Repite la contraseña nueva",
                validate: (v) => v === passwordNuevo || "Las contraseñas no coinciden",
              })}
              disabled={isPending}
            />
            {errors.password_confirmar && (
              <p className="text-xs text-destructive">{errors.password_confirmar.message}</p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cambiando...</>
              ) : (
                "Cambiar contraseña"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
