"use client"

import { useState, useTransition } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, LogOut, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { logoutAction } from "@/app/actions/auth"
import { recargarSaldo, type ClinicaSaldo, type RecargaHistorial } from "./actions"

// ---------------------------------------------------------------------------
// Schema del formulario de recarga
// ---------------------------------------------------------------------------

const recargaSchema = z.object({
  monto_mxn:       z.coerce.number().positive("Debe ser mayor a 0"),
  referencia_pago: z.string().optional(),
  vigencia_fin:    z.string().optional(),
})

type RecargaForm = z.infer<typeof recargaSchema>

// ---------------------------------------------------------------------------
// Utilidades de formato
// ---------------------------------------------------------------------------

function fmtMXN(n: number) {
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  })
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ---------------------------------------------------------------------------
// Dialog de recarga
// ---------------------------------------------------------------------------

function DialogRecarga({
  clinica,
  abierto,
  onClose,
}: {
  clinica: ClinicaSaldo | null
  abierto: boolean
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecargaForm>({
    resolver: zodResolver(recargaSchema) as Resolver<RecargaForm>,
    defaultValues: { monto_mxn: 0, referencia_pago: "", vigencia_fin: "" },
  })

  function handleClose() {
    reset()
    onClose()
  }

  const onSubmit = handleSubmit((datos) => {
    if (!clinica?.suscripcion_id) {
      toast.error("La clinica no tiene suscripcion activa")
      return
    }
    startTransition(async () => {
      const res = await recargarSaldo({
        clinica_id:      clinica.clinica_id,
        cuenta_id:       clinica.cuenta_id,
        suscripcion_id:  clinica.suscripcion_id!,
        monto_mxn:       datos.monto_mxn,
        referencia_pago: datos.referencia_pago || undefined,
        vigencia_fin:    datos.vigencia_fin || undefined,
      })
      if (res.ok) {
        toast.success(`Recarga de ${fmtMXN(datos.monto_mxn)} aplicada`)
        reset()
        // Refrescar la pagina para ver el saldo actualizado y el historial
        window.location.reload()
      } else {
        toast.error(res.error ?? "Error al registrar la recarga")
      }
    })
  })

  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recargar saldo IA</DialogTitle>
          <DialogDescription>
            Clinica: <strong>{clinica?.clinica_nombre ?? "—"}</strong>
            <br />
            Cuenta: {clinica?.cuenta_nombre}
            <br />
            Saldo actual: {fmtMXN(clinica?.saldo_disponible_mxn ?? 0)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="monto_mxn">Monto a recargar (MXN) *</Label>
            <Input
              id="monto_mxn"
              type="number"
              step="0.01"
              min="0"
              placeholder="500.00"
              {...register("monto_mxn")}
            />
            {errors.monto_mxn && (
              <p className="text-xs text-destructive">{errors.monto_mxn.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="referencia_pago">Referencia de pago (opcional)</Label>
            <Input
              id="referencia_pago"
              placeholder="Transferencia BBVA 24/06/2026"
              {...register("referencia_pago")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vigencia_fin">Vigencia hasta (opcional)</Label>
            <Input
              id="vigencia_fin"
              type="date"
              {...register("vigencia_fin")}
            />
            <p className="text-xs text-muted-foreground">
              Si lo dejas vacio, la recarga vence con el periodo de la suscripcion.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Aplicando...</>
                : "Aplicar recarga"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function RecargasClient({
  clinicas,
  historial,
}: {
  clinicas: ClinicaSaldo[]
  historial: RecargaHistorial[]
}) {
  const [clinicaSeleccionada, setClinicaSeleccionada] = useState<ClinicaSaldo | null>(null)
  const [logoutPending, startLogout] = useTransition()

  function handleLogout() {
    startLogout(async () => { await logoutAction() })
  }

  return (
    <div className="space-y-6">
      {/* Boton de cerrar sesion */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleLogout} disabled={logoutPending}>
          {logoutPending
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saliendo...</>
            : <><LogOut className="h-4 w-4 mr-2" />Cerrar sesion</>}
        </Button>
      </div>

      {/* Tabla de clinicas con saldo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saldo por clinica</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinica</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Saldo disponible</TableHead>
                <TableHead className="text-right">Consumido este mes</TableHead>
                <TableHead className="text-right">Saldo incluido</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clinicas.map((c) => {
                const sinSuscripcion = !c.suscripcion_id
                const saldoBajo = c.saldo_disponible_mxn <= 0
                return (
                  <TableRow key={c.clinica_id}>
                    <TableCell className="font-medium">
                      {c.clinica_nombre ?? "Sin nombre"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.cuenta_nombre}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={saldoBajo ? "text-destructive font-medium" : ""}>
                        {fmtMXN(c.saldo_disponible_mxn)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {fmtMXN(c.consumido_mes_mxn)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {fmtMXN(c.saldo_incluido_mxn)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={sinSuscripcion}
                        onClick={() => setClinicaSeleccionada(c)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Recargar
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {clinicas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-sm">
                    No hay clinicas activas registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Historial de recargas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial reciente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Clinica</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historial.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {fmtFecha(r.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">{r.clinica_nombre ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.cuenta_nombre}</TableCell>
                  <TableCell className="text-right font-medium">{fmtMXN(r.monto_mxn)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.referencia_pago ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={r.estado === "completada" ? "default" : "outline"}
                      className="text-xs"
                    >
                      {r.estado}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {historial.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-sm">
                    Aun no hay recargas registradas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de recarga */}
      <DialogRecarga
        clinica={clinicaSeleccionada}
        abierto={clinicaSeleccionada !== null}
        onClose={() => setClinicaSeleccionada(null)}
      />
    </div>
  )
}
