"use client"

import { useEffect, useState } from "react"
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ResumenSuperadmin } from "./actions"

const moneda = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })

export function ResumenClient({ resumen }: { resumen: ResumenSuperadmin }) {
  // Evita el desajuste de hidratacion de recharts renderizando tras montar
  const [montado, setMontado] = useState(false)
  useEffect(() => { setMontado(true) }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Resumen</h1>
        <p className="text-sm text-muted-foreground">Ingresos, clínicas y estado de las cuentas.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi titulo="Ingreso mensual (MRR)" valor={moneda(resumen.mrr_mxn)} destacado />
        <Kpi titulo="Clínicas" valor={String(resumen.total_clinicas)} />
        <Kpi titulo="Activas" valor={String(resumen.activas)} />
        <Kpi titulo="En prueba" valor={String(resumen.prueba)} />
        <Kpi titulo="Suspendidas" valor={String(resumen.suspendidas)} />
        <Kpi titulo="Por vencer (7 días)" valor={String(resumen.por_vencer)} tono={resumen.por_vencer > 0 ? "ambar" : undefined} />
        <Kpi titulo="Vencidas" valor={String(resumen.vencidas)} tono={resumen.vencidas > 0 ? "rojo" : undefined} />
      </div>

      {/* Graficas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ingresos por mes</CardTitle>
          </CardHeader>
          <CardContent>
            {montado ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={resumen.ingresos_por_mes} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={60}
                    tickFormatter={(v) => moneda(Number(v))} />
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => [moneda(Number(v)), "Ingresos"]} />
                  <Line type="monotone" dataKey="monto" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <PlaceholderGrafica />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Clínicas nuevas por mes</CardTitle>
          </CardHeader>
          <CardContent>
            {montado ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={resumen.clinicas_por_mes} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => [v, "Nuevas"]} />
                  <Bar dataKey="nuevas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <PlaceholderGrafica />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Distribución por estado</CardTitle>
          </CardHeader>
          <CardContent>
            {montado && resumen.por_estado.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={resumen.por_estado} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="value">
                      {resumen.por_estado.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex w-full flex-col gap-1.5">
                  {resumen.por_estado.map((e) => (
                    <div key={e.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: e.color }} />
                        <span className="text-muted-foreground">{e.name}</span>
                      </div>
                      <span className="font-medium">{e.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <PlaceholderGrafica />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Clínicas por plan</CardTitle>
          </CardHeader>
          <CardContent>
            {montado && resumen.por_plan.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={resumen.por_plan} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="plan" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => [v, "Clínicas"]} />
                  <Bar dataKey="clinicas" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <PlaceholderGrafica />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Kpi({ titulo, valor, destacado, tono }: {
  titulo: string
  valor: string
  destacado?: boolean
  tono?: "ambar" | "rojo"
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={[
        "mt-1 font-semibold",
        destacado ? "text-2xl" : "text-xl",
        tono === "ambar" ? "text-amber-600 dark:text-amber-400" : tono === "rojo" ? "text-red-600 dark:text-red-400" : "text-foreground",
      ].join(" ")}>
        {valor}
      </p>
    </div>
  )
}

function PlaceholderGrafica() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
      Cargando gráfica...
    </div>
  )
}
