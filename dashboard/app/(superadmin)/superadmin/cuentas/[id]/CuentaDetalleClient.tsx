"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { suspenderCuenta, reactivarCuenta } from "../../actions"
import type { CuentaDetalle } from "../../actions"

function badgeVariant(estado: string): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    activa:     "default",
    prueba:     "secondary",
    suspendida: "destructive",
    cancelada:  "destructive",
    vencida:    "outline",
  }
  return map[estado] ?? "outline"
}

function formatFecha(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" })
}

function formatMXN(valor: number | null) {
  if (valor == null) return "—"
  return Number(valor).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function CuentaDetalleClient({ cuenta }: { cuenta: CuentaDetalle }) {
  const [accion, setAccion]   = useState<"suspender" | "reactivar" | null>(null)
  const [isPending, startTransition] = useTransition()

  const puedesSuspender  = cuenta.estado !== "suspendida" && cuenta.estado !== "cancelada"
  const puedесReactivar  = cuenta.estado === "suspendida"

  function handleConfirmar() {
    if (!accion) return
    startTransition(async () => {
      const fn = accion === "suspender" ? suspenderCuenta : reactivarCuenta
      const resultado = await fn(cuenta.id)
      if (resultado.ok) {
        toast.success(
          accion === "suspender"
            ? "Cuenta suspendida correctamente."
            : "Cuenta reactivada correctamente."
        )
      } else {
        toast.error(resultado.error ?? "Error al procesar la accion.")
      }
      setAccion(null)
    })
  }

  return (
    <>
      {/* Encabezado de la cuenta */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{cuenta.nombre}</h1>
          {cuenta.email_contacto && (
            <p className="text-sm text-muted-foreground mt-0.5">{cuenta.email_contacto}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={badgeVariant(cuenta.estado)}>{cuenta.estado}</Badge>
            <span className="text-xs text-muted-foreground">
              Alta: {formatFecha(cuenta.created_at)}
            </span>
          </div>
        </div>

        {/* Acciones sensibles con confirmacion */}
        <div className="flex gap-2 shrink-0">
          {puedesSuspender && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAccion("suspender")}
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              Suspender cuenta
            </Button>
          )}
          {puedесReactivar && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAccion("reactivar")}
            >
              Reactivar cuenta
            </Button>
          )}
        </div>
      </div>

      {/* Suscripcion actual */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Plan actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {cuenta.suscripcion?.plan_nombre ?? "Sin plan"}
            </p>
            {cuenta.suscripcion && (
              <>
                <p className="text-sm text-muted-foreground">
                  {formatMXN(cuenta.suscripcion.precio_mensual_mxn)}/mes
                </p>
                <Badge variant={badgeVariant(cuenta.suscripcion.estado)} className="mt-2 text-xs">
                  {cuenta.suscripcion.estado}
                </Badge>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Periodo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">
              {cuenta.suscripcion?.periodo ?? "—"}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatFecha(cuenta.suscripcion?.inicio_periodo ?? null)} –{" "}
              {formatFecha(cuenta.suscripcion?.fin_periodo ?? null)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Uso IA este mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {cuenta.uso_ia_mes.toLocaleString("es-MX")} tokens
            </p>
            <p className="text-sm text-muted-foreground">
              Saldo disponible:{" "}
              {formatMXN(cuenta.suscripcion?.saldo_ia_disponible_mxn ?? null)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clinicas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Clinicas ({cuenta.clinicas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cuenta.clinicas.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-4">Sin clinicas registradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuenta.clinicas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nombre ?? "Sin nombre"}</TableCell>
                    <TableCell>
                      <Badge variant={c.activa ? "default" : "outline"} className="text-xs">
                        {c.activa ? "activa" : "inactiva"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Usuarios con acceso (nombre, email, rol — sin datos clinicos) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Usuarios con acceso ({cuenta.usuarios.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cuenta.usuarios.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-4">Sin usuarios registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Clinica</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuenta.usuarios.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.nombre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{u.rol}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.clinica_nombre ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Historial de pagos */}
      {cuenta.historial_pagos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de pagos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuenta.historial_pagos.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatFecha(h.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {h.concepto ?? "Pago de suscripcion"}
                    </TableCell>
                    <TableCell className="text-right">{formatMXN(h.monto_mxn)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={h.status === "approved" ? "default" : "outline"}
                        className="text-xs"
                      >
                        {h.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog de confirmacion — Suspender */}
      <Dialog open={accion === "suspender"} onOpenChange={(o) => { if (!o) setAccion(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar suspension</DialogTitle>
            <DialogDescription>
              Esta accion suspende el acceso de todas las clinicas de la cuenta{" "}
              <strong>{cuenta.nombre}</strong>. Los datos no se eliminan y se
              puede reactivar en cualquier momento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccion(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmar}
              disabled={isPending}
            >
              {isPending ? "Procesando..." : "Suspender cuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmacion — Reactivar */}
      <Dialog open={accion === "reactivar"} onOpenChange={(o) => { if (!o) setAccion(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar reactivacion</DialogTitle>
            <DialogDescription>
              Esta accion restaura el acceso a la cuenta{" "}
              <strong>{cuenta.nombre}</strong>. La suscripcion quedara en estado
              de prueba; ajusta el plan si es necesario.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccion(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmar} disabled={isPending}>
              {isPending ? "Procesando..." : "Reactivar cuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
