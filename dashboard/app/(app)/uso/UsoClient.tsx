"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Check, ArrowRight } from "lucide-react"
import { iniciarCheckout } from "@/app/actions/facturacion"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { UsoClinica, EstadoSaldo, PlanCatalogo } from "@/app/actions/uso"

// ---------------------------------------------------------------------------
// Datos estaticos de cada plan (descripcion y caracteristicas)
// ---------------------------------------------------------------------------

const EXTRAS_PLAN: Record<string, { descripcion: string; caracteristicas: string[]; destacado?: boolean }> = {
  Solo: {
    descripcion: "Para consultorios independientes que quieren automatizar desde el primer dia.",
    caracteristicas: [
      "1 clinica, 1 doctor",
      "Agente IA 24/7 en WhatsApp",
      "Agenda y recordatorios automaticos",
      "Ficha digital de pacientes",
      "Panel de control basico",
    ],
  },
  Profesional: {
    destacado: true,
    descripcion: "Para clinicas en crecimiento con equipo y reportes avanzados.",
    caracteristicas: [
      "1 clinica, hasta 5 doctores",
      "2 usuarios administrativos",
      "Todo lo del plan Solo",
      "Panel de reportes avanzado",
      "Soporte prioritario por correo",
    ],
  },
  Clinica: {
    descripcion: "Para grupos dentales con varias sucursales.",
    caracteristicas: [
      "Hasta 3 clinicas",
      "Hasta 12 doctores y 4 usuarios",
      "Todo lo del plan Profesional",
      "Gestion multi-sucursal",
      "Soporte dedicado",
    ],
  },
}

// ---------------------------------------------------------------------------
// Utilidades de formato
// ---------------------------------------------------------------------------

function fmt(mxn: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(mxn)
}

function fmtDecimal(mxn: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(mxn)
}

function fmtFecha(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function fmtFechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ---------------------------------------------------------------------------
// Barra de progreso
// ---------------------------------------------------------------------------

function BarraProgreso({ pct, estado }: { pct: number; estado: EstadoSaldo }) {
  const color =
    estado === "agotado" ? "bg-destructive"
    : estado === "bajo"  ? "bg-amber-500"
    : "bg-primary"
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all duration-700", color)}
        style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Badge de estado de suscripcion / saldo
// ---------------------------------------------------------------------------

function BadgeEstado({ estado }: { estado: EstadoSaldo | string }) {
  if (estado === "agotado" || estado === "suspendida" || estado === "cancelada") {
    return <Badge variant="destructive">Agotado</Badge>
  }
  if (estado === "bajo") {
    return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Por agotarse</Badge>
  }
  if (estado === "prueba") {
    return <Badge variant="secondary">Periodo de prueba</Badge>
  }
  if (estado === "activa" || estado === "saludable") {
    return <Badge className="bg-green-600 text-white hover:bg-green-600">Activo</Badge>
  }
  return <Badge variant="outline">{estado}</Badge>
}

// ---------------------------------------------------------------------------
// Dialog de mejora de plan
// ---------------------------------------------------------------------------

function MejorarPlanDialog({
  planes,
  planActualId,
  children,
}: {
  planes: PlanCatalogo[]
  planActualId: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [cargando, startTransition] = useTransition()

  function handleContratar(plan: PlanCatalogo) {
    startTransition(async () => {
      try {
        const { url } = await iniciarCheckout(plan.id)
        window.location.href = url
      } catch {
        toast.error("No se pudo iniciar el pago. Intentalo de nuevo.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-[900px] p-0 gap-0 overflow-hidden">
        {/* Encabezado */}
        <div className="px-8 pt-7 pb-5 border-b border-border">
          <DialogTitle className="text-lg font-semibold">Elige tu nuevo plan</DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            Cambia de plan en cualquier momento. El cobro se ajusta al dia del cambio.
          </DialogDescription>
        </div>

        {/* Tarjetas de planes */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-3 gap-5">
            {planes.map((plan) => {
              const esActual  = plan.id === planActualId
              const extras    = EXTRAS_PLAN[plan.nombre] ?? { descripcion: "", caracteristicas: [] }
              const destacado = extras.destacado && !esActual

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-xl border p-6",
                    esActual
                      ? "border-border bg-muted/30 select-none"
                      : destacado
                      ? "border-primary/70 bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-muted-foreground/40 transition-colors"
                  )}
                >
                  {/* Badge superior */}
                  {(esActual || destacado) && (
                    <div className="absolute -top-3 left-6">
                      {esActual ? (
                        <Badge variant="secondary" className="text-xs">Plan actual</Badge>
                      ) : (
                        <Badge className="bg-primary text-primary-foreground text-xs">Mas popular</Badge>
                      )}
                    </div>
                  )}

                  {/* Nombre */}
                  <p className={cn(
                    "text-lg font-bold",
                    esActual ? "text-muted-foreground" : "text-foreground"
                  )}>
                    {plan.nombre}
                  </p>

                  {/* Precio */}
                  <div className="mt-2 mb-1 flex items-end gap-1">
                    <span className={cn(
                      "text-4xl font-extrabold tracking-tight",
                      esActual ? "text-muted-foreground" : "text-foreground"
                    )}>
                      {fmt(plan.precio_mensual_mxn)}
                    </span>
                    <span className="text-sm text-muted-foreground mb-1">/ mes</span>
                  </div>

                  {/* Descripcion */}
                  <p className="text-sm text-muted-foreground mb-5 min-h-[40px]">
                    {extras.descripcion}
                  </p>

                  {/* Metricas clave */}
                  <div className="mb-5 rounded-lg bg-muted/50 px-4 py-3 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Doctores</span>
                      <span className="font-medium">{plan.max_doctores}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Usuarios admin</span>
                      <span className="font-medium">{plan.max_usuarios}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Saldo IA / mes</span>
                      <span className="font-medium">{fmt(plan.saldo_ia_incluido_mxn)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Recordatorios</span>
                      <span className="font-medium">{plan.max_recordatorios_mes.toLocaleString("es-MX")}</span>
                    </div>
                  </div>

                  {/* Caracteristicas */}
                  <ul className="flex-1 space-y-2 mb-6">
                    {extras.caracteristicas.map((c) => (
                      <li key={c} className="flex items-start gap-2.5 text-sm">
                        <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                        <span className={esActual ? "text-muted-foreground" : "text-foreground"}>{c}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Boton */}
                  {esActual ? (
                    <Button variant="outline" size="default" disabled className="w-full opacity-60">
                      Plan actual
                    </Button>
                  ) : (
                    <Button
                      size="default"
                      variant={destacado ? "default" : "outline"}
                      className="w-full"
                      disabled={cargando}
                      onClick={() => handleContratar(plan)}
                    >
                      {cargando ? "Redirigiendo..." : (
                        <>Contratar<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></>
                      )}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Pie */}
        <div className="px-8 py-4 border-t border-border bg-muted/20">
          <p className="text-xs text-center text-muted-foreground">
            Precios en MXN sin IVA. Sin cargos ocultos. Cancela cuando quieras.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function UsoClient({ uso, planes }: { uso: UsoClinica; planes: PlanCatalogo[] }) {
  const { plan, suscripcion, saldo, recordatorios, equipo, ultimos_consumos } = uso

  return (
    <div className="space-y-6">

      {/* --- Plan activo --- */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Plan {plan.nombre}</CardTitle>
              <CardDescription className="mt-0.5">
                {fmtDecimal(plan.precio_mensual_mxn)} / mes
                {suscripcion.inicio_periodo && (
                  <> &middot; Periodo {fmtFecha(suscripcion.inicio_periodo)} — {fmtFecha(suscripcion.fin_periodo)}</>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <BadgeEstado estado={suscripcion.estado} />
              <MejorarPlanDialog planes={planes} planActualId={plan.id}>
                <Button size="sm" variant="outline">
                  Mejorar plan
                </Button>
              </MejorarPlanDialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* --- Saldo de IA --- */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Saldo de inteligencia artificial</CardTitle>
            <BadgeEstado estado={saldo.estado} />
          </div>
          <CardDescription>
            El agente consume saldo al atender cada mensaje con IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BarraProgreso pct={saldo.pct_consumido} estado={saldo.estado} />

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Disponible</p>
              <p className="font-semibold text-foreground">{fmtDecimal(saldo.disponible_mxn)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Consumido</p>
              <p className="font-semibold text-foreground">{fmtDecimal(saldo.consumido_mxn)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Incluido en plan</p>
              <p className="font-semibold text-foreground">{fmtDecimal(saldo.incluido_mxn)}</p>
            </div>
          </div>

          {saldo.estado === "bajo" && (
            <p className="text-sm text-amber-600">
              Te queda menos del {saldo.umbral_bajo_pct}% del saldo. Recarga para mantener el servicio sin interrupciones.
            </p>
          )}
          {saldo.estado === "agotado" && (
            <p className="text-sm text-destructive">
              Saldo agotado. El agente esta en modo handoff — los pacientes son atendidos por el equipo hasta que recargues o inicie el nuevo periodo.
            </p>
          )}

          <Button variant="outline" size="sm" disabled className="w-full sm:w-auto" title="Disponible proximamente">
            Recargar saldo — disponible en S5
          </Button>
        </CardContent>
      </Card>

      {/* --- Recordatorios --- */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recordatorios de cita</CardTitle>
            <BadgeEstado estado={recordatorios.estado} />
          </div>
          <CardDescription>
            {recordatorios.enviados} de {recordatorios.max} recordatorios usados este periodo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <BarraProgreso pct={recordatorios.pct_usado} estado={recordatorios.estado} />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{recordatorios.pct_usado}% usado</span>
            <span>{recordatorios.max - recordatorios.enviados} restantes</span>
          </div>
          {recordatorios.estado === "bajo" && (
            <p className="text-sm text-amber-600">Te acercas al limite de recordatorios del mes.</p>
          )}
          {recordatorios.estado === "agotado" && (
            <p className="text-sm text-destructive">
              Limite de recordatorios alcanzado. Los nuevos recordatorios estan pausados hasta el siguiente periodo.
            </p>
          )}
        </CardContent>
      </Card>

      {/* --- Equipo --- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Equipo incluido en el plan</CardTitle>
          <CardDescription>Doctores y usuarios segun los limites de tu plan actual.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Doctores</span>
                <span className="text-muted-foreground">{equipo.doctores_activos} / {equipo.max_doctores}</span>
              </div>
              <BarraProgreso
                pct={equipo.max_doctores > 0 ? (equipo.doctores_activos / equipo.max_doctores) * 100 : 0}
                estado={equipo.doctores_activos >= equipo.max_doctores ? "agotado" : "saludable"}
              />
              {equipo.doctores_activos >= equipo.max_doctores && (
                <p className="text-xs text-destructive">Limite alcanzado. Sube de plan para agregar mas doctores.</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Usuarios (admin / supervisor)</span>
                <span className="text-muted-foreground">{equipo.usuarios_activos} / {equipo.max_usuarios}</span>
              </div>
              <BarraProgreso
                pct={equipo.max_usuarios > 0 ? (equipo.usuarios_activos / equipo.max_usuarios) * 100 : 0}
                estado={equipo.usuarios_activos >= equipo.max_usuarios ? "agotado" : "saludable"}
              />
              {equipo.usuarios_activos >= equipo.max_usuarios && (
                <p className="text-xs text-destructive">Limite alcanzado. Sube de plan para agregar mas usuarios.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- Historial de consumo de IA --- */}
      {ultimos_consumos.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ultimos consumos de IA</CardTitle>
            <CardDescription>Registro de las llamadas mas recientes a la API de Claude.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-medium text-muted-foreground">Fecha</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Tokens entrada</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Tokens salida</th>
                    <th className="pb-2 text-right font-medium text-muted-foreground">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimos_consumos.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 text-muted-foreground">{fmtFechaCorta(c.created_at)}</td>
                      <td className="py-2 text-right tabular-nums">{c.tokens_entrada.toLocaleString("es-MX")}</td>
                      <td className="py-2 text-right tabular-nums">{c.tokens_salida.toLocaleString("es-MX")}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{fmtDecimal(c.costo_descontado_mxn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aun no hay consumos de IA registrados para esta clinica.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
