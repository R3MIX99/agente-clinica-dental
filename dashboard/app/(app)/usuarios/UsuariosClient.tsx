"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
  resetearPasswordUsuario,
  type PerfilUsuario,
} from "./actions"
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
import { ChevronRight, KeyRound, SquarePen, Trash2 } from "lucide-react"
import { IconTooltip } from "@/components/ui/icon-tooltip"

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
// Esquema de validación
// ---------------------------------------------------------------------------

const usuarioSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Correo electrónico inválido"),
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
  supervisor: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400",
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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UsuarioForm>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: FORM_DEFAULT,
  })

  const rolActual = watch("rol")
  const doctorIdActual = watch("doctor_id")

  // doctorIdActual se mantiene para conservar el doctor_id en el payload sin mostrarlo en UI
  void doctorIdActual

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
      // Para doctores se muestra el nombre real del registro vinculado
      nombre: usuario.rol === "doctor" && usuario.doctor_nombre
        ? usuario.doctor_nombre
        : usuario.nombre,
      email: usuario.email ?? "",
      rol: usuario.rol,
      activo: usuario.activo,
      // Se conserva el doctor_id aunque no se muestre en el formulario
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

    if (usuarioEditando) {
      toast.success("Usuario actualizado correctamente")
    } else {
      toast.success(
        `Usuario creado. Contraseña temporal: ${resultado.password} (vence en 3 días si no la cambia)`,
        { duration: 20000 },
      )
    }
    setFormOpen(false)
    router.refresh()
  })

  // -------------------------------------------------------------------------
  // Handlers — resetear contraseña
  // -------------------------------------------------------------------------

  const [isPendingReset, startTransitionReset] = useTransition()

  function ejecutarResetPassword(usuario: PerfilUsuario) {
    startTransitionReset(async () => {
      const resultado = await resetearPasswordUsuario(usuario.id)
      if (resultado.error) {
        toast.error(resultado.error)
        return
      }
      toast.success(
        `Nueva contraseña temporal para ${usuario.nombre}: ${resultado.password} (vence en 3 días si no la cambia)`,
        { duration: 20000 },
      )
      setDrawerUsuario(null)
    })
  }

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
      {/* Nombre — bloqueado al editar un doctor */}
      <div className="space-y-1.5">
        <Label htmlFor="nombre">
          Nombre <span className="text-red-500">*</span>
        </Label>
        {!esNuevo && rolActual === "doctor" ? (
          <>
            <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
              {watch("nombre") || "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              El nombre proviene del registro del doctor y no se puede modificar aquí.
            </p>
          </>
        ) : (
          <>
            <Input
              id="nombre"
              placeholder="Nombre completo"
              {...register("nombre")}
            />
            {errors.nombre && (
              <p className="text-xs text-red-500">{errors.nombre.message}</p>
            )}
          </>
        )}
      </div>

      {/* Email — bloqueado al editar un doctor */}
      <div className="space-y-1.5">
        <Label htmlFor="email">
          Correo electrónico <span className="text-red-500">*</span>
        </Label>
        {!esNuevo && rolActual === "doctor" ? (
          <>
            <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
              {(usuarioEditando?.doctor_email ?? usuarioEditando?.email) || "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              El correo se edita desde la ficha del doctor en el sistema.
            </p>
          </>
        ) : (
          <>
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
                Se enviará una invitación de acceso al correo ingresado.
              </p>
            )}
          </>
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
                usuario.activo ? "bg-cyan-500" : "bg-muted-foreground/40"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
              {usuario.rol === "doctor" && usuario.doctor_nombre
                ? usuario.doctor_nombre
                : usuario.nombre}
            </p>
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
              {["Nombre", "Correo electrónico", "Rol", "Estado", "Acciones"].map((h) => (
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
                <td className="px-4 py-3 font-medium">
                  {usuario.rol === "doctor" && usuario.doctor_nombre
                    ? usuario.doctor_nombre
                    : usuario.nombre}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {usuario.rol === "doctor"
                    ? (usuario.doctor_email ?? usuario.email ?? "—")
                    : (usuario.email ?? "—")}
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
                        ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {usuario.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {puedeEditar(perfilActual, usuario) && (
                      <IconTooltip label="Editar usuario">
                        <button
                          onClick={() => abrirFormEdicion(usuario)}
                          aria-label="Editar usuario"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                          <SquarePen size={15} />
                        </button>
                      </IconTooltip>
                    )}
                    {puedeEditar(perfilActual, usuario) && (
                      <IconTooltip label="Resetear contraseña">
                        <button
                          onClick={() => ejecutarResetPassword(usuario)}
                          disabled={isPendingReset}
                          aria-label="Resetear contraseña"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
                        >
                          <KeyRound size={15} />
                        </button>
                      </IconTooltip>
                    )}
                    {puedeEliminar(perfilActual, usuario) && (
                      <IconTooltip label="Eliminar usuario">
                        <button
                          onClick={() => confirmarEliminar(usuario)}
                          aria-label="Eliminar usuario"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </IconTooltip>
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
                      {drawerUsuario.rol === "doctor" && drawerUsuario.doctor_nombre
                        ? drawerUsuario.doctor_nombre
                        : drawerUsuario.nombre}
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
                    <IconTooltip label="Editar usuario">
                      <button
                        onClick={() => abrirFormEdicion(drawerUsuario)}
                        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
                        aria-label="Editar usuario"
                      >
                        <SquarePen size={16} />
                      </button>
                    </IconTooltip>
                  )}
                </div>
              </DrawerHeader>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Correo</dt>
                    <dd className="font-medium text-right truncate max-w-[60%]">
                      {drawerUsuario.rol === "doctor"
                        ? (drawerUsuario.doctor_email ?? drawerUsuario.email ?? "—")
                        : (drawerUsuario.email ?? "—")}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Estado</dt>
                    <dd>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          drawerUsuario.activo
                            ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400"
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

                {puedeEditar(perfilActual, drawerUsuario) && (
                  <button
                    onClick={() => ejecutarResetPassword(drawerUsuario)}
                    disabled={isPendingReset}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
                  >
                    <KeyRound size={15} />
                    Resetear contraseña
                  </button>
                )}

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
              Esta acción eliminará permanentemente la cuenta de{" "}
              <strong>{usuarioParaEliminar?.nombre}</strong>. El usuario perderá acceso al sistema de inmediato. Esta acción no se puede deshacer.
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
