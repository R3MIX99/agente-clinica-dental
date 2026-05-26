"use client"

import { useState, useTransition } from "react"
import {
  Check, ArrowRight, CreditCard, AlertTriangle, Clock,
  CheckCircle2, XCircle, Plus, Minus, ChevronDown, ChevronUp,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  iniciarCheckout,
  cancelarSuscripcion,
  cambiarPlan,
  type DatosFacturacion,
  type EstadoSuscripcion,
} from "@/app/actions/facturacion"
import { contratarAddon, quitarAddon, type AddonCatalogo, type AddonContratado } from "@/app/actions/addons"
import type { PlanCatalogo } from "@/app/actions/uso"

// ---------------------------------------------------------------------------
// Datos estaticos de caracteristicas por plan
// ---------------------------------------------------------------------------

const EXTRAS_PLAN: Record<string, { descripcion: string; caracteristicas: string[] }> = {
  Solo: {
    descripcion: "Para consultorios independientes.",
    caracteristicas: ["1 clinica, 1 doctor", "Agente IA 24/7", "Agenda y recordatorios", "Ficha digital"],
  },
  Profesional: {
    descripcion: "Para clinicas en crecimiento.",
    caracteristicas: ["1 clinica, hasta 5 doctores", "2 usuarios admin", "Reportes avanzados", "Soporte prioritario"],
  },
  Clinica: {
    descripcion: "Para grupos dentales.",
    caracteristicas: ["Hasta 3 clinicas", "Hasta 12 doctores", "Gestion multi-sucursal", "Soporte dedicado"],
  },
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function fmt(mxn: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(mxn)
}

function fmtFecha(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric",
  })
}

function fmtFechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

// ---------------------------------------------------------------------------
// Badge de estado de suscripcion
// ---------------------------------------------------------------------------

function BadgeSuscripcion({ estado }: { estado: EstadoSuscripcion }) {
  const cfg: Record<EstadoSuscripcion, { label: string; className: string }> = {
    prueba:        { label: "Periodo de prueba",  className: "bg-blue-500 text-white hover:bg-blue-500" },
    activa:        { label: "Activa",             className: "bg-green-600 text-white hover:bg-green-600" },
    pago_pendiente:{ label: "Pago pendiente",     className: "bg-amber-500 text-white hover:bg-amber-500" },
    vencida:       { label: "Vencida",            className: "bg-orange-500 text-white hover:bg-orange-500" },
    suspendida:    { label: "Suspendida",         className: "bg-destructive text-destructive-foreground" },
    cancelada:     { label: "Cancelada",          className: "bg-muted text-muted-foreground" },
  }
  const { label, className } = cfg[estado] ?? cfg.prueba
  return <Badge className={className}>{label}</Badge>
}

// ---------------------------------------------------------------------------
// Icono de estado de pago en el historial
// ---------------------------------------------------------------------------

function IconoPago({ status }: { status: string }) {
  if (status === "approved" || status === "authorized") {
    return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
  }
  if (status === "pending" || status === "in_process") {
    return <Clock className="h-4 w-4 text-amber-500 shrink-0" />
  }
  return <XCircle className="h-4 w-4 text-destructive shrink-0" />
}

// ---------------------------------------------------------------------------
// Dialog de seleccion de plan (para activar suscripcion o regularizar pago)
// ---------------------------------------------------------------------------

function SeleccionarPlanDialog({
  planes,
  planActualId,
  children,
}: {
  planes: PlanCatalogo[]
  planActualId: string
  children: React.ReactNode
}) {
  const [open, setOpen]           = useState(false)
  const [cargando, startTransition] = useTransition()

  function handleContratar(plan: PlanCatalogo) {
    startTransition(async () => {
      try {
        const { url } = await iniciarCheckout(plan.id)
        window.location.href = url
      } catch (e) {
        toast.error("No se pudo iniciar el pago. Intentalo de nuevo.")
        console.error(e)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[900px] p-0 gap-0 overflow-hidden">
        <div className="px-8 pt-7 pb-5 border-b border-border">
          <DialogTitle className="text-lg font-semibold">Elige tu plan</DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            Seras redirigido al checkout seguro de Mercado Pago para completar el pago.
          </DialogDescription>
        </div>

        <div className="px-8 py-6">
          <div className="grid grid-cols-3 gap-5">
            {planes.map((plan) => {
              const esActual = plan.id === planActualId
              const extras   = EXTRAS_PLAN[plan.nombre] ?? { descripcion: "", caracteristicas: [] }
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-xl border p-5",
                    esActual ? "border-border bg-muted/30" : "border-border bg-card"
                  )}
                >
                  {esActual && (
                    <div className="absolute -top-3 left-5">
                      <Badge variant="secondary" className="text-xs">Plan actual</Badge>
                    </div>
                  )}
                  <p className="text-base font-bold text-foreground">{plan.nombre}</p>
                  <div className="mt-1 mb-3 flex items-end gap-1">
                    <span className="text-3xl font-extrabold">{fmt(plan.precio_mensual_mxn)}</span>
                    <span className="text-sm text-muted-foreground mb-1">/ mes</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{extras.descripcion}</p>
                  <ul className="flex-1 space-y-2 mb-5">
                    {extras.caracteristicas.map((c) => (
                      <li key={c} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    variant={esActual ? "outline" : "default"}
                    className="w-full"
                    disabled={esActual || cargando}
                    onClick={() => !esActual && handleContratar(plan)}
                  >
                    {esActual ? "Plan actual" : cargando ? "Redirigiendo..." : (
                      <>Contratar<ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-8 py-4 border-t border-border bg-muted/20">
          <p className="text-xs text-center text-muted-foreground">
            El pago se procesa de forma segura en Mercado Pago. La app nunca almacena datos de tarjeta.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog de cambio de plan (solo para suscripciones activas)
// ---------------------------------------------------------------------------

function CambiarPlanDialog({
  planes,
  planActualId,
  planActualPrecio,
}: {
  planes: PlanCatalogo[]
  planActualId: string
  planActualPrecio: number
}) {
  const [open, setOpen]             = useState(false)
  const [cargando, startTransition] = useTransition()

  function handleCambiar(plan: PlanCatalogo) {
    startTransition(async () => {
      try {
        const resultado = await cambiarPlan(plan.id)

        if (!resultado.ok) {
          toast.error(resultado.mensaje)
          return
        }

        if (resultado.requiereCheckout) {
          // Upgrade: ir al checkout
          const { url } = await iniciarCheckout(plan.id)
          window.location.href = url
          return
        }

        // Downgrade programado
        toast.success(resultado.mensaje)
        setOpen(false)
      } catch (e) {
        toast.error("No se pudo cambiar el plan. Intentalo de nuevo.")
        console.error(e)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Cambiar plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] p-0 gap-0 overflow-hidden">
        <div className="px-8 pt-7 pb-5 border-b border-border">
          <DialogTitle className="text-lg font-semibold">Cambiar plan</DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            El upgrade aplica inmediatamente. El downgrade aplica al inicio del proximo periodo.
          </DialogDescription>
        </div>

        <div className="px-8 py-6">
          <div className="grid grid-cols-3 gap-5">
            {planes.map((plan) => {
              const esActual  = plan.id === planActualId
              const esUpgrade = plan.precio_mensual_mxn > planActualPrecio
              const extras    = EXTRAS_PLAN[plan.nombre] ?? { descripcion: "", caracteristicas: [] }

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-xl border p-5",
                    esActual ? "border-border bg-muted/30" : "border-border bg-card"
                  )}
                >
                  {esActual && (
                    <div className="absolute -top-3 left-5">
                      <Badge variant="secondary" className="text-xs">Plan actual</Badge>
                    </div>
                  )}
                  {!esActual && esUpgrade && (
                    <div className="absolute -top-3 left-5">
                      <Badge className="text-xs bg-green-600 text-white hover:bg-green-600">Upgrade</Badge>
                    </div>
                  )}
                  <p className="text-base font-bold text-foreground">{plan.nombre}</p>
                  <div className="mt-1 mb-3 flex items-end gap-1">
                    <span className="text-3xl font-extrabold">{fmt(plan.precio_mensual_mxn)}</span>
                    <span className="text-sm text-muted-foreground mb-1">/ mes</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{extras.descripcion}</p>
                  <ul className="flex-1 space-y-1.5 mb-4 text-sm">
                    <li className="text-muted-foreground">{plan.max_doctores} doctor{plan.max_doctores !== 1 ? "es" : ""}</li>
                    <li className="text-muted-foreground">{plan.max_usuarios} usuario{plan.max_usuarios !== 1 ? "s" : ""} admin</li>
                    <li className="text-muted-foreground">{plan.max_recordatorios_mes.toLocaleString("es-MX")} recordatorios/mes</li>
                  </ul>
                  <Button
                    size="sm"
                    variant={esActual ? "outline" : esUpgrade ? "default" : "secondary"}
                    className="w-full"
                    disabled={esActual || cargando}
                    onClick={() => !esActual && handleCambiar(plan)}
                  >
                    {esActual
                      ? "Plan actual"
                      : cargando
                      ? "Procesando..."
                      : esUpgrade
                      ? "Subir a este plan"
                      : "Bajar a este plan"}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-8 py-4 border-t border-border bg-muted/20">
          <p className="text-xs text-center text-muted-foreground">
            Los upgrades requieren completar el pago en Mercado Pago. Los downgrades aplican al siguiente ciclo de cobro.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog de confirmacion de cancelacion
// ---------------------------------------------------------------------------

function CancelarDialog({ onConfirmar }: { onConfirmar: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/5">
          Cancelar suscripcion
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirmar cancelacion</DialogTitle>
          <DialogDescription>
            Al cancelar, el acceso se mantiene hasta el fin del periodo actual. Tus datos no se borran.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false)
              onConfirmar()
            }}
          >
            Si, cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Seccion de add-ons
// ---------------------------------------------------------------------------

function AddonsSection({
  catalogo,
  contratados,
  totalAddons,
  limiteEfectivoDoctores,
  limiteEfectivoUsuarios,
  limiteEfectivoRecordatorios,
  planMaxDoctores,
  planMaxUsuarios,
  planMaxRecordatorios,
  estadoSuscripcion,
  onRefresh,
}: {
  catalogo: AddonCatalogo[]
  contratados: AddonContratado[]
  totalAddons: number
  limiteEfectivoDoctores: number
  limiteEfectivoUsuarios: number
  limiteEfectivoRecordatorios: number
  planMaxDoctores: number
  planMaxUsuarios: number
  planMaxRecordatorios: number
  estadoSuscripcion: EstadoSuscripcion
  onRefresh: () => void
}) {
  const [cargandoId, setCargandoId] = useState<string | null>(null)
  const [expandido, setExpandido]   = useState(false)

  const puedeModificar = ["prueba", "activa"].includes(estadoSuscripcion)

  async function handleContratar(addon: AddonCatalogo) {
    setCargandoId(addon.id)
    try {
      const res = await contratarAddon(addon.id)
      if (res.ok) {
        toast.success(res.mensaje)
        onRefresh()
      } else {
        toast.error(res.mensaje)
      }
    } catch {
      toast.error("Error al contratar el add-on. Intentalo de nuevo.")
    } finally {
      setCargandoId(null)
    }
  }

  async function handleQuitar(sa: AddonContratado) {
    setCargandoId(sa.id)
    try {
      const res = await quitarAddon(sa.id)
      if (res.ok) {
        toast.success(res.mensaje)
        onRefresh()
      } else {
        toast.error(res.mensaje)
      }
    } catch {
      toast.error("Error al quitar el add-on. Intentalo de nuevo.")
    } finally {
      setCargandoId(null)
    }
  }

  // Mapa de contratados por addon_id
  const contratadoMap: Record<string, AddonContratado> = {}
  for (const c of contratados) contratadoMap[c.addon_id] = c

  return (
    <Card>
      <CardHeader className="pb-3">
        <button
          type="button"
          className="flex items-start justify-between gap-4 w-full text-left"
          onClick={() => setExpandido((v) => !v)}
        >
          <div>
            <CardTitle className="text-base">Add-ons</CardTitle>
            <CardDescription className="mt-0.5">
              Amplia los limites de tu plan sin cambiar de nivel.
              {totalAddons > 0 && (
                <span className="ml-2 font-medium text-foreground">+{fmt(totalAddons)}/mes</span>
              )}
            </CardDescription>
          </div>
          {expandido
            ? <ChevronUp className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
            : <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />}
        </button>
      </CardHeader>

      {expandido && (
        <CardContent className="space-y-4">
          {/* Limites efectivos */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">Doctores</p>
              <p className="text-lg font-bold">{limiteEfectivoDoctores}</p>
              <p className="text-[11px] text-muted-foreground">{planMaxDoctores} plan + {limiteEfectivoDoctores - planMaxDoctores} add-ons</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">Usuarios admin</p>
              <p className="text-lg font-bold">{limiteEfectivoUsuarios}</p>
              <p className="text-[11px] text-muted-foreground">{planMaxUsuarios} plan + {limiteEfectivoUsuarios - planMaxUsuarios} add-ons</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">Recordatorios</p>
              <p className="text-lg font-bold">{limiteEfectivoRecordatorios.toLocaleString("es-MX")}</p>
              <p className="text-[11px] text-muted-foreground">{planMaxRecordatorios.toLocaleString("es-MX")} plan + {(limiteEfectivoRecordatorios - planMaxRecordatorios).toLocaleString("es-MX")} add-ons</p>
            </div>
          </div>

          {/* Catalogo de add-ons */}
          <div className="divide-y divide-border">
            {catalogo.map((addon) => {
              const contratado = contratadoMap[addon.id]
              const cantidad   = contratado?.cantidad ?? 0
              const cargando   = cargandoId === addon.id || cargandoId === contratado?.id

              return (
                <div key={addon.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{addon.nombre}</p>
                    <p className="text-xs text-muted-foreground">{addon.descripcion}</p>
                    {contratado?.prorrateo_mxn != null && cantidad > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Prorrateo de periodo actual: {fmt(contratado.prorrateo_mxn * cantidad)} (informativo)
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-semibold tabular-nums shrink-0">{fmt(addon.precio_mensual_mxn)}/mes</p>
                  {puedeModificar ? (
                    <div className="flex items-center gap-1 shrink-0">
                      {cantidad > 0 && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={cargando}
                          onClick={() => contratado && handleQuitar(contratado)}
                          title="Quitar uno"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                      )}
                      {cantidad > 0 && (
                        <span className="text-sm font-medium w-5 text-center">{cantidad}</span>
                      )}
                      <Button
                        variant={cantidad > 0 ? "outline" : "default"}
                        size="icon"
                        className="h-7 w-7"
                        disabled={cargando}
                        onClick={() => handleContratar(addon)}
                        title="Agregar uno"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {cantidad > 0 ? `x${cantidad}` : "No activo"}
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>

          {!puedeModificar && (
            <p className="text-xs text-muted-foreground text-center">
              Activa tu suscripcion para contratar add-ons.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// FacturacionClient — componente principal
// ---------------------------------------------------------------------------

export function FacturacionClient({
  datos,
  planes,
  catalogo,
  contratados,
  totalAddons,
  limiteEfectivoDoctores,
  limiteEfectivoUsuarios,
  limiteEfectivoRecordatorios,
}: {
  datos: DatosFacturacion
  planes: PlanCatalogo[]
  catalogo: AddonCatalogo[]
  contratados: AddonContratado[]
  totalAddons: number
  limiteEfectivoDoctores: number
  limiteEfectivoUsuarios: number
  limiteEfectivoRecordatorios: number
}) {
  const { plan, suscripcion, historial } = datos
  const [cargando, startTransition] = useTransition()
  const [refreshKey, setRefreshKey] = useState(0)

  // Estado local de add-ons (para refresh sin reload de pagina)
  const [addonsLocales, setAddonsLocales] = useState({ contratados, totalAddons })

  function handleRefreshAddons() {
    // En produccion el refresco completo viene del RSC parent;
    // aqui solo forzamos un re-render ligero para feedback inmediato.
    setRefreshKey((k) => k + 1)
  }

  function handleCancelar() {
    startTransition(async () => {
      const resultado = await cancelarSuscripcion()
      if (resultado.ok) {
        toast.success(resultado.mensaje)
      } else {
        toast.error(resultado.mensaje)
      }
    })
  }

  const puedeContratar = ["prueba", "pago_pendiente", "vencida", "suspendida", "cancelada"].includes(suscripcion.estado)
  const puedeActivar   = suscripcion.estado === "activa"
  const puedeCambiarPlan = suscripcion.estado === "activa" || suscripcion.estado === "prueba"
  const enGracia       = suscripcion.estado === "pago_pendiente" && !!suscripcion.periodo_gracia_fin
  const enPrueba       = suscripcion.estado === "prueba"

  const totalMensual = plan.precio_mensual_mxn + totalAddons

  return (
    <div className="space-y-6">

      {/* --- Aviso de periodo de prueba --- */}
      {enPrueba && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-400/40 bg-blue-50 dark:bg-blue-950/20 p-4">
          <CreditCard className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
              Estas en periodo de prueba hasta el {suscripcion.fin_periodo
                ? new Date(suscripcion.fin_periodo + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long" })
                : "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Activa tu suscripcion antes de que termine para no perder el acceso.
            </p>
          </div>
        </div>
      )}

      {/* --- Aviso de estado critico --- */}
      {(suscripcion.estado === "suspendida" || suscripcion.estado === "cancelada") && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {suscripcion.estado === "suspendida" ? "Acceso suspendido por pago pendiente" : "Suscripcion cancelada"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {suscripcion.estado === "suspendida"
                ? "Reactiva tu suscripcion para recuperar el acceso completo al sistema."
                : "Contrata un plan para volver a usar todas las funciones."}
            </p>
          </div>
        </div>
      )}

      {/* --- Aviso de periodo de gracia --- */}
      {enGracia && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 p-4">
          <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Hubo un problema con tu ultimo pago. El acceso se mantiene hasta el{" "}
            <strong>{fmtFecha(suscripcion.periodo_gracia_fin?.slice(0, 10) ?? null)}</strong>.
            Regulariza tu pago para evitar la suspension.
          </p>
        </div>
      )}

      {/* --- Plan y suscripcion --- */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base">Plan {plan.nombre}</CardTitle>
              <CardDescription className="mt-0.5">
                {fmt(plan.precio_mensual_mxn)} / mes
                {totalAddons > 0 && (
                  <> + {fmt(totalAddons)} en add-ons = <strong>{fmt(totalMensual)}/mes</strong></>
                )}
                {suscripcion.inicio_periodo && (
                  <> &middot; Periodo {fmtFecha(suscripcion.inicio_periodo)} — {fmtFecha(suscripcion.fin_periodo)}</>
                )}
              </CardDescription>
            </div>
            <BadgeSuscripcion estado={suscripcion.estado} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Detalles de la suscripcion */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Proximo cobro</p>
              <p className="font-medium">{fmtFecha(suscripcion.mp_next_payment_date)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Correo de pago</p>
              <p className="font-medium truncate">{suscripcion.mp_payer_email ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">ID de suscripcion</p>
              <p className="font-mono text-xs text-muted-foreground truncate">
                {suscripcion.mp_subscription_id ? suscripcion.mp_subscription_id.slice(0, 20) + "..." : "—"}
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap gap-2">
            {puedeContratar && (
              <SeleccionarPlanDialog planes={planes} planActualId={plan.id}>
                <Button size="sm" disabled={cargando}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {suscripcion.estado === "prueba"
                    ? "Activar suscripcion"
                    : suscripcion.estado === "cancelada"
                    ? "Contratar plan"
                    : "Regularizar pago"}
                </Button>
              </SeleccionarPlanDialog>
            )}

            {puedeCambiarPlan && !puedeContratar && (
              <CambiarPlanDialog
                planes={planes}
                planActualId={plan.id}
                planActualPrecio={plan.precio_mensual_mxn}
              />
            )}

            {puedeActivar && (
              <CancelarDialog onConfirmar={handleCancelar} />
            )}

            {suscripcion.estado === "activa" && suscripcion.mp_subscription_id && (
              <Button variant="ghost" size="sm" asChild>
                <a
                  href="https://www.mercadopago.com.mx/subscriptions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Gestionar en Mercado Pago
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --- Add-ons --- */}
      <AddonsSection
        key={refreshKey}
        catalogo={catalogo}
        contratados={addonsLocales.contratados}
        totalAddons={addonsLocales.totalAddons}
        limiteEfectivoDoctores={limiteEfectivoDoctores}
        limiteEfectivoUsuarios={limiteEfectivoUsuarios}
        limiteEfectivoRecordatorios={limiteEfectivoRecordatorios}
        planMaxDoctores={plan.precio_mensual_mxn > 0 ? planes.find(p => p.id === plan.id)?.max_doctores ?? 0 : 0}
        planMaxUsuarios={plan.precio_mensual_mxn > 0 ? planes.find(p => p.id === plan.id)?.max_usuarios ?? 0 : 0}
        planMaxRecordatorios={plan.precio_mensual_mxn > 0 ? planes.find(p => p.id === plan.id)?.max_recordatorios_mes ?? 0 : 0}
        estadoSuscripcion={suscripcion.estado}
        onRefresh={handleRefreshAddons}
      />

      {/* --- Historial de pagos --- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historial de pagos</CardTitle>
          <CardDescription>Ultimos eventos de cobro registrados en la suscripcion.</CardDescription>
        </CardHeader>
        <CardContent>
          {historial.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aun no hay pagos registrados.
            </p>
          ) : (
            <div className="space-y-2">
              {historial.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-3 text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0"
                >
                  <IconoPago status={h.status} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{h.concepto ?? h.status}</p>
                    <p className="text-xs text-muted-foreground">{fmtFechaCorta(h.created_at)}</p>
                  </div>
                  {h.monto_mxn !== null && (
                    <p className="font-medium tabular-nums shrink-0">{fmt(h.monto_mxn)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Nota de seguridad --- */}
      <p className="text-xs text-muted-foreground text-center">
        El cobro se realiza directamente en Mercado Pago. La aplicacion nunca almacena ni accede a datos de tarjeta.
      </p>
    </div>
  )
}
