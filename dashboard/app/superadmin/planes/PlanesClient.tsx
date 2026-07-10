"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { guardarPlan, cambiarActivoPlan, type PlanAdmin } from "../actions"

const moneda = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })

const VACIO: PlanAdmin = {
  id: "", nombre: "", precio_mensual_mxn: 0, precio_anual_mxn: 0,
  max_doctores: 1, max_usuarios: 1, max_clinicas: 1, max_recordatorios_mes: 300,
  saldo_ia_incluido_mxn: 0, activo: true,
}

export function PlanesClient({ planesIniciales }: { planesIniciales: PlanAdmin[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editando, setEditando] = useState<PlanAdmin | null>(null)

  function toggleActivo(p: PlanAdmin) {
    startTransition(async () => {
      const r = await cambiarActivoPlan(p.id, !p.activo)
      if (!r.ok) { toast.error(r.error ?? "Error."); return }
      toast.success(p.activo ? "Plan desactivado." : "Plan activado.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Planes</h1>
          <p className="text-sm text-muted-foreground">Catálogo de planes y sus límites.</p>
        </div>
        <Button onClick={() => setEditando({ ...VACIO })}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Nuevo plan
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Precio/mes</TableHead>
              <TableHead>Doctores</TableHead>
              <TableHead>Usuarios</TableHead>
              <TableHead>Recordatorios</TableHead>
              <TableHead>Saldo IA</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planesIniciales.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nombre}</TableCell>
                <TableCell>{moneda(p.precio_mensual_mxn)}</TableCell>
                <TableCell>{p.max_doctores}</TableCell>
                <TableCell>{p.max_usuarios}</TableCell>
                <TableCell>{p.max_recordatorios_mes}</TableCell>
                <TableCell>{moneda(p.saldo_ia_incluido_mxn)}</TableCell>
                <TableCell>
                  <Badge variant={p.activo ? "secondary" : "outline"}>{p.activo ? "Activo" : "Inactivo"}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditando(p)}>Editar</Button>
                  <Button size="sm" variant="ghost" disabled={isPending} onClick={() => toggleActivo(p)}>
                    {p.activo ? "Desactivar" : "Activar"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {planesIniciales.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No hay planes. Crea el primero con "Nuevo plan".
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editando && (
        <DialogPlan
          plan={editando}
          onCerrar={() => setEditando(null)}
          onListo={() => { setEditando(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function DialogPlan({ plan, onCerrar, onListo }: {
  plan: PlanAdmin
  onCerrar: () => void
  onListo: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [f, setF] = useState(plan)

  const num = (k: keyof PlanAdmin) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: Number(e.target.value) })

  function guardar() {
    startTransition(async () => {
      const r = await guardarPlan({
        id: f.id || undefined,
        nombre: f.nombre,
        precio_mensual_mxn: f.precio_mensual_mxn,
        precio_anual_mxn: f.precio_anual_mxn,
        max_doctores: f.max_doctores,
        max_usuarios: f.max_usuarios,
        max_clinicas: f.max_clinicas,
        max_recordatorios_mes: f.max_recordatorios_mes,
        saldo_ia_incluido_mxn: f.saldo_ia_incluido_mxn,
      })
      if (!r.ok) { toast.error(r.error ?? "No se pudo guardar."); return }
      toast.success("Plan guardado.")
      onListo()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{f.id ? "Editar plan" : "Nuevo plan"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Nombre</Label>
            <Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </div>
          <Campo label="Precio mensual (MXN)" value={f.precio_mensual_mxn} onChange={num("precio_mensual_mxn")} />
          <Campo label="Precio anual (MXN)" value={f.precio_anual_mxn} onChange={num("precio_anual_mxn")} />
          <Campo label="Doctores incluidos" value={f.max_doctores} onChange={num("max_doctores")} />
          <Campo label="Usuarios incluidos" value={f.max_usuarios} onChange={num("max_usuarios")} />
          <Campo label="Clínicas incluidas" value={f.max_clinicas} onChange={num("max_clinicas")} />
          <Campo label="Recordatorios/mes" value={f.max_recordatorios_mes} onChange={num("max_recordatorios_mes")} />
          <Campo label="Saldo IA incluido (MXN)" value={f.saldo_ia_incluido_mxn} onChange={num("saldo_ia_incluido_mxn")} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={isPending || !f.nombre.trim()}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Campo({ label, value, onChange }: {
  label: string
  value: number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={onChange} />
    </div>
  )
}
