"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { crearCita, actualizarCita, eliminarCita, enviarRecordatorio } from "./actions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "sonner"
import { ChevronRight, Clock, SquarePen, Trash2 } from "lucide-react"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Paciente = { id: string; nombre: string; channel: string; channel_user_id: string | null }
type Servicio = { id: string; nombre: string; precio: number; duracion_min: number | null }
type Doctor = { id: string; nombre: string }

type Cita = {
  id: string
  patient_id: string | null
  service_id: string | null
  doctor_id: string | null
  fecha_hora: string
  status: string
  costo: number | null
  duracion_min: number | null
  recordatorio_enviado_at: string | null
  notas: string | null
  patients: Paciente | null
  services: Servicio | null
  doctors: Doctor | null
}

type FormCita = {
  patient_id: string
  service_id: string
  doctor_id: string
  fecha_hora: string
  status: string
  duracion_min: string
  notas: string
}

interface Props {
  citas: Cita[]
  pacientes: Paciente[]
  servicios: Servicio[]
  doctores: Doctor[]
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const FORM_INICIAL: FormCita = {
  patient_id: "",
  service_id: "",
  doctor_id: "",
  fecha_hora: "",
  status: "programada",
  duracion_min: "",
  notas: "",
}

const STATUS_LABELS: Record<string, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  completada: "Completada",
  no_asistio: "No asistio",
}

const ESTADO_ESTILO: Record<string, string> = {
  programada: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  confirmada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  cancelada: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  completada: "bg-muted text-muted-foreground",
  no_asistio: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFecha(raw: string): string {
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

function esProxima(fechaHora: string): boolean {
  return new Date(fechaHora) > new Date()
}

function isoAInputDatetime(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(" ", "T")
    .slice(0, 16)
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function CitasClient({ citas: citasIniciales, pacientes, servicios, doctores }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [citas, setCitas] = useState<Cita[]>(citasIniciales)
  const [formOpen, setFormOpen] = useState(false)
  const [eliminarId, setEliminarId] = useState<string | null>(null)
  const [citaEditando, setCitaEditando] = useState<Cita | null>(null)
  const [form, setForm] = useState<FormCita>(FORM_INICIAL)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [citaDrawer, setCitaDrawer] = useState<Cita | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCitas(citasIniciales)
  }, [citasIniciales])

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // -------------------------------------------------------------------------
  // Handlers — formulario
  // -------------------------------------------------------------------------

  function abrirFormNuevo() {
    setCitaEditando(null)
    setForm(FORM_INICIAL)
    setFormOpen(true)
  }

  function abrirFormEdicion(cita: Cita) {
    setCitaEditando(cita)
    setForm({
      patient_id: cita.patient_id ?? "",
      service_id: cita.service_id ?? "",
      doctor_id: cita.doctor_id ?? "",
      fecha_hora: isoAInputDatetime(cita.fecha_hora),
      status: cita.status,
      duracion_min: cita.duracion_min != null ? String(cita.duracion_min) : "",
      notas: cita.notas ?? "",
    })
    setFormOpen(true)
  }

  function actualizarCampo<K extends keyof FormCita>(key: K, value: FormCita[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleGuardar() {
    if (!form.patient_id) {
      toast.error("Selecciona un paciente")
      return
    }
    if (!form.fecha_hora) {
      toast.error("Ingresa la fecha y hora de la cita")
      return
    }

    startTransition(async () => {
      try {
        if (citaEditando) {
          await actualizarCita(citaEditando.id, form)
          toast.success("Cita actualizada correctamente")
        } else {
          await crearCita(form)
          toast.success("Cita creada correctamente")
        }
        setFormOpen(false)
        router.refresh()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Error al guardar la cita")
      }
    })
  }

  // -------------------------------------------------------------------------
  // Handlers — eliminar
  // -------------------------------------------------------------------------

  function handleConfirmarEliminar() {
    if (!eliminarId) return
    const id = eliminarId
    setEliminarId(null)
    startTransition(async () => {
      try {
        await eliminarCita(id)
        setCitas((prev) => prev.filter((c) => c.id !== id))
        toast.success("Cita eliminada")
        router.refresh()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Error al eliminar la cita")
      }
    })
  }

  // -------------------------------------------------------------------------
  // Handlers — recordatorio
  // -------------------------------------------------------------------------

  async function handleEnviarRecordatorio(cita: Cita) {
    if (!cita.patients?.channel_user_id) {
      toast.error("El paciente no tiene ID de canal configurado")
      return
    }
    setEnviandoId(cita.id)
    try {
      await enviarRecordatorio(cita.id)
      toast.success("Recordatorio enviado correctamente")
      setCitas((prev) =>
        prev.map((c) =>
          c.id === cita.id
            ? { ...c, recordatorio_enviado_at: new Date().toISOString() }
            : c
        )
      )
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al enviar el recordatorio")
    } finally {
      setEnviandoId(null)
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-6 pb-20 md:pb-5 space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Citas</h1>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-muted-foreground">
            {citas.length} registros
          </span>
          <Button size="sm" onClick={abrirFormNuevo}>
            Nueva cita
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Vista mobile — lista de filas                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="md:hidden">
        {citas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin citas registradas.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            {citas.map((cita) => (
              <button
                key={cita.id}
                onClick={() => setCitaDrawer(cita)}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 active:bg-muted/40 transition-colors text-left"
              >
                {/* Info izquierda */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {cita.patients?.nombre ?? "Sin paciente"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[cita.services?.nombre, cita.doctors?.nombre]
                      .filter(Boolean)
                      .join(" · ") || "Sin servicio"}
                  </p>
                </div>

                {/* Fecha + estado + chevron */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatFecha(cita.fecha_hora)}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                        ESTADO_ESTILO[cita.status] ??
                          "bg-muted text-muted-foreground"
                      )}
                    >
                      {STATUS_LABELS[cita.status] ?? cita.status}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Vista desktop — tabla                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden md:block rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {[
                "Paciente",
                "Servicio",
                "Doctor",
                "Fecha y hora",
                "Estado",
                "Recordatorio",
                "Acciones",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {citas.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Sin citas registradas.
                </td>
              </tr>
            )}
            {citas.map((cita) => (
              <tr
                key={cita.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                <td className="px-4 py-3 font-medium">
                  {cita.patients?.nombre ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {cita.services?.nombre ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {cita.doctors?.nombre ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">
                  {formatFecha(cita.fecha_hora)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      ESTADO_ESTILO[cita.status] ?? "bg-muted text-muted-foreground"
                    )}
                  >
                    {STATUS_LABELS[cita.status] ?? cita.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {cita.recordatorio_enviado_at ? (
                    <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                      Enviado
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Pendiente</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => abrirFormEdicion(cita)}
                      title="Editar cita"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <SquarePen size={15} />
                    </button>
                    <button
                      onClick={() => handleEnviarRecordatorio(cita)}
                      disabled={enviandoId === cita.id || !cita.patients?.channel_user_id}
                      title={
                        !cita.patients?.channel_user_id
                          ? "Sin ID de canal configurado"
                          : "Enviar recordatorio"
                      }
                      className={cn(
                        "p-1.5 rounded-md transition-colors",
                        cita.patients?.channel_user_id
                          ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          : "text-muted-foreground/30 cursor-not-allowed"
                      )}
                    >
                      <Clock
                        size={15}
                        className={enviandoId === cita.id ? "animate-spin" : ""}
                      />
                    </button>
                    <button
                      onClick={() => setEliminarId(cita.id)}
                      title="Eliminar cita"
                      className="p-1.5 rounded-md text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
              {citaDrawer?.services?.nombre ?? "Cita sin servicio"}
            </DrawerTitle>
            {citaDrawer && (
              <div className="flex items-center justify-between gap-2 mt-1.5">
                {/* Badge de estado */}
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    ESTADO_ESTILO[citaDrawer.status] ??
                      "bg-muted text-muted-foreground"
                  )}
                >
                  {STATUS_LABELS[citaDrawer.status] ?? citaDrawer.status}
                </span>

                {/* Iconos de accion */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => {
                      abrirFormEdicion(citaDrawer)
                      setCitaDrawer(null)
                    }}
                    title="Editar cita"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <SquarePen size={16} />
                  </button>
                  <button
                    onClick={() => {
                      handleEnviarRecordatorio(citaDrawer)
                      setCitaDrawer(null)
                    }}
                    disabled={
                      !citaDrawer.patients?.channel_user_id ||
                      !!citaDrawer.recordatorio_enviado_at ||
                      enviandoId === citaDrawer.id
                    }
                    title={
                      !citaDrawer.patients?.channel_user_id
                        ? "Sin ID de canal configurado"
                        : citaDrawer.recordatorio_enviado_at
                        ? "Recordatorio ya enviado"
                        : "Enviar recordatorio"
                    }
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      citaDrawer.patients?.channel_user_id &&
                        !citaDrawer.recordatorio_enviado_at
                        ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        : "text-muted-foreground/30 cursor-not-allowed"
                    )}
                  >
                    <Clock
                      size={16}
                      className={
                        enviandoId === citaDrawer.id ? "animate-spin" : ""
                      }
                    />
                  </button>
                  <button
                    onClick={() => {
                      setEliminarId(citaDrawer.id)
                      setCitaDrawer(null)
                    }}
                    title="Eliminar cita"
                    className="p-1.5 rounded-md text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </DrawerHeader>

          {citaDrawer && (
            <div className="px-4 py-4 pb-8 space-y-4">
              {/* Datos de la cita */}
              <div className="space-y-2.5 text-sm">
                {/* Paciente */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Paciente</span>
                  <span className="font-medium">
                    {citaDrawer.patients?.nombre ?? "—"}
                  </span>
                </div>

                {/* Fecha y hora */}
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
                {citaDrawer.doctors && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Doctor</span>
                    <span className="font-medium">
                      {citaDrawer.doctors.nombre}
                    </span>
                  </div>
                )}

                {/* Duracion */}
                {citaDrawer.duracion_min != null && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Duracion</span>
                    <span className="font-medium tabular-nums">
                      {citaDrawer.duracion_min} min
                    </span>
                  </div>
                )}

                {/* Recordatorio */}
                {citaDrawer.recordatorio_enviado_at && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Recordatorio</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Enviado
                    </span>
                  </div>
                )}
              </div>

              {/* Notas */}
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

      {/* ------------------------------------------------------------------ */}
      {/* Formulario — campos compartidos mobile y desktop                   */}
      {/* ------------------------------------------------------------------ */}
      {(() => {
        const camposForm = (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
            {/* Paciente */}
            <div className="space-y-1.5">
              <Label>Paciente</Label>
              <Select
                value={form.patient_id}
                onValueChange={(v) => actualizarCampo("patient_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un paciente" />
                </SelectTrigger>
                <SelectContent>
                  {pacientes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Servicio */}
            <div className="space-y-1.5">
              <Label>Servicio</Label>
              <Select
                value={form.service_id}
                onValueChange={(v) => {
                  const servicio = servicios.find((s) => s.id === v)
                  setForm((prev) => ({
                    ...prev,
                    service_id: v,
                    duracion_min:
                      servicio?.duracion_min != null
                        ? String(servicio.duracion_min)
                        : prev.duracion_min,
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un servicio" />
                </SelectTrigger>
                <SelectContent>
                  {servicios.map((s) => (
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

            {/* Doctor */}
            <div className="space-y-1.5">
              <Label>Doctor</Label>
              <Select
                value={form.doctor_id}
                onValueChange={(v) => actualizarCampo("doctor_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctores.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha y hora */}
            <div className="space-y-1.5">
              <Label>Fecha y hora</Label>
              <Input
                type="datetime-local"
                value={form.fecha_hora}
                onChange={(e) => actualizarCampo("fecha_hora", e.target.value)}
              />
            </div>

            {/* Estado */}
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select
                value={form.status}
                onValueChange={(v) => actualizarCampo("status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duracion */}
            <div className="space-y-1.5">
              <Label>Duracion (min)</Label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="Ej. 60"
                value={form.duracion_min}
                onChange={(e) =>
                  actualizarCampo("duracion_min", e.target.value)
                }
              />
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea
                placeholder="Observaciones adicionales..."
                value={form.notas}
                onChange={(e) => actualizarCampo("notas", e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        )

        const botonesForm = (
          <div className="flex gap-2 w-full">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setFormOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleGuardar}
              disabled={isPending}
            >
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        )

        const tituloForm = citaEditando ? "Editar cita" : "Nueva cita"

        return (
          <>
            {/* Drawer inferior — solo movil */}
            <Drawer
              open={formOpen && !isDesktop}
              onOpenChange={(o) => { if (!o) setFormOpen(false) }}
              shouldScaleBackground
            >
              <DrawerContent style={{ height: "92svh" }}>
                <DrawerHeader className="flex-shrink-0 border-b border-border pb-3 text-left">
                  <DrawerTitle>{tituloForm}</DrawerTitle>
                </DrawerHeader>
                {camposForm}
                <DrawerFooter className="flex-shrink-0 border-t border-border pt-3">
                  {botonesForm}
                </DrawerFooter>
              </DrawerContent>
            </Drawer>

            {/* Sheet lateral derecho — solo escritorio */}
            <Sheet
              open={formOpen && isDesktop}
              onOpenChange={(o) => { if (!o) setFormOpen(false) }}
            >
              <SheetContent
                side="right"
                className="flex flex-col p-0 w-[480px] sm:max-w-[480px] rounded-xl"
                showCloseButton={false}
                style={{
                  top: "10px",
                  bottom: "10px",
                  right: "10px",
                  height: "calc(100svh - 20px)",
                }}
              >
                <SheetHeader className="shrink-0 border-b border-border px-6 py-4">
                  <SheetTitle>{tituloForm}</SheetTitle>
                </SheetHeader>
                {camposForm}
                <SheetFooter className="shrink-0 border-t border-border px-4 py-4">
                  {botonesForm}
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </>
        )
      })()}

      {/* Drawer — confirmar eliminacion */}
      <Drawer
        open={eliminarId !== null}
        onOpenChange={(o) => !o && setEliminarId(null)}
        shouldScaleBackground
      >
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Eliminar cita</DrawerTitle>
          </DrawerHeader>
          <p className="px-4 pb-2 text-sm text-muted-foreground">
            Esta accion no se puede deshacer. La cita sera eliminada
            permanentemente.
          </p>
          <DrawerFooter className="flex-shrink-0 border-t border-border pt-3 flex-row gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setEliminarId(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleConfirmarEliminar}
              disabled={isPending}
            >
              {isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
