"use client"

import { useState, useTransition } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { crearPlan, actualizarPlan, togglePlanActivo } from "../actions"
import type { PlanDatos, NuevoPlan } from "../actions"

// ---------------------------------------------------------------------------
// Schema de validacion
// ---------------------------------------------------------------------------

const planSchema = z.object({
  nombre:               z.string().min(1, "El nombre es requerido"),
  precio_mensual_mxn:   z.coerce.number().min(0, "Debe ser mayor o igual a 0"),
  precio_anual_mxn:     z.coerce.number().min(0, "Debe ser mayor o igual a 0"),
  max_doctores:         z.coerce.number().int().min(1, "Minimo 1"),
  max_usuarios:         z.coerce.number().int().min(1, "Minimo 1"),
  max_clinicas:         z.coerce.number().int().min(1, "Minimo 1"),
  saldo_ia_incluido_mxn: z.coerce.number().min(0),
  max_recordatorios_mes: z.coerce.number().int().min(0),
})

type PlanForm = z.infer<typeof planSchema>

// ---------------------------------------------------------------------------
// Form de plan (nuevo o edicion)
// ---------------------------------------------------------------------------

function PlanFormDialog({
  plan,
  onClose,
}: {
  plan: PlanDatos | null // null = nuevo
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PlanForm>({
    resolver: zodResolver(planSchema) as Resolver<PlanForm>,
    defaultValues: plan
      ? {
          nombre:                plan.nombre,
          precio_mensual_mxn:    plan.precio_mensual_mxn,
          precio_anual_mxn:      plan.precio_anual_mxn,
          max_doctores:          plan.max_doctores,
          max_usuarios:          plan.max_usuarios,
          max_clinicas:          plan.max_clinicas,
          saldo_ia_incluido_mxn: plan.saldo_ia_incluido_mxn,
          max_recordatorios_mes: plan.max_recordatorios_mes,
        }
      : {
          nombre:                "",
          precio_mensual_mxn:    0,
          precio_anual_mxn:      0,
          max_doctores:          1,
          max_usuarios:          1,
          max_clinicas:          1,
          saldo_ia_incluido_mxn: 0,
          max_recordatorios_mes: 0,
        },
  })

  const onSubmit = handleSubmit((datos: NuevoPlan) => {
    startTransition(async () => {
      const resultado = plan
        ? await actualizarPlan(plan.id, datos)
        : await crearPlan(datos)

      if (resultado.ok) {
        toast.success(plan ? "Plan actualizado." : "Plan creado.")
        onClose()
      } else {
        toast.error(resultado.error ?? "Error al guardar el plan.")
      }
    })
  })

  const campo = (
    name: keyof PlanForm,
    label: string,
    tipo: "text" | "number" = "number"
  ) => (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type={tipo}
        step={tipo === "number" ? "any" : undefined}
        {...register(name)}
      />
      {errors[name] && (
        <p className="text-xs text-destructive">{errors[name]?.message}</p>
      )}
    </div>
  )

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {campo("nombre", "Nombre del plan", "text")}

      <div className="grid grid-cols-2 gap-4">
        {campo("precio_mensual_mxn", "Precio mensual (MXN)")}
        {campo("precio_anual_mxn",   "Precio anual (MXN)")}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {campo("max_doctores",  "Max doctores")}
        {campo("max_usuarios",  "Max usuarios")}
        {campo("max_clinicas",  "Max clinicas")}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {campo("saldo_ia_incluido_mxn",  "Saldo IA incluido (MXN)")}
        {campo("max_recordatorios_mes", "Max recordatorios/mes")}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : plan ? "Actualizar plan" : "Crear plan"}
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

function formatMXN(valor: number) {
  return valor.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })
}

export function PlanesClient({ planes: planesIniciales }: { planes: PlanDatos[] }) {
  const [planes, setPlanes] = useState<PlanDatos[]>(planesIniciales)
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [editando, setEditando] = useState<PlanDatos | null>(null)
  const [isPending, startTransition] = useTransition()

  function abrirNuevo() {
    setEditando(null)
    setDialogAbierto(true)
  }

  function abrirEdicion(p: PlanDatos) {
    setEditando(p)
    setDialogAbierto(true)
  }

  function handleToggle(p: PlanDatos) {
    startTransition(async () => {
      const resultado = await togglePlanActivo(p.id, !p.activo)
      if (resultado.ok) {
        setPlanes((prev) =>
          prev.map((x) => (x.id === p.id ? { ...x, activo: !p.activo } : x))
        )
        toast.success(!p.activo ? "Plan activado." : "Plan desactivado.")
      } else {
        toast.error(resultado.error ?? "Error al actualizar el plan.")
      }
    })
  }

  function handleClose() {
    setDialogAbierto(false)
    setEditando(null)
    // Refrescar la pagina para obtener el estado actualizado del servidor
    window.location.reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={abrirNuevo} size="sm">
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          Nuevo plan
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right">Mensual</TableHead>
                <TableHead className="text-right">Anual</TableHead>
                <TableHead className="text-right">Doctores</TableHead>
                <TableHead className="text-right">Usuarios</TableHead>
                <TableHead className="text-right">Clinicas</TableHead>
                <TableHead className="text-right">Saldo IA</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {planes.map((p) => (
                <TableRow key={p.id} className={!p.activo ? "opacity-50" : undefined}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell className="text-right">{formatMXN(p.precio_mensual_mxn)}</TableCell>
                  <TableCell className="text-right">{formatMXN(p.precio_anual_mxn)}</TableCell>
                  <TableCell className="text-right">{p.max_doctores}</TableCell>
                  <TableCell className="text-right">{p.max_usuarios}</TableCell>
                  <TableCell className="text-right">{p.max_clinicas}</TableCell>
                  <TableCell className="text-right">{formatMXN(p.saldo_ia_incluido_mxn)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={p.activo}
                      onCheckedChange={() => handleToggle(p)}
                      disabled={isPending}
                      aria-label={`${p.activo ? "Desactivar" : "Activar"} plan ${p.nombre}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => abrirEdicion(p)}
                      aria-label={`Editar plan ${p.nombre}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {planes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8 text-sm">
                    No hay planes creados todavia.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogAbierto} onOpenChange={(o) => { if (!o) handleClose() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar plan" : "Nuevo plan"}</DialogTitle>
          </DialogHeader>
          {dialogAbierto && (
            <PlanFormDialog plan={editando} onClose={handleClose} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
