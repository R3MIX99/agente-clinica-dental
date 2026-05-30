import Link from "next/link"
import { obtenerMetricas, listarCuentas } from "./actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const metadata = { title: "Superadmin — Metricas" }

function badgeEstado(estado: string) {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    activa:     "default",
    prueba:     "secondary",
    suspendida: "destructive",
    cancelada:  "destructive",
    vencida:    "outline",
  }
  return map[estado] ?? "outline"
}

function formatMXN(valor: number) {
  return valor.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })
}

export default async function SuperadminPage() {
  const [metricas, cuentas] = await Promise.all([
    obtenerMetricas(),
    listarCuentas(),
  ])

  const ultimasCuentas = cuentas.slice(0, 6)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Resumen general</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Metricas agregadas del SaaS. Solo datos de operacion — sin historiales clinicos.
        </p>
      </div>

      {/* Tarjetas de KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              MRR estimado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMXN(metricas.mrr)}</p>
            <p className="text-xs text-muted-foreground mt-1">suscripciones activas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Cuentas activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metricas.cuentas_activas}</p>
            <p className="text-xs text-muted-foreground mt-1">con suscripcion vigente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              En periodo de prueba
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metricas.cuentas_prueba}</p>
            <p className="text-xs text-muted-foreground mt-1">sin plan de pago</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Nuevas este mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metricas.nuevas_mes}</p>
            <p className="text-xs text-muted-foreground mt-1">cuentas registradas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Distribucion por plan */}
        {metricas.distribucion_planes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribucion por plan</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Cuentas</TableHead>
                    <TableHead className="text-right">Aporte MRR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metricas.distribucion_planes.map((d) => (
                    <TableRow key={d.plan_nombre}>
                      <TableCell className="font-medium">{d.plan_nombre}</TableCell>
                      <TableCell className="text-right">{d.total}</TableCell>
                      <TableCell className="text-right">{formatMXN(d.mrr)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Ultimas cuentas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Ultimas cuentas</CardTitle>
            <Link
              href="/superadmin/cuentas"
              className="text-xs text-primary hover:underline"
            >
              Ver todas
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimasCuentas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/superadmin/cuentas/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.plan_nombre ?? "Sin plan"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeEstado(c.estado)} className="text-xs">
                        {c.estado}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {ultimasCuentas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">
                      No hay cuentas registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de cuentas suspendidas si hay */}
      {metricas.cuentas_suspendidas > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive font-medium">
            {metricas.cuentas_suspendidas}{" "}
            {metricas.cuentas_suspendidas === 1 ? "cuenta suspendida" : "cuentas suspendidas"}.{" "}
            <Link href="/superadmin/cuentas?estado=suspendida" className="underline">
              Revisar
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
