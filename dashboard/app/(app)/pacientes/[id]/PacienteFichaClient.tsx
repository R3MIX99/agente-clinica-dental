"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  agregarNotaClinica,
  actualizarDoctoresFicha,
  agendarCitaFicha,
} from "./actions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { toast } from "sonner"
import {
  ArrowLeft,
  CalendarPlus,
  ChevronRight,
  FileText,
  FlaskConical,
  Calendar,
  SquarePen,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Paciente = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  channel: string
  channel_user_id: string | null
  notas: string | null
  laboratorio: string | null
  tiempo_cita_min: number | null
  fecha_ingreso: string | null
  created_at: string
}

type DoctorAsignado = {
  id: string
  nombre: string
  especialidades: string[] | null
  email: string | null
  orden: number
}

type Cita = {
  id: string
  fecha_hora: string
  status: string
  costo: number | null
  notas: string | null
  servicio: { id: string; nombre: string; duracion_min: number | null } | null
  doctor: { id: string; nombre: string } | null
}

type Estudio = {
  id: string
  nombre: string
  descripcion: string | null
  status: string
  fecha_indicacion: string | null
  created_at: string | null
}

type NotaClinica = {
  id: string
  contenido: string
  created_at: string
}

type DoctorRef = { id: string; nombre: string }
type ServicioRef = { id: string; nombre: string; precio: number }

interface Props {
  paciente: Paciente
  doctoresAsignados: DoctorAsignado[]
  citas: Cita[]
  estudios: Estudio[]
  notas: NotaClinica[]
  todosDoctores: DoctorRef[]
  todosServicios: ServicioRef[]
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const CANAL_LABEL: Record<string, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
}

const STATUS_CITA_LABELS: Record<string, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  completada: "Completada",
  no_asistio: "No asistio",
}

const STATUS_CITA_ESTILO: Record<string, string> = {
  programada:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  confirmada:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  cancelada: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  completada: "bg-muted text-muted-foreground",
  no_asistio:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
}

const STATUS_ESTUDIO_ESTILO: Record<string, string> = {
  pendiente:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  completado:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelado: "bg-muted text-muted-foreground",
}

const FORM_CITA_INICIAL = {
  service_id: "",
  fecha_hora: "",
  status: "programada",
  costo: "",
  notas: "",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFechaCompleta(raw: string): string {
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatFechaCorta(raw: string): string {
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatFechaIngreso(raw: string): string {
  // fecha_ingreso es "YYYY-MM-DD" sin hora; se interpreta como fecha local
  const [y, m, d] = raw.split("-").map(Number)
  const fecha = new Date(y, m - 1, d)
  return fecha.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function esProxima(fechaHora: string): boolean {
  return new Date(fechaHora) > new Date()
}

// ---------------------------------------------------------------------------
// Timeline — tipos y construccion
// ---------------------------------------------------------------------------

type EventoTimeline =
  | { tipo: "cita"; fecha: string; key: string; data: Cita }
  | { tipo: "estudio"; fecha: string; key: string; data: Estudio }
  | { tipo: "nota"; fecha: string; key: string; data: NotaClinica }

function buildTimeline(
  citas: Cita[],
  estudios: Estudio[],
  notas: NotaClinica[]
): EventoTimeline[] {
  const eventos: EventoTimeline[] = [
    ...citas.map((c) => ({
      tipo: "cita" as const,
      fecha: c.fecha_hora,
      key: `cita-${c.id}`,
      data: c,
    })),
    ...estudios.map((e) => ({
      tipo: "estudio" as const,
      fecha: e.fecha_indicacion ?? e.created_at ?? new Date(0).toISOString(),
      key: `estudio-${e.id}`,
      data: e,
    })),
    ...notas.map((n) => ({
      tipo: "nota" as const,
      fecha: n.created_at,
      key: `nota-${n.id}`,
      data: n,
    })),
  ]
  return eventos.sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  )
}

// ---------------------------------------------------------------------------
// Subcomponente — evento del timeline
// ---------------------------------------------------------------------------

function ItemTimeline({
  evento,
  isLast,
}: {
  evento: EventoTimeline
  isLast: boolean
}) {
  const iconoClase = cn(
    "flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 mt-0.5",
    evento.tipo === "cita" &&
      "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    evento.tipo === "estudio" &&
      "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    evento.tipo === "nota" &&
      "bg-muted text-muted-foreground"
  )

  return (
    <div className="flex gap-4">
      {/* Icono + linea vertical */}
      <div className="flex flex-col items-center">
        <div className={iconoClase}>
          {evento.tipo === "cita" && <Calendar size={14} />}
          {evento.tipo === "estudio" && <FlaskConical size={14} />}
          {evento.tipo === "nota" && <FileText size={14} />}
        </div>
        {!isLast && (
          <div className="mt-1 flex-1 w-px bg-border min-h-[24px]" />
        )}
      </div>

      {/* Contenido */}
      <div className={cn("flex-1 min-w-0", !isLast && "pb-5")}>
        <p className="text-[11px] text-muted-foreground mb-0.5">
          {formatFechaCorta(evento.fecha)}
        </p>

        {evento.tipo === "cita" && (
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {evento.data.servicio?.nombre ?? "Cita sin servicio"}
            </p>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                  STATUS_CITA_ESTILO[evento.data.status] ??
                    "bg-muted text-muted-foreground"
                )}
              >
                {STATUS_CITA_LABELS[evento.data.status] ?? evento.data.status}
              </span>
              {evento.data.doctor && (
                <span className="text-xs text-muted-foreground">
                  {evento.data.doctor.nombre}
                </span>
              )}
            </div>
          </div>
        )}

        {evento.tipo === "estudio" && (
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{evento.data.nombre}</p>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                  STATUS_ESTUDIO_ESTILO[evento.data.status] ??
                    "bg-muted text-muted-foreground"
                )}
              >
                {evento.data.status}
              </span>
              {evento.data.descripcion && (
                <span className="text-xs text-muted-foreground truncate max-w-[240px]">
                  {evento.data.descripcion}
                </span>
              )}
            </div>
          </div>
        )}

        {evento.tipo === "nota" && (
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {evento.data.contenido}
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function PacienteFichaClient({
  paciente,
  doctoresAsignados,
  citas,
  estudios,
  notas,
  todosDoctores,
  todosServicios,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Dialog — agendar cita
  const [agendarOpen, setAgendarOpen] = useState(false)
  const [formCita, setFormCita] = useState(FORM_CITA_INICIAL)

  // Dialog — editar doctores
  const [editarDoctoresOpen, setEditarDoctoresOpen] = useState(false)
  const [formDoctores, setFormDoctores] = useState({
    principal: doctoresAsignados[0]?.id ?? "",
    respaldo1: doctoresAsignados[1]?.id ?? "",
    respaldo2: doctoresAsignados[2]?.id ?? "",
  })

  // Nota clinica
  const [notaTexto, setNotaTexto] = useState("")

  // Drawer — detalle de cita (mobile)
  const [citaDrawer, setCitaDrawer] = useState<Cita | null>(null)

  // ---------------------------------------------------------------------------
  // Handlers — agendar cita
  // ---------------------------------------------------------------------------

  function actualizarCampoCita<K extends keyof typeof FORM_CITA_INICIAL>(
    key: K,
    value: string
  ) {
    setFormCita((prev) => ({ ...prev, [key]: value }))
  }

  function handleAgendarCita() {
    if (!formCita.fecha_hora) {
      toast.error("Ingresa la fecha y hora de la cita")
      return
    }
    startTransition(async () => {
      try {
        await agendarCitaFicha(paciente.id, formCita)
        toast.success("Cita agendada correctamente")
        setAgendarOpen(false)
        setFormCita(FORM_CITA_INICIAL)
        router.refresh()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Error al agendar la cita")
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Handlers — editar doctores
  // ---------------------------------------------------------------------------

  function abrirEditarDoctores() {
    setFormDoctores({
      principal: doctoresAsignados[0]?.id ?? "",
      respaldo1: doctoresAsignados[1]?.id ?? "",
      respaldo2: doctoresAsignados[2]?.id ?? "",
    })
    setEditarDoctoresOpen(true)
  }

  function handleGuardarDoctores() {
    const doctoresOrdenados = [
      formDoctores.principal,
      formDoctores.respaldo1,
      formDoctores.respaldo2,
    ].filter(Boolean)

    startTransition(async () => {
      try {
        await actualizarDoctoresFicha(paciente.id, doctoresOrdenados)
        toast.success("Asignacion actualizada correctamente")
        setEditarDoctoresOpen(false)
        router.refresh()
      } catch (e: unknown) {
        toast.error(
          e instanceof Error ? e.message : "Error al actualizar la asignacion"
        )
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Handlers — nota clinica
  // ---------------------------------------------------------------------------

  function handleAgregarNota() {
    if (!notaTexto.trim()) {
      toast.error("Escribe el contenido de la nota")
      return
    }
    startTransition(async () => {
      try {
        await agregarNotaClinica(paciente.id, notaTexto)
        toast.success("Nota agregada correctamente")
        setNotaTexto("")
        router.refresh()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Error al agregar la nota")
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Datos derivados
  // ---------------------------------------------------------------------------

  const doctorPrincipal = doctoresAsignados[0] ?? null
  const doctoresRespaldo = doctoresAsignados.slice(1)
  const timeline = buildTimeline(citas, estudios, notas)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 pb-20 md:pb-6 space-y-6 max-w-5xl mx-auto">
      {/* Enlace de regreso */}
      <Link
        href="/pacientes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={15} />
        Regresar a pacientes
      </Link>

      {/* ------------------------------------------------------------------ */}
      {/* Encabezado                                                           */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold">{paciente.nombre}</h1>
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {CANAL_LABEL[paciente.channel] ?? paciente.channel}
                </span>
              </div>

              <div className="space-y-1 text-sm text-muted-foreground">
                {paciente.telefono && (
                  <p>
                    <span className="font-medium text-foreground/70">
                      Telefono:{" "}
                    </span>
                    {paciente.telefono}
                  </p>
                )}
                {paciente.email && (
                  <p>
                    <span className="font-medium text-foreground/70">
                      Email:{" "}
                    </span>
                    {paciente.email}
                  </p>
                )}
                {paciente.fecha_ingreso && (
                  <p>
                    <span className="font-medium text-foreground/70">
                      Fecha de ingreso:{" "}
                    </span>
                    {formatFechaIngreso(paciente.fecha_ingreso)}
                  </p>
                )}
                {paciente.laboratorio && (
                  <p>
                    <span className="font-medium text-foreground/70">
                      Laboratorio:{" "}
                    </span>
                    {paciente.laboratorio}
                  </p>
                )}
                {paciente.tiempo_cita_min != null && (
                  <p>
                    <span className="font-medium text-foreground/70">
                      Duracion de cita:{" "}
                    </span>
                    {paciente.tiempo_cita_min} min
                  </p>
                )}
              </div>
            </div>

            <Button
              onClick={() => {
                setFormCita(FORM_CITA_INICIAL)
                setAgendarOpen(true)
              }}
              className="sm:flex-shrink-0"
            >
              <CalendarPlus size={16} className="mr-2" />
              Agendar cita
            </Button>
          </div>

          {paciente.notas && (
            <>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground italic">
                {paciente.notas}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Tabs                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Tabs defaultValue="citas">
        <TabsList>
          <TabsTrigger value="medicos">Medicos</TabsTrigger>
          <TabsTrigger value="citas">
            Citas{citas.length > 0 ? ` (${citas.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="trayectoria">Trayectoria</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        {/* Tab — Medicos                                                      */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="medicos" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-medium">
                Asignacion de medicos
              </CardTitle>
              {todosDoctores.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={abrirEditarDoctores}
                  className="h-7 text-xs gap-1.5"
                >
                  <SquarePen size={13} />
                  Editar
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!doctorPrincipal && doctoresRespaldo.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sin doctores asignados.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Doctor principal */}
                  {doctorPrincipal && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Doctor principal
                      </p>
                      <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            {doctorPrincipal.nombre}
                          </p>
                          {doctorPrincipal.especialidades &&
                            doctorPrincipal.especialidades.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {doctorPrincipal.especialidades.map((esp) => (
                                  <span
                                    key={esp}
                                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                                  >
                                    {esp}
                                  </span>
                                ))}
                              </div>
                            )}
                          {doctorPrincipal.email && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {doctorPrincipal.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Doctores de respaldo */}
                  {doctoresRespaldo.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Doctores de respaldo
                      </p>
                      <div className="space-y-2">
                        {doctoresRespaldo.map((doc, idx) => (
                          <div
                            key={doc.id}
                            className="flex items-start gap-3 rounded-lg border border-border p-3"
                          >
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">
                                {doc.nombre}
                              </p>
                              {doc.especialidades &&
                                doc.especialidades.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {doc.especialidades.map((esp) => (
                                      <span
                                        key={esp}
                                        className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                                      >
                                        {esp}
                                      </span>
                                    ))}
                                  </div>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Tab — Citas                                                        */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="citas" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">
                Historial de citas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {citas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center px-6">
                  Sin citas registradas para este paciente.
                </p>
              ) : (
                <>
                  {/* Mobile — lista cliqueables */}
                  <div className="md:hidden px-4 pt-2 pb-4 space-y-2">
                    {citas.map((cita) => {
                      const proxima = esProxima(cita.fecha_hora)
                      return (
                        <button
                          key={cita.id}
                          onClick={() => setCitaDrawer(cita)}
                          className={cn(
                            "w-full text-left rounded-lg border p-3 space-y-1.5 transition-colors active:bg-muted/40",
                            proxima
                              ? "border-blue-200 bg-blue-50/40 dark:border-blue-800/40 dark:bg-blue-950/20"
                              : "border-border hover:bg-muted/20"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-tight">
                              {cita.servicio?.nombre ?? "Cita sin servicio"}
                            </p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                                  STATUS_CITA_ESTILO[cita.status] ??
                                    "bg-muted text-muted-foreground"
                                )}
                              >
                                {STATUS_CITA_LABELS[cita.status] ?? cita.status}
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatFechaCompleta(cita.fecha_hora)}
                            {proxima && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                proxima
                              </span>
                            )}
                          </p>
                          {cita.doctor && (
                            <p className="text-xs text-muted-foreground">
                              {cita.doctor.nombre}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Desktop — tabla */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {[
                            "Servicio",
                            "Doctor",
                            "Fecha y hora",
                            "Costo",
                            "Duracion",
                            "Estado",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {citas.map((cita) => {
                          const proxima = esProxima(cita.fecha_hora)
                          return (
                            <tr
                              key={cita.id}
                              className={cn(
                                "border-b border-border last:border-0 transition-colors",
                                proxima
                                  ? "bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/30"
                                  : "hover:bg-muted/30"
                              )}
                            >
                              <td className="px-4 py-3 font-medium whitespace-nowrap">
                                {cita.servicio?.nombre ?? (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                {cita.doctor?.nombre ?? "—"}
                              </td>
                              <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                                <span
                                  className={
                                    proxima
                                      ? "font-medium"
                                      : "text-muted-foreground"
                                  }
                                >
                                  {formatFechaCompleta(cita.fecha_hora)}
                                </span>
                                {proxima && (
                                  <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                    proxima
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 tabular-nums text-muted-foreground">
                                {cita.costo != null
                                  ? `$${Number(cita.costo).toLocaleString(
                                      "es-MX",
                                      { minimumFractionDigits: 0 }
                                    )}`
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                {cita.servicio?.duracion_min != null
                                  ? `${cita.servicio.duracion_min} min`
                                  : paciente.tiempo_cita_min != null
                                  ? `${paciente.tiempo_cita_min} min`
                                  : "—"}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                                    STATUS_CITA_ESTILO[cita.status] ??
                                      "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {STATUS_CITA_LABELS[cita.status] ??
                                    cita.status}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Tab — Trayectoria                                                  */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="trayectoria" className="mt-4 space-y-4">
          {/* Agregar nota clinica */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">
                Agregar nota clinica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Observaciones clinicas, indicaciones, evolucion del paciente..."
                value={notaTexto}
                onChange={(e) => setNotaTexto(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <Button
                size="sm"
                onClick={handleAgregarNota}
                disabled={isPending || !notaTexto.trim()}
              >
                {isPending ? "Guardando..." : "Agregar nota"}
              </Button>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">
                Trayectoria del paciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sin eventos registrados. Las citas, estudios y notas clinicas
                  apareceran aqui.
                </p>
              ) : (
                <div>
                  {timeline.map((evento, idx) => (
                    <ItemTimeline
                      key={evento.key}
                      evento={evento}
                      isLast={idx === timeline.length - 1}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog — Agendar cita                                                */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={agendarOpen} onOpenChange={setAgendarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar cita</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Paciente</Label>
              <p className="text-sm font-medium px-3 py-2 rounded-md bg-muted">
                {paciente.nombre}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Servicio</Label>
              <Select
                value={formCita.service_id || "_none"}
                onValueChange={(v) =>
                  actualizarCampoCita("service_id", v === "_none" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin servicio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin servicio</SelectItem>
                  {todosServicios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                      {s.precio != null && (
                        <span className="ml-2 text-muted-foreground">
                          — ${Number(s.precio).toLocaleString("es-MX")}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                Fecha y hora <span className="text-red-500">*</span>
              </Label>
              <Input
                type="datetime-local"
                value={formCita.fecha_hora}
                onChange={(e) =>
                  actualizarCampoCita("fecha_hora", e.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select
                value={formCita.status}
                onValueChange={(v) => actualizarCampoCita("status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CITA_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Costo (MXN)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formCita.costo}
                onChange={(e) => actualizarCampoCita("costo", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea
                placeholder="Observaciones adicionales..."
                value={formCita.notas}
                onChange={(e) => actualizarCampoCita("notas", e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAgendarOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAgendarCita} disabled={isPending}>
              {isPending ? "Guardando..." : "Agendar cita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog — Editar asignacion de doctores                               */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={editarDoctoresOpen} onOpenChange={setEditarDoctoresOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Asignacion de medicos</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Doctor principal</Label>
              <Select
                value={formDoctores.principal || "_none"}
                onValueChange={(v) =>
                  setFormDoctores((prev) => ({
                    ...prev,
                    principal: v === "_none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin asignar</SelectItem>
                  {todosDoctores.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Respaldo 1</Label>
              <Select
                value={formDoctores.respaldo1 || "_none"}
                onValueChange={(v) =>
                  setFormDoctores((prev) => ({
                    ...prev,
                    respaldo1: v === "_none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin asignar</SelectItem>
                  {todosDoctores.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Respaldo 2</Label>
              <Select
                value={formDoctores.respaldo2 || "_none"}
                onValueChange={(v) =>
                  setFormDoctores((prev) => ({
                    ...prev,
                    respaldo2: v === "_none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin asignar</SelectItem>
                  {todosDoctores.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditarDoctoresOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleGuardarDoctores} disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Drawer — detalle de cita (mobile)                                    */}
      {/* ------------------------------------------------------------------ */}
      <Drawer
        open={citaDrawer !== null}
        onOpenChange={(o) => {
          if (!o) setCitaDrawer(null)
        }}
        shouldScaleBackground
      >
        <DrawerContent>
          <DrawerHeader className="flex-shrink-0 border-b border-border pb-3 text-left">
            <DrawerTitle>
              {citaDrawer?.servicio?.nombre ?? "Cita sin servicio"}
            </DrawerTitle>
            {citaDrawer && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1.5",
                  STATUS_CITA_ESTILO[citaDrawer.status] ??
                    "bg-muted text-muted-foreground"
                )}
              >
                {STATUS_CITA_LABELS[citaDrawer.status] ?? citaDrawer.status}
              </span>
            )}
          </DrawerHeader>

          {citaDrawer && (
            <div className="px-4 py-4 pb-8 space-y-3">
              <div className="space-y-2.5 text-sm">
                {/* Fecha */}
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground flex-shrink-0">
                    Fecha y hora
                  </span>
                  <span className="font-medium text-right">
                    {formatFechaCompleta(citaDrawer.fecha_hora)}
                    {esProxima(citaDrawer.fecha_hora) && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 align-middle">
                        proxima
                      </span>
                    )}
                  </span>
                </div>

                {/* Doctor */}
                {citaDrawer.doctor && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Doctor</span>
                    <span className="font-medium">
                      {citaDrawer.doctor.nombre}
                    </span>
                  </div>
                )}

                {/* Costo */}
                {citaDrawer.costo != null && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Costo</span>
                    <span className="font-medium tabular-nums">
                      $
                      {Number(citaDrawer.costo).toLocaleString("es-MX", {
                        minimumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                )}

                {/* Duracion */}
                {(citaDrawer.servicio?.duracion_min != null ||
                  paciente.tiempo_cita_min != null) && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Duracion</span>
                    <span className="font-medium tabular-nums">
                      {citaDrawer.servicio?.duracion_min ??
                        paciente.tiempo_cita_min}{" "}
                      min
                    </span>
                  </div>
                )}
              </div>

              {/* Notas de la cita */}
              {citaDrawer.notas && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground mb-1.5">Notas</p>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {citaDrawer.notas}
                  </p>
                </div>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
