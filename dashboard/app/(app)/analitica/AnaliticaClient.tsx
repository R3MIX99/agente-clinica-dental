"use client"

import { useState, useTransition, useEffect } from "react"
import { obtenerAnalitica, type DatosAnalitica } from "@/app/actions/analitica"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import {
  Users,
  MessageSquare,
  BotMessageSquare,
  CheckCircle2,
  Bell,
  CalendarDays,
  DollarSign,
  ArrowRightLeft,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Periodo = "hoy" | "7d" | "30d" | "personalizado"

// ---------------------------------------------------------------------------
// Colores de graficas
// ---------------------------------------------------------------------------

const COLOR_PACIENTE  = "#6366f1"
const COLOR_BOT       = "#22c55e"
const COLOR_AGENTE    = "#f59e0b"
const COLOR_AUTOMATICA = "#22c55e"
const COLOR_HANDOFF   = "#f59e0b"
const COLOR_POSITIVO  = "#22c55e"
const COLOR_NEUTRO    = "#94a3b8"
const COLOR_NEGATIVO  = "#ef4444"
const COLOR_SIN_DATOS = "#e2e8f0"
const COLOR_INTENCION = "#6366f1"

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function calcularFechas(
  periodo: Periodo,
  fechaInicio?: string,
  fechaFin?: string
): { inicio: string; fin: string } {
  const fin = new Date()
  fin.setHours(23, 59, 59, 999)

  if (periodo === "hoy") {
    const inicio = new Date()
    inicio.setHours(0, 0, 0, 0)
    return { inicio: inicio.toISOString(), fin: fin.toISOString() }
  }
  if (periodo === "7d") {
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - 7)
    inicio.setHours(0, 0, 0, 0)
    return { inicio: inicio.toISOString(), fin: fin.toISOString() }
  }
  if (periodo === "30d") {
    const inicio = new Date()
    inicio.setDate(inicio.getDate() - 30)
    inicio.setHours(0, 0, 0, 0)
    return { inicio: inicio.toISOString(), fin: fin.toISOString() }
  }
  // personalizado
  return {
    inicio: fechaInicio
      ? new Date(fechaInicio + "T00:00:00").toISOString()
      : new Date().toISOString(),
    fin: fechaFin
      ? new Date(fechaFin + "T23:59:59").toISOString()
      : new Date().toISOString(),
  }
}

function formatFechaCorta(fecha: string): string {
  const [, mes, día] = fecha.split("-")
  return `${día}/${mes}`
}

function formatMxn(valor: number): string {
  return `$${valor.toFixed(2)}`
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  titulo,
  valor,
  sub,
  icon: Icon,
}: {
  titulo: string
  valor: string | number
  sub?: string
  icon: React.ElementType
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground truncate">{titulo}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground leading-none">{valor}</p>
            {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="shrink-0 rounded-md bg-muted p-2">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Componente vacio de grafica
// ---------------------------------------------------------------------------

function GraficaVacia({ altura = 220 }: { altura?: number }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-muted-foreground"
      style={{ height: altura }}
    >
      Sin datos en el periodo selecciónado
    </div>
  )
}

// ---------------------------------------------------------------------------
// AnaliticaClient
// ---------------------------------------------------------------------------

export function AnaliticaClient({ datos: datosProp }: { datos: DatosAnalitica }) {
  const [datos, setDatos] = useState(datosProp)
  const [periodo, setPeriodo] = useState<Periodo>("30d")
  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")
  const [montado, setMontado] = useState(false)
  const [cargando, startTransition] = useTransition()

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMontado(true) }, [])

  function cargar(p: Periodo, fi?: string, ff?: string) {
    const { inicio, fin } = calcularFechas(p, fi, ff)
    startTransition(async () => {
      const nuevos = await obtenerAnalitica(inicio, fin)
      setDatos(nuevos)
    })
  }

  function cambiarPeriodo(p: Periodo) {
    setPeriodo(p)
    if (p !== "personalizado") cargar(p)
  }

  // Datos para graficas de donut
  const dataResolucion = [
    { name: "Automática", value: datos.conversaciones.automaticas, color: COLOR_AUTOMATICA },
    { name: "Handoff",    value: datos.conversaciones.handoff,    color: COLOR_HANDOFF    },
  ].filter((d) => d.value > 0)

  const dataSentimiento = [
    { name: "Positivo",  value: datos.sentimientos.positivo,  color: COLOR_POSITIVO  },
    { name: "Neutro",    value: datos.sentimientos.neutro,    color: COLOR_NEUTRO    },
    { name: "Negativo",  value: datos.sentimientos.negativo,  color: COLOR_NEGATIVO  },
    { name: "Sin datos", value: datos.sentimientos.sin_datos, color: COLOR_SIN_DATOS },
  ].filter((d) => d.value > 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Filtro de periodo */}
      <div className="flex flex-wrap gap-2 items-center">
        {(["hoy", "7d", "30d", "personalizado"] as Periodo[]).map((p) => (
          <Button
            key={p}
            variant={periodo === p ? "default" : "outline"}
            size="sm"
            onClick={() => cambiarPeriodo(p)}
            disabled={cargando}
          >
            {p === "hoy"           ? "Hoy"
             : p === "7d"          ? "7 días"
             : p === "30d"         ? "30 días"
             : "Personalizado"}
          </Button>
        ))}

        {periodo === "personalizado" && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">a</span>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              size="sm"
              onClick={() => cargar("personalizado", fechaInicio, fechaFin)}
              disabled={!fechaInicio || !fechaFin || cargando}
            >
              Aplicar
            </Button>
          </div>
        )}

        {cargando && (
          <span className="text-xs text-muted-foreground">Actualizando...</span>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          titulo="Pacientes atendidos"
          valor={datos.pacientes_atendidos}
          icon={Users}
        />
        <KpiCard
          titulo="Conversaciones"
          valor={datos.conversaciones.total}
          sub={`${datos.conversaciones.abiertas} abiertas`}
          icon={MessageSquare}
        />
        <KpiCard
          titulo="Mensajes del bot"
          valor={datos.mensajes.bot}
          sub={`${datos.mensajes.total} mensajes totales`}
          icon={BotMessageSquare}
        />
        <KpiCard
          titulo="Resolucion automatica"
          valor={`${datos.conversaciones.pct_automatica}%`}
          sub={`${datos.conversaciones.automaticas} de ${datos.conversaciones.total}`}
          icon={CheckCircle2}
        />
        <KpiCard
          titulo="Recordatorios enviados"
          valor={datos.recordatorios_enviados}
          icon={Bell}
        />
        <KpiCard
          titulo="Citas confirmadas"
          valor={datos.citas_confirmadas}
          icon={CalendarDays}
        />
        <KpiCard
          titulo="Consumo de IA"
          valor={formatMxn(datos.consumo_ia_mxn)}
          sub="MXN en el periodo"
          icon={DollarSign}
        />
        <KpiCard
          titulo="Derivados a agente"
          valor={datos.conversaciones.handoff}
          sub="Conversaciones handoff"
          icon={ArrowRightLeft}
        />
      </div>

      {/* Fila 1: Serie diaria + Dona resolucion */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              Mensajes por día
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!montado ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                Cargando grafica...
              </div>
            ) : datos.serie_diaria.length === 0 ? (
              <GraficaVacia altura={220} />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={datos.serie_diaria}
                  margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="fecha"
                    tickFormatter={formatFechaCorta}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelFormatter={(l) => formatFechaCorta(String(l))}
                    formatter={(value, name) => [
                      value,
                      name === "paciente" ? "Paciente" : name === "bot" ? "Bot" : "Agente",
                    ]}
                  />
                  <Legend
                    iconType="square"
                    iconSize={10}
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value: string) =>
                      value === "paciente" ? "Paciente" : value === "bot" ? "Bot" : "Agente"
                    }
                  />
                  <Bar dataKey="paciente" fill={COLOR_PACIENTE} radius={[2, 2, 0, 0]} stackId="s" />
                  <Bar dataKey="bot"      fill={COLOR_BOT}      radius={[2, 2, 0, 0]} stackId="s" />
                  <Bar dataKey="agente"   fill={COLOR_AGENTE}   radius={[2, 2, 0, 0]} stackId="s" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              Tipo de resolucion
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!montado ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                Cargando grafica...
              </div>
            ) : dataResolucion.length === 0 ? (
              <GraficaVacia altura={220} />
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={164}>
                  <PieChart>
                    <Pie
                      data={dataResolucion}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={76}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {dataResolucion.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1.5 w-full mt-2">
                  {dataResolucion.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: d.color }}
                        />
                        <span className="text-muted-foreground">{d.name}</span>
                      </div>
                      <span className="font-medium tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fila 2: Intenciones + Dona sentimiento */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              Distribucion de intenciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!montado ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                Cargando grafica...
              </div>
            ) : datos.intenciones.length === 0 ? (
              <GraficaVacia altura={200} />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={datos.intenciones}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="total"
                    fill={COLOR_INTENCION}
                    radius={[0, 2, 2, 0]}
                    name="Conversaciones"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              Sentimiento del paciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!montado ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                Cargando grafica...
              </div>
            ) : dataSentimiento.length === 0 ? (
              <GraficaVacia altura={200} />
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={144}>
                  <PieChart>
                    <Pie
                      data={dataSentimiento}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={64}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {dataSentimiento.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1.5 w-full mt-2">
                  {dataSentimiento.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: d.color }}
                        />
                        <span className="text-muted-foreground">{d.name}</span>
                      </div>
                      <span className="font-medium tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
