"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { crearAgente, actualizarAgente, toggleActivoAgente } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { toast } from "sonner"
import { ChevronRight, SquarePen } from "lucide-react"

// ---------------------------------------------------------------------------
// Esquema de validacion
// ---------------------------------------------------------------------------

const agenteSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  email: z.union([z.string().email("Correo electronico invalido"), z.literal("")]),
  role: z.enum(["admin", "recepcion", "odontologo"]),
  activo: z.boolean(),
})

type AgenteForm = z.infer<typeof agenteSchema>

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Agente = {
  id: string
  nombre: string
  email: string | null
  role: "admin" | "recepcion" | "odontologo"
  activo: boolean
  created_at: string
}

interface Props {
  agentes: Agente[]
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ROL_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcion: "Recepcion",
  odontologo: "Odontologo",
}

const ROL_ESTILO: Record<string, string> = {
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  recepcion: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  odontologo: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
}

const FORM_DEFAULT: AgenteForm = {
  nombre: "",
  email: "",
  role: "recepcion",
  activo: true,
}

function formatFechaIngreso(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function AgentesClient({ agentes: agentesIniciales }: Props) {
  const router = useRouter()
  const [isPendingToggle, startTransitionToggle] = useTransition()
  const [agentes, setAgentes] = useState<Agente[]>(agentesIniciales)
  const [formOpen, setFormOpen] = useState(false)
  const [agenteEditando, setAgenteEditando] = useState<Agente | null>(null)
  const [drawerAgente, setDrawerAgente] = useState<Agente | null>(null)

  useEffect(() => {
    setAgentes(agentesIniciales)
  }, [agentesIniciales])

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AgenteForm>({
    resolver: zodResolver(agenteSchema),
    defaultValues: FORM_DEFAULT,
  })

  // -------------------------------------------------------------------------
  // Handlers — formulario
  // -------------------------------------------------------------------------

  function abrirFormNuevo() {
    setAgenteEditando(null)
    reset(FORM_DEFAULT)
    setFormOpen(true)
  }

  function abrirFormEdicion(agente: Agente) {
    setAgenteEditando(agente)
    reset({
      nombre: agente.nombre,
      email: agente.email ?? "",
      role: agente.role,
      activo: agente.activo,
    })
    setDrawerAgente(null)
    setFormOpen(true)
  }

  const onSubmit = handleSubmit(async (datos) => {
    try {
      if (agenteEditando) {
        await actualizarAgente(agenteEditando.id, datos)
        toast.success("Agente actualizado correctamente")
      } else {
        await crearAgente(datos)
        toast.success("Agente creado correctamente")
      }
      setFormOpen(false)
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al guardar el agente")
    }
  })

  // -------------------------------------------------------------------------
  // Handlers — toggle activo
  // -------------------------------------------------------------------------

  function handleToggleActivo(agente: Agente, nuevo: boolean) {
    setAgentes((prev) =>
      prev.map((a) => (a.id === agente.id ? { ...a, activo: nuevo } : a))
    )
    // Sincronizar el drawer si esta abierto
    setDrawerAgente((prev) =>
      prev?.id === agente.id ? { ...prev, activo: nuevo } : prev
    )
    startTransitionToggle(async () => {
      try {
        await toggleActivoAgente(agente.id, nuevo)
      } catch {
        setAgentes((prev) =>
          prev.map((a) => (a.id === agente.id ? { ...a, activo: !nuevo } : a))
        )
        setDrawerAgente((prev) =>
          prev?.id === agente.id ? { ...prev, activo: !nuevo } : prev
        )
        toast.error("Error al actualizar el estado del agente")
      }
    })
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-6 pb-20 md:pb-5 space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agentes</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            <span className="hidden sm:inline">{agentes.length} registros</span>
          </span>
          <Button size="sm" onClick={abrirFormNuevo}>
            Nuevo agente
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Lista movil                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="md:hidden rounded-lg border border-border divide-y divide-border overflow-hidden">
        {agentes.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Sin agentes registrados.
          </p>
        )}
        {agentes.map((agente) => (
          <button
            key={agente.id}
            onClick={() => setDrawerAgente(agente)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
          >
            {/* Indicador de estado activo */}
            <span
              className={`shrink-0 h-2 w-2 rounded-full ${
                agente.activo ? "bg-emerald-500" : "bg-muted-foreground/40"
              }`}
            />

            {/* Nombre + email */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{agente.nombre}</p>
              {agente.email && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {agente.email}
                </p>
              )}
            </div>

            {/* Rol chip + chevron */}
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  ROL_ESTILO[agente.role] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {ROL_LABELS[agente.role] ?? agente.role}
              </span>
              <ChevronRight size={15} className="text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tabla escritorio                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden md:block rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {["Nombre", "Correo electronico", "Rol", "Activo", "Acciones"].map((h) => (
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
            {agentes.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Sin agentes registrados.
                </td>
              </tr>
            )}
            {agentes.map((agente) => (
              <tr
                key={agente.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                <td className="px-4 py-3 font-medium">{agente.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {agente.email ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      ROL_ESTILO[agente.role] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {ROL_LABELS[agente.role] ?? agente.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Switch
                    size="sm"
                    checked={agente.activo}
                    disabled={isPendingToggle}
                    onCheckedChange={(v) => handleToggleActivo(agente, v)}
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => abrirFormEdicion(agente)}
                    title="Editar agente"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <SquarePen size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Drawer — detalle de agente (movil)                                  */}
      {/* ------------------------------------------------------------------ */}
      <Drawer
        open={!!drawerAgente}
        onOpenChange={(open) => { if (!open) setDrawerAgente(null) }}
        shouldScaleBackground
      >
        <DrawerContent style={{ height: "60svh" }}>
          {drawerAgente && (
            <div className="flex flex-col h-full">
              <DrawerHeader className="border-b border-border pb-3 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <DrawerTitle className="text-base font-semibold leading-tight">
                      {drawerAgente.nombre}
                    </DrawerTitle>
                    <span
                      className={`mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        ROL_ESTILO[drawerAgente.role] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {ROL_LABELS[drawerAgente.role] ?? drawerAgente.role}
                    </span>
                  </div>
                  <button
                    onClick={() => abrirFormEdicion(drawerAgente)}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
                    title="Editar agente"
                  >
                    <SquarePen size={16} />
                  </button>
                </div>
              </DrawerHeader>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5">
                {/* Datos */}
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Correo</dt>
                    <dd className="font-medium text-right truncate max-w-[60%]">
                      {drawerAgente.email ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Alta</dt>
                    <dd className="font-medium">
                      {formatFechaIngreso(drawerAgente.created_at)}
                    </dd>
                  </div>
                </dl>

                {/* Toggle activo */}
                <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Estado</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {drawerAgente.activo ? "Agente activo" : "Agente inactivo"}
                    </p>
                  </div>
                  <Switch
                    checked={drawerAgente.activo}
                    disabled={isPendingToggle}
                    onCheckedChange={(v) => handleToggleActivo(drawerAgente, v)}
                  />
                </div>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* ------------------------------------------------------------------ */}
      {/* Drawer — crear / editar agente                                      */}
      {/* ------------------------------------------------------------------ */}
      <Drawer open={formOpen} onOpenChange={setFormOpen} shouldScaleBackground>
        <DrawerContent style={{ height: "85svh" }}>
          <DrawerHeader className="border-b border-border pb-3 shrink-0">
            <DrawerTitle>
              {agenteEditando ? "Editar agente" : "Nuevo agente"}
            </DrawerTitle>
          </DrawerHeader>

          <form onSubmit={onSubmit} className="flex flex-col h-full min-h-0">
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
                <Label htmlFor="email">Correo electronico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              {/* Rol */}
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Controller
                  control={control}
                  name="role"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="recepcion">Recepcion</SelectItem>
                        <SelectItem value="odontologo">Odontologo</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

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
                  Agente activo
                </Label>
              </div>
            </div>

            <DrawerFooter className="border-t border-border shrink-0">
              <div className="flex gap-2">
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
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
