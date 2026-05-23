"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { crearUsuario, editarUsuario, eliminarUsuario, type PerfilUsuario } from "./actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { ChevronRight, SquarePen, Trash2 } from "lucide-react"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Doctor = { id: string; nombre: string }
type PerfilActual = { id: string; rol: "administrador" | "supervisor" | "doctor" }

interface Props {
  usuarios: PerfilUsuario[]
  doctores: Doctor[]
  perfilActual: PerfilActual
}

// ---------------------------------------------------------------------------
// Esquema de validacion
// ---------------------------------------------------------------------------

const usuarioSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Correo electronico invalido"),
  rol: z.enum(["administrador", "supervisor", "doctor"]),
  activo: z.boolean(),
  doctor_id: z.string().optional(),
})

type UsuarioForm = z.infer<typeof usuarioSchema>

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ROL_LABELS: Record<string, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  doctor: "Doctor",
}

const ROL_ESTILO: Record<string, string> = {
  administrador: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  supervisor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  doctor: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
}

const FORM_DEFAULT: UsuarioForm = {
  nombre: "",
  email: "",
  rol: "supervisor",
  activo: true,
  doctor_id: "",
}

// ---------------------------------------------------------------------------
// Helpers de permisos
// ---------------------------------------------------------------------------

function puedeEditar(perfilActual: PerfilActual, usuario: PerfilUsuario): boolean {
  // Supervisor no puede editar cuentas con rol administrador
  if (perfilActual.rol === "supervisor" && usuario.rol === "administrador") return false
  return true
}

function puedeEliminar(perfilActual: PerfilActual, usuario: PerfilUsuario): boolean {
  // Nadie puede eliminarse a si mismo
  if (perfilActual.id === usuario.id) return false
  // Supervisor no puede eliminar administradores
  if (perfilActual.rol === "supervisor" && usuario.rol === "administrador") return false
  return true
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function UsuariosClient({ usuarios: usuariosIniciales, doctores, perfilActual }: Props) {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>(usuariosIniciales)
  const [formOpen, setFormOpen] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<PerfilUsuario | null>(null)
  const [drawerUsuario, setDrawerUsuario] = useState<PerfilUsuario | null>(null)
  const [usuarioParaEliminar, setUsuarioParaEliminar] = useState<PerfilUsuario | null>(null)
  const [isPendingEliminar, startTransitionEliminar] = useTransition()
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    setUsuarios(usuariosIniciales)
  }, [usuariosIniciales])

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UsuarioForm>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: FORM_DEFAULT,
  })

  const rolActual = watch("rol")

  // -------------------------------------------------------------------------
  // Handlers — formulario
  // -------------------------------------------------------------------------

  function abrirFormNuevo() {
    setUsuarioEditando(null)
    reset(FORM_DEFAULT)
    setFormOpen(true)
  }

  function abrirFormEdicion(usuario: PerfilUsuario) {
    setUsuarioEditando(usuario)
    reset({
      nombre: usuario.nombre,
      email: usuario.email ?? "",
      rol: usuario.rol,
      activo: usuario.activo,
      doctor_id: usuario.doctor_id ?? "",
    })
    setDrawerUsuario(null)
    setFormOpen(true)
  }

  const onSubmit = handleSubmit(async (datos) => {
    const payload = {
      nombre: datos.nombre,
      email: datos.email,
      rol: datos.rol,
      activo: datos.activo,
      doctor_id: datos.doctor_id ?? "",
    }

    const resultado = usuarioEditando
      ? await editarUsuario(usuarioEditando.id, payload)
      : await crearUsuario(payload)

    if (resultado.error) {
      toast.error(resultado.error)
      return
    }

    toast.success(
      usuarioEditando
        ? "Usuario actualizado correctamente"
        : "Invitacion enviada al correo del usuario"
    )
    setFormOpen(false)
    router.refresh()
  })

  // -------------------------------------------------------------------------
  // Handlers — eliminar
  // -------------------------------------------------------------------------

  function confirmarEliminar(usuario: PerfilUsuario) {
    setDrawerUsuario(null)
    setUsuarioParaEliminar(usuario)
  }

  function ejecutarEliminar() {
    if (!usuarioParaEliminar) return
    startTransitionEliminar(async () => {
      const { error } = await eliminarUsuario(usuarioParaEliminar.id)
      if (error) {
        toast.error(error)
      } else {
        toast.success("Usuario eliminado")
        router.refresh()
      }
      setUsuarioParaEliminar(null)
    })
  }

  // -------------------------------------------------------------------------
  // Campos del formulario compartidos entre Drawer y Sheet
  // -------------------------------------------------------------------------

  const esNuevo = !usuarioEditando

  const camposForm = (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
      {/* Nombre */}
      <div className="space-y-1.5">
        <Label htmlFor="nombre">
          Nombre <span className="text-red-500">*</span>
        </Label>
        <Input
          id="nombre"
          placeholder="Nombre completo"
          {...register("nombre")}
        />
        {errors.nombre && (
          <p className="text-xs text-red-500">{errors.nombre.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email">
          Correo electronico <span className="text-red-500">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="correo@ejemplo.com"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
        {esNuevo && (
          <p className="text-xs text-muted-foreground">
            Se enviara una invitacion de acceso al correo ingresado.
          </p>
        )}
      </div>

      {/* Rol — oculto cuando el supervisor edita su propia cuenta */}
      {!(perfilActual.rol === "supervisor" && usuarioEditando?.id === perfilActual.id) && (
        <div className="space-y-1.5">
          <Label>
            Rol <span className="text-red-500">*</span>
          </Label>
          <Controller
            control={control}
            name="rol"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">Administrador</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* Doctor vinculado — solo si rol es doctor */}
      {rolActual === "doctor" && (
        <div className="space-y-1.5">
          <Label>Doctor vinculado</Label>
          <Controller
            control={control}
            name="doctor_id"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar doctor..." />
                </SelectTrigger>
                <SelectContent>
                  {doctores.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">
            Vincula esta cuenta al registro del doctor en el sistema.
          </p>
        </div>
      )}

      {/* Activo */}
      <div className="flex items-center gap-3">
        <Controller
          control={control}
          name="activo"
          render={({ field }) => (
            <Switch
              id="activo"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label htmlFor="activo" className="cursor-pointer">
          Usuario activo
        </Label>
      </div>
    </div>
  )

  const botonesForm = (
    <div className="flex gap-2 w-full">
      <Button
        type="button"
        variant="ghost"
        className="flex-1"
        onClick={() => setFormOpen(false)}
      >
        Cancelar
      </Button>
      <Button type="submit" disabled={isSubmitting} className="flex-1">
        {isSubmitting ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-6 pb-20 md:pb-5 space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {usuarios.length} registros
          </span>
          <Button size="sm" onClick={abrirFormNuevo}>
            Nuevo usuario
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------
          Lista movil
      ------------------------------------------------------------------ */}
      <div className="md:hidden rounded-lg border border-border divide-y divide-border overflow-hidden">
        {usuarios.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Sin usuarios registrados.
          </p>
        )}
        {usuarios.map((usuario) => (
          <button
            key={usuario.id}
            onClick={() => setDrawerUsuario(usuario)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
          >
            <span
              className={`shrink-0 h-2 w-2 rounded-full ${
                usuario.activo ? "bg-emerald-500" : "bg-muted-foreground/40"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{usuario.nombre}</p>
              {usuario.email && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {usuario.email}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  ROL_ESTILO[usuario.rol] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {ROL_LABELS[usuario.rol] ?? usuario.rol}
              </span>
              <ChevronRight size={15} className="text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------
          Tabla escritorio
      ------------------------------------------------------------------ */}
      <div className="hidden md:block rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {["Nombre", "Correo electronico", "Rol", "Estado", "Acciones"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Sin usuarios registrados.
                </td>
              </tr>
            )}
            {usuarios.map((usuario) => (
              <tr
                key={usuario.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                <td className="px-4 py-3 font-medium">{usuario.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {usuario.email ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      ROL_ESTILO[usuario.rol] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {ROL_LABELS[usuario.rol] ?? usuario.rol}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      usuario.activo
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {usuario.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {puedeEditar(perfilActual, usuario) && (
                      <button
                        onClick={() => abrirFormEdicion(usuario)}
                        title="Editar usuario"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      >
                        <SquarePen size={15} />
                      </button>
                    )}
                    {puedeEliminar(perfilActual, usuario) && (
                      <button
                        onClick={() => confirmarEliminar(usuario)}
                        title="Eliminar usuario"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------
          Drawer detalle — movil
      ------------------------------------------------------------------ */}
      <Drawer
        open={!!drawerUsuario}
        onOpenChange={(open) => {
          if (!open) setDrawerUsuario(null)
        }}
        shouldScaleBackground
      >
        <DrawerContent style={{ height: "65svh" }}>
          {drawerUsuario && (
            <div className="flex flex-col h-full">
              <DrawerHeader className="border-b border-border pb-3 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <DrawerTitle className="text-base font-semibold leading-tight">
                      {drawerUsuario.nombre}
                    </DrawerTitle>
                    <span
                      className={`mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        ROL_ESTILO[drawerUsuario.rol] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {ROL_LABELS[drawerUsuario.rol] ?? drawerUsuario.rol}
                    </span>
                  </div>
                  {puedeEditar(perfilActual, drawerUsuario) && (
                    <button
                      onClick={() => abrirFormEdicion(drawerUsuario)}
                      className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
                      title="Editar usuario"
                    >
                      <SquarePen size={16} />
                    </button>
                  )}
                </div>
              </DrawerHeader>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Correo</dt>
                    <dd className="font-medium text-right truncate max-w-[60%]">
                      {drawerUsuario.email ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Estado</dt>
                    <dd>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          drawerUsuario.activo
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {drawerUsuario.activo ? "Activo" : "Inactivo"}
                      </span>
                    </dd>
                  </div>
                  {drawerUsuario.doctor_nombre && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Doctor</dt>
                      <dd className="font-medium text-right truncate max-w-[60%]">
                        {drawerUsuario.doctor_nombre}
                      </dd>
                    </div>
                  )}
                </dl>

                {puedeEliminar(perfilActual, drawerUsuario) && (
                  <button
                    onClick={() => confirmarEliminar(drawerUsuario)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-destructive/30 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={15} />
                    Eliminar usuario
                  </button>
                )}
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* ------------------------------------------------------------------
          Formulario crear / editar — mobile: drawer, desktop: sheet
      ------------------------------------------------------------------ */}
      {(() => {
        const titulo = usuarioEditando ? "Editar usuario" : "Nuevo usuario"

        return (
          <>
            {/* Drawer — solo movil */}
            <Drawer
              open={formOpen && !isDesktop}
              onOpenChange={(o) => {
                if (!o) setFormOpen(false)
              }}
              shouldScaleBackground
            >
              <DrawerContent style={{ height: "85svh" }}>
                <DrawerHeader className="border-b border-border pb-3 shrink-0">
                  <DrawerTitle>{titulo}</DrawerTitle>
                </DrawerHeader>
                <form onSubmit={onSubmit} className="flex flex-col h-full min-h-0">
                  {camposForm}
                  <DrawerFooter className="border-t border-border shrink-0">
                    {botonesForm}
                  </DrawerFooter>
                </form>
              </DrawerContent>
            </Drawer>

            {/* Sheet — solo escritorio */}
            <Sheet
              open={formOpen && isDesktop}
              onOpenChange={(o) => {
                if (!o) setFormOpen(false)
              }}
            >
              <SheetContent
                side="right"
                className="flex flex-col p-0 w-[480px] sm:max-w-[480px] rounded-xl"
                showCloseButton={false}
                style={{
                  top: "10px",
                  bottom: "10px",
                  right: "10px",
                  height: "calc(100svh - 20px)",
                }}
              >
                <SheetHeader className="shrink-0 border-b border-border px-6 py-4">
                  <SheetTitle>{titulo}</SheetTitle>
                </SheetHeader>
                <form onSubmit={onSubmit} className="flex flex-col h-full min-h-0">
                  {camposForm}
                  <SheetFooter className="shrink-0 border-t border-border px-4 py-4">
                    {botonesForm}
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
          </>
        )
      })()}

      {/* ------------------------------------------------------------------
          Dialogo de confirmacion — eliminar usuario
      ------------------------------------------------------------------ */}
      <Dialog
        open={!!usuarioParaEliminar}
        onOpenChange={(o) => {
          if (!o) setUsuarioParaEliminar(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription>
              Esta accion eliminara permanentemente la cuenta de{" "}
              <strong>{usuarioParaEliminar?.nombre}</strong>. El usuario perdera acceso al sistema de inmediato. Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setUsuarioParaEliminar(null)}
              disabled={isPendingEliminar}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={ejecutarEliminar}
              disabled={isPendingEliminar}
            >
              {isPendingEliminar ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
