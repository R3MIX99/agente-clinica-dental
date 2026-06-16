"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { UsoClinica, EstadoSaldo } from "@/app/actions/uso"

// ---------------------------------------------------------------------------
// Utilidades de formato
// ---------------------------------------------------------------------------

function fmtDecimal(mxn: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(mxn)
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
// Badge de estado
// ---------------------------------------------------------------------------

function BadgeEstado({ estado }: { estado: EstadoSaldo }) {
  if (estado === "agotado") {
    return <Badge variant="destructive">Agotado</Badge>
  }
  if (estado === "bajo") {
    return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Por agotarse</Badge>
  }
  return <Badge className="bg-green-600 text-white hover:bg-green-600">Activo</Badge>
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function UsoClient({ uso }: { uso: UsoClinica }) {
  const { saldo, recordatorios, equipo } = uso

  return (
    <div className="space-y-6">

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
              <p className="text-muted-foreground text-xs">Total recargado</p>
              <p className="font-semibold text-foreground">{fmtDecimal(saldo.incluido_mxn)}</p>
            </div>
          </div>

          {saldo.estado === "bajo" && (
            <p className="text-sm text-amber-600">
              Te queda menos del {saldo.umbral_bajo_pct}% del saldo. Contacta al administrador para recargar y mantener el servicio sin interrupciones.
            </p>
          )}
          {saldo.estado === "agotado" && (
            <p className="text-sm text-destructive">
              Saldo agotado. El agente esta en modo handoff — los pacientes son atendidos por el equipo hasta que se realice una recarga.
            </p>
          )}
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
          <CardTitle className="text-base">Equipo incluido</CardTitle>
          <CardDescription>Doctores y usuarios configurados para la clinica.</CardDescription>
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
                <p className="text-xs text-destructive">Limite alcanzado. Contacta al administrador para ampliar.</p>
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
                <p className="text-xs text-destructive">Limite alcanzado. Contacta al administrador para ampliar.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
