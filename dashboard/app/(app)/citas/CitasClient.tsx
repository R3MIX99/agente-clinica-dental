"use client"

import { useState, useEffect, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { crearCita, actualizarCita, eliminarCita, enviarRecordatorio, terminarSerie, editarSerie, cerrarDia, reabrirDia, marcarPago, enviarDatosPago, type DatosEditarSerie } from "./actions"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { ChevronRight, Clock, SquarePen, Trash2, Repeat, CircleStop, CalendarRange, CalendarX, RotateCcw, BadgeDollarSign, Send } from "lucide-react"

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
  estado_pago: string
  costo: number | null
  duracion_min: number | null
  recordatorio_enviado_at: string | null
  notas: string | null
  serie_id: string | null
  recurrencia_tipo: string | null
  recurrencia_fin: string | null
  patients: Paciente | null
  services: Servicio | null
  doctors: Doctor | null
}

type Bloqueo = {
  id: string
  fecha: string
  motivo: string | null
  service_id: string | null
  servicio_nombre: string | null
}

type FormCita = {
  patient_id: string
  service_id: string
  doctor_id: string
  fecha_hora: string
  status: string
  duracion_min: string
  notas: string
  // Recurrencia (solo aplica en creacion)
  recurrencia_tipo: "" | "mensual"
  recurrencia_modo: "indefinido" | "n_meses" | "fecha"
  recurrencia_meses: string
  recurrencia_fin: string
}

interface Props {
  citas: Cita[]
  pacientes: Paciente[]
  servicios: Servicio[]
  doctores: Doctor[]
  bloqueos: Bloqueo[]
  esDoctor?: boolean
  doctorId?: string | null
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
  recurrencia_tipo:  "",
  recurrencia_modo:  "indefinido",
  recurrencia_meses: "3",
  recurrencia_fin:   "",
}

const STATUS_LABELS: Record<string, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  completada: "Completada",
  no_asistio: "No asistió",
  por_reagendar: "Por reagendar",
}

const ESTADO_ESTILO: Record<string, string> = {
  programada: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  confirmada: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400",
  cancelada: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  completada: "bg-muted text-muted-foreground",
  no_asistio: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  por_reagendar: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
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

// Fecha (YYYY-MM-DD) a texto corto, sin problemas de zona horaria
function formatearFechaCorta(fecha: string): string {
  const d = new Date(fecha + "T12:00:00")
  if (isNaN(d.getTime())) return fecha
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })
}

// Boton de accion accesible (area de toque grande) con tooltip al mantener/hover
function AccionBtn({
  label, onClick, children, disabled, tono,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  tono?: "azul" | "verde" | "rojo"
}) {
  const tonoClase =
    tono === "azul"
      ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
      : tono === "verde"
      ? "text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
      : tono === "rojo"
      ? "text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-lg transition-colors",
              disabled ? "text-muted-foreground/30 cursor-not-allowed" : tonoClase,
            )}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
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

// Devuelve la "cita representativa" de una serie: la próxima futura,
// o si ya no hay futuras, la mas reciente pasada.
function citaRepresentativa(serieCitas: Cita[]): Cita {
  const ahora = Date.now()
  const futuras = serieCitas.filter(
    (c) => new Date(c.fecha_hora).getTime() > ahora,
  )
  if (futuras.length > 0) {
    return futuras.sort(
      (a, b) =>
        new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime(),
    )[0]
  }
  return [...serieCitas].sort(
    (a, b) =>
      new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime(),
  )[0]
}

// Colapsa las citas por serie_id: cada serie aparece una sola vez en la lista,
// las citas sueltas se conservan.
function colapsarSeries(citas: Cita[]): Cita[] {
  const grupos = new Map<string, Cita[]>()
  const sueltas: Cita[] = []
  for (const c of citas) {
    if (c.serie_id) {
      const arr = grupos.get(c.serie_id) ?? []
      arr.push(c)
      grupos.set(c.serie_id, arr)
    } else {
      sueltas.push(c)
    }
  }
  const representativas: Cita[] = []
  for (const arr of grupos.values()) {
    representativas.push(citaRepresentativa(arr))
  }
  return [...sueltas, ...representativas].sort(
    (a, b) =>
      new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime(),
  )
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

export function CitasClient({ citas: citasIniciales, pacientes, servicios, doctores, bloqueos, esDoctor = false, doctorId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [citas, setCitas] = useState<Cita[]>(citasIniciales)
  const [cerrarDiaOpen, setCerrarDiaOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [eliminarId, setEliminarId] = useState<string | null>(null)
  const [citaEditando, setCitaEditando] = useState<Cita | null>(null)
  const [form, setForm] = useState<FormCita>(FORM_INICIAL)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [citaDrawer, setCitaDrawer] = useState<Cita | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const [editarSerieInfo, setEditarSerieInfo] = useState<{
    serieId: string
    finActual: string | null
  } | null>(null)

  // Lista visible en tabla y mobile: una sola fila por serie mensual
  const citasVisibles = useMemo(() => colapsarSeries(citas), [citas])

  // Devuelve todas las instancias de la serie a la que pertenece la cita actual
  // del drawer (ordenadas por fecha ascendente)
  const instanciasSerie = useMemo(() => {
    if (!citaDrawer?.serie_id) return []
    return citas
      .filter((c) => c.serie_id === citaDrawer.serie_id)
      .sort(
        (a, b) =>
          new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime(),
      )
  }, [citas, citaDrawer])

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
    // Para doctores: pre-rellenar su propio doctor_id
    setForm({ ...FORM_INICIAL, doctor_id: esDoctor && doctorId ? doctorId : "" })
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
      // En edicion no se modifica la serie — los campos quedan vacios
      recurrencia_tipo:  "",
      recurrencia_modo:  "indefinido",
      recurrencia_meses: "3",
      recurrencia_fin:   "",
    })
    setFormOpen(true)
  }

  function actualizarCampo<K extends keyof FormCita>(key: K, value: FormCita[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleGuardar() {
    if (!form.patient_id) {
      toast.error("Seleccióna un paciente")
      return
    }
    if (!form.fecha_hora) {
      toast.error("Ingresa la fecha y hora de la cita")
      return
    }

    // Calcular recurrencia_fin para el backend segun el modo selecciónado
    let recurrenciaFinFinal = ""
    if (form.recurrencia_tipo === "mensual") {
      if (form.recurrencia_modo === "fecha") {
        if (!form.recurrencia_fin) {
          toast.error("Seleccióna la fecha de fin de la serie")
          return
        }
        recurrenciaFinFinal = form.recurrencia_fin
      } else if (form.recurrencia_modo === "n_meses") {
        const meses = Number(form.recurrencia_meses)
        if (!Number.isFinite(meses) || meses < 1) {
          toast.error("Ingresa un número válido de meses")
          return
        }
        // Calcular fecha de fin sumando N meses a la fecha de la cita
        const base = new Date(form.fecha_hora)
        base.setMonth(base.getMonth() + meses)
        recurrenciaFinFinal = base.toISOString().slice(0, 10)
      } else {
        // indefinido — sin fecha de fin
        recurrenciaFinFinal = ""
      }
    }

    const datosEnvio = {
      ...form,
      recurrencia_tipo: form.recurrencia_tipo,
      recurrencia_fin:  recurrenciaFinFinal,
    }

    startTransition(async () => {
      try {
        if (citaEditando) {
          await actualizarCita(citaEditando.id, datosEnvio)
          toast.success("Cita actualizada correctamente")
        } else {
          await crearCita(datosEnvio)
          if (form.recurrencia_tipo === "mensual") {
            toast.success("Serie mensual creada — próximas citas generadas")
          } else {
            toast.success("Cita creada correctamente")
          }
        }
        setFormOpen(false)
        router.refresh()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Error al guardar la cita")
      }
    })
  }

  // -------------------------------------------------------------------------
  // Handler — terminar serie recurrente
  // -------------------------------------------------------------------------

  function handleTerminarSerie(serieId: string) {
    startTransition(async () => {
      try {
        await terminarSerie(serieId)
        toast.success("Serie terminada. Se eliminaron las citas futuras.")
        setCitaDrawer(null)
        router.refresh()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Error al terminar la serie")
      }
    })
  }

  function handleEditarSerie(datos: DatosEditarSerie) {
    if (!editarSerieInfo) return
    const serieId = editarSerieInfo.serieId
    startTransition(async () => {
      const res = await editarSerie(serieId, datos)
      if (res.ok) {
        toast.success("Serie actualizada")
        setEditarSerieInfo(null)
        setCitaDrawer(null)
        router.refresh()
      } else {
        toast.error(res.error ?? "Error al actualizar la serie")
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
  // Handlers — cierre de dia y pago
  // -------------------------------------------------------------------------

  function handleReabrir(bloqueoId: string) {
    startTransition(async () => {
      const r = await reabrirDia(bloqueoId)
      if (!r.ok) { toast.error(r.error ?? "No se pudo reabrir el día."); return }
      toast.success("Día reabierto")
      router.refresh()
    })
  }

  function handleMarcarPago(citaId: string, estado: "pendiente" | "pagado") {
    startTransition(async () => {
      const r = await marcarPago(citaId, estado)
      if (!r.ok) { toast.error(r.error ?? "No se pudo actualizar el pago."); return }
      setCitas((prev) => prev.map((c) => (c.id === citaId ? { ...c, estado_pago: estado } : c)))
      setCitaDrawer((d) => (d && d.id === citaId ? { ...d, estado_pago: estado } : d))
      toast.success(estado === "pagado" ? "Cita marcada como pagada" : "Cita marcada como pendiente")
    })
  }

  function handleEnviarDatosPago(citaId: string) {
    startTransition(async () => {
      const r = await enviarDatosPago(citaId)
      if (!r.ok) { toast.error(r.error ?? "No se pudo enviar los datos de pago."); return }
      toast.success("Datos de pago enviados al paciente")
    })
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
            {citasVisibles.length} {citasVisibles.length === 1 ? "registro" : "registros"}
          </span>
          <Button size="sm" variant="outline" onClick={() => setCerrarDiaOpen(true)}>
            <CalendarX className="mr-1 h-4 w-4" aria-hidden="true" />
            Cerrar día
          </Button>
          <Button size="sm" onClick={abrirFormNuevo}>
            Nueva cita
          </Button>
        </div>
      </div>

      {/* Dias cerrados proximos */}
      {bloqueos.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 p-3">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
            Días cerrados próximos
          </p>
          <div className="space-y-2">
            {bloqueos.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium capitalize truncate">{formatearFechaCorta(b.fecha)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.servicio_nombre ? `Solo ${b.servicio_nombre}` : "Toda la clínica"}
                    {b.motivo ? ` · ${b.motivo}` : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => handleReabrir(b.id)}
                  disabled={isPending}
                >
                  <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" />
                  Reabrir día
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Vista mobile — lista de filas                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="md:hidden">
        {citasVisibles.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin citas registradas.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            {citasVisibles.map((cita) => (
              <button
                key={cita.id}
                onClick={() => setCitaDrawer(cita)}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 active:bg-muted/40 transition-colors text-left"
              >
                {/* Info izquierda */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm truncate">
                      {cita.patients?.nombre ?? "Sin paciente"}
                    </p>
                    {cita.serie_id && (
                      <Repeat
                        className="h-3.5 w-3.5 text-primary shrink-0"
                        aria-label="Cita mensual"
                      />
                    )}
                  </div>
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
            {citasVisibles.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Sin citas registradas.
                </td>
              </tr>
            )}
            {citasVisibles.map((cita) => (
              <tr
                key={cita.id}
                onClick={() => setCitaDrawer(cita)}
                className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
              >
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-1.5">
                    {cita.patients?.nombre ?? "—"}
                    {cita.serie_id && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                        title="Cita mensual recurrente"
                      >
                        <Repeat className="h-2.5 w-2.5" aria-hidden="true" />
                        Mensual
                      </span>
                    )}
                  </div>
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
                    <span className="text-cyan-600 dark:text-cyan-400 text-xs font-medium">
                      Enviado
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Pendiente</span>
                  )}
                </td>
                <td
                  className="px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
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
                    {cita.serie_id && (
                      <button
                        onClick={() => {
                          if (cita.serie_id) handleTerminarSerie(cita.serie_id)
                        }}
                        disabled={isPending}
                        title="Terminar serie mensual"
                        className="p-1.5 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
                      >
                        <CircleStop size={15} />
                      </button>
                    )}
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
      {/* Detalle de cita — Drawer en mobile, Sheet lateral en desktop        */}
      {/* ------------------------------------------------------------------ */}
      {(() => {
        const tituloDetalle = citaDrawer?.services?.nombre ?? "Cita sin servicio"

        const recordatorioDeshabilitado =
          !citaDrawer?.patients?.channel_user_id ||
          !!citaDrawer?.recordatorio_enviado_at ||
          enviandoId === citaDrawer?.id

        const accionesDetalle = citaDrawer && (
          <div className="flex items-center justify-between gap-1">
            <AccionBtn
              label="Editar cita"
              onClick={() => { abrirFormEdicion(citaDrawer); setCitaDrawer(null) }}
            >
              <SquarePen size={20} />
            </AccionBtn>
            <AccionBtn
              label={
                !citaDrawer.patients?.channel_user_id
                  ? "Sin ID de canal configurado"
                  : citaDrawer.recordatorio_enviado_at
                  ? "Recordatorio ya enviado"
                  : "Enviar recordatorio"
              }
              disabled={recordatorioDeshabilitado}
              onClick={() => { handleEnviarRecordatorio(citaDrawer); setCitaDrawer(null) }}
              tono={!recordatorioDeshabilitado ? "azul" : undefined}
            >
              <Clock size={20} className={enviandoId === citaDrawer.id ? "animate-spin" : ""} />
            </AccionBtn>
            <AccionBtn
              label={citaDrawer.patients?.channel_user_id ? "Enviar datos de pago" : "Sin ID de canal configurado"}
              disabled={!citaDrawer.patients?.channel_user_id || isPending}
              onClick={() => handleEnviarDatosPago(citaDrawer.id)}
            >
              <Send size={20} />
            </AccionBtn>
            <AccionBtn
              label={citaDrawer.estado_pago === "pagado" ? "Marcar como pendiente" : "Marcar como pagada"}
              disabled={isPending}
              onClick={() => handleMarcarPago(citaDrawer.id, citaDrawer.estado_pago === "pagado" ? "pendiente" : "pagado")}
              tono={citaDrawer.estado_pago === "pagado" ? "verde" : undefined}
            >
              <BadgeDollarSign size={20} />
            </AccionBtn>
            <AccionBtn
              label="Eliminar cita"
              tono="rojo"
              onClick={() => { setEliminarId(citaDrawer.id); setCitaDrawer(null) }}
            >
              <Trash2 size={20} />
            </AccionBtn>
          </div>
        )

        const cuerpoDetalle = citaDrawer && (
          <div className="px-4 py-4 pb-8 md:px-6 space-y-4">
            {/* Datos de la cita */}
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Paciente</span>
                <span className="font-medium">
                  {citaDrawer.patients?.nombre ?? "—"}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground flex-shrink-0">
                  Fecha y hora
                </span>
                <span className="font-medium text-right">
                  {formatFechaCompleta(citaDrawer.fecha_hora)}
                  {esProxima(citaDrawer.fecha_hora) && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 align-middle">
                      próxima
                    </span>
                  )}
                </span>
              </div>

              {citaDrawer.doctors && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Doctor</span>
                  <span className="font-medium">{citaDrawer.doctors.nombre}</span>
                </div>
              )}

              {citaDrawer.duracion_min != null && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Duración</span>
                  <span className="font-medium tabular-nums">
                    {citaDrawer.duracion_min} min
                  </span>
                </div>
              )}

              {citaDrawer.recordatorio_enviado_at && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Recordatorio</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                    Enviado
                  </span>
                </div>
              )}
            </div>

            {citaDrawer.notas && (
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-1.5">Notas</p>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {citaDrawer.notas}
                </p>
              </div>
            )}

            {/* Serie mensual */}
            {citaDrawer.serie_id && (
              <div className="border-t border-border pt-3 space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    Serie mensual
                    {citaDrawer.recurrencia_fin && (
                      <> hasta el{" "}
                        {new Date(citaDrawer.recurrencia_fin + "T12:00:00").toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </>
                    )}
                    {!citaDrawer.recurrencia_fin && <> indefinida</>}
                  </span>
                </div>

                {instanciasSerie.length > 0 && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    {instanciasSerie.map((inst) => {
                      const esActual = inst.id === citaDrawer.id
                      const pasada = new Date(inst.fecha_hora).getTime() < Date.now()
                      return (
                        <button
                          key={inst.id}
                          onClick={() => {
                            if (!esActual) setCitaDrawer(inst)
                          }}
                          disabled={esActual}
                          className={cn(
                            "w-full flex items-center justify-between gap-2 px-3 py-2 text-xs border-b border-border last:border-0 text-left transition-colors",
                            esActual
                              ? "bg-primary/10 cursor-default"
                              : "hover:bg-muted/40 active:bg-muted/60",
                          )}
                        >
                          <span className={cn(
                            "tabular-nums",
                            pasada && !esActual && "text-muted-foreground",
                          )}>
                            {formatFecha(inst.fecha_hora)}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                              ESTADO_ESTILO[inst.status] ?? "bg-muted text-muted-foreground",
                            )}
                          >
                            {STATUS_LABELS[inst.status] ?? inst.status}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (citaDrawer.serie_id) {
                        setEditarSerieInfo({
                          serieId:   citaDrawer.serie_id,
                          finActual: citaDrawer.recurrencia_fin ?? null,
                        })
                      }
                    }}
                    disabled={isPending}
                  >
                    <CalendarRange className="h-4 w-4 mr-2" aria-hidden="true" />
                    Editar serie
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => {
                      if (citaDrawer.serie_id) handleTerminarSerie(citaDrawer.serie_id)
                    }}
                    disabled={isPending}
                  >
                    <CircleStop className="h-4 w-4 mr-2" aria-hidden="true" />
                    Terminar serie
                  </Button>
                </div>
              </div>
            )}
          </div>
        )

        const cabeceraBadgeAcciones = citaDrawer && (
          <div className="mt-2 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
                  ESTADO_ESTILO[citaDrawer.status] ??
                    "bg-muted text-muted-foreground"
                )}
              >
                {STATUS_LABELS[citaDrawer.status] ?? citaDrawer.status}
              </span>
              <span
                className={cn(
                  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
                  citaDrawer.estado_pago === "pagado"
                    ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                )}
              >
                {citaDrawer.estado_pago === "pagado" ? "Pagado" : "Pago pendiente"}
              </span>
            </div>
            {accionesDetalle}
          </div>
        )

        return (
          <>
            {/* Mobile — Drawer inferior */}
            {!isDesktop && (
              <Drawer
                open={citaDrawer !== null}
                onOpenChange={(o) => { if (!o) setCitaDrawer(null) }}
                shouldScaleBackground
              >
                <DrawerContent>
                  <DrawerHeader className="flex-shrink-0 border-b border-border pb-3 text-left">
                    <DrawerTitle>{tituloDetalle}</DrawerTitle>
                    {cabeceraBadgeAcciones}
                  </DrawerHeader>
                  {cuerpoDetalle}
                </DrawerContent>
              </Drawer>
            )}

            {/* Desktop — Sheet lateral derecho */}
            {isDesktop && (
              <Sheet
                open={citaDrawer !== null}
                onOpenChange={(o) => { if (!o) setCitaDrawer(null) }}
              >
                <SheetContent
                  side="right"
                  className={cn(
                    "w-full sm:max-w-md p-0 flex flex-col gap-0",
                    // Despegar del borde con margen y bordes redondeados
                    "data-[side=right]:inset-y-3 data-[side=right]:right-3",
                    "data-[side=right]:h-auto data-[side=right]:border",
                    "rounded-xl shadow-2xl overflow-hidden"
                  )}
                >
                  <SheetHeader className="shrink-0 border-b border-border px-6 py-4">
                    <SheetTitle>{tituloDetalle}</SheetTitle>
                    {cabeceraBadgeAcciones}
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto">
                    {cuerpoDetalle}
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </>
        )
      })()}

      {/* ------------------------------------------------------------------ */}
      {/* Formulario — campos compartidos mobile y desktop                   */}
      {/* ------------------------------------------------------------------ */}
      {(() => {
        // Un doctor editando una cita existente solo puede reagendar
        // (cambiar fecha y hora) — el resto de los campos se muestra de
        // solo lectura. Al crear una cita nueva si puede llenarlos.
        const soloLectura = esDoctor && !!citaEditando

        const camposForm = (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
            {/* Paciente */}
            <div className="space-y-1.5">
              <Label>Paciente</Label>
              {soloLectura ? (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {pacientes.find((p) => p.id === form.patient_id)?.nombre ?? "—"}
                </div>
              ) : (
                <Select
                  value={form.patient_id}
                  onValueChange={(v) => actualizarCampo("patient_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccióna un paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {pacientes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Servicio */}
            <div className="space-y-1.5">
              <Label>Servicio</Label>
              {soloLectura ? (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {servicios.find((s) => s.id === form.service_id)?.nombre ?? "—"}
                </div>
              ) : (
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
                    <SelectValue placeholder="Seleccióna un servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {servicios.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Doctor */}
            <div className="space-y-1.5">
              <Label>Doctor</Label>
              {esDoctor ? (
                // El doctor no puede cambiar el campo — se muestra como texto
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {doctores[0]?.nombre ?? "—"}
                </div>
              ) : (
                <Select
                  value={form.doctor_id}
                  onValueChange={(v) => actualizarCampo("doctor_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccióna un doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctores.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
              {soloLectura ? (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {STATUS_LABELS[form.status as keyof typeof STATUS_LABELS] ?? form.status}
                </div>
              ) : (
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
              )}
            </div>

            {/* Duración */}
            <div className="space-y-1.5">
              <Label>Duración (min)</Label>
              {soloLectura ? (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {form.duracion_min || "—"}
                </div>
              ) : (
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
              )}
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label>Notas</Label>
              {soloLectura ? (
                <div className="min-h-9 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap">
                  {form.notas || "—"}
                </div>
              ) : (
                <Textarea
                  placeholder="Observaciones adicionales..."
                  value={form.notas}
                  onChange={(e) => actualizarCampo("notas", e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              )}
            </div>

            {/* Recurrencia mensual — solo en creacion */}
            {!citaEditando && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Label htmlFor="recurrencia-toggle" className="cursor-pointer">
                      Repetir cada mes
                    </Label>
                  </div>
                  <input
                    id="recurrencia-toggle"
                    type="checkbox"
                    checked={form.recurrencia_tipo === "mensual"}
                    onChange={(e) =>
                      actualizarCampo(
                        "recurrencia_tipo",
                        e.target.checked ? "mensual" : "",
                      )
                    }
                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                  />
                </div>

                {form.recurrencia_tipo === "mensual" && (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Se creará una cita el mismo día de cada mes. Si el día no
                      existe en algún mes, se usará el último día disponible.
                    </p>

                    <div className="space-y-1.5">
                      <Label>Duración de la serie</Label>
                      <Select
                        value={form.recurrencia_modo}
                        onValueChange={(v) =>
                          actualizarCampo(
                            "recurrencia_modo",
                            v as FormCita["recurrencia_modo"],
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="indefinido">Indefinido (12 meses)</SelectItem>
                          <SelectItem value="n_meses">Por N meses</SelectItem>
                          <SelectItem value="fecha">Hasta una fecha</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {form.recurrencia_modo === "n_meses" && (
                      <div className="space-y-1.5">
                        <Label>Número de meses</Label>
                        <Input
                          type="number"
                          min="1"
                          max="24"
                          step="1"
                          value={form.recurrencia_meses}
                          onChange={(e) =>
                            actualizarCampo("recurrencia_meses", e.target.value)
                          }
                        />
                      </div>
                    )}

                    {form.recurrencia_modo === "fecha" && (
                      <div className="space-y-1.5">
                        <Label>Fecha de fin</Label>
                        <Input
                          type="date"
                          value={form.recurrencia_fin}
                          onChange={(e) =>
                            actualizarCampo("recurrencia_fin", e.target.value)
                          }
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
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

      {/* Dialog — editar duración de la serie */}
      <DialogEditarSerie
        info={editarSerieInfo}
        onCerrar={() => setEditarSerieInfo(null)}
        onGuardar={handleEditarSerie}
        isPending={isPending}
      />

      {/* Cerrar día / bloquear por servicio (Drawer en movil, Dialog en escritorio) */}
      <CerrarDiaModal
        open={cerrarDiaOpen}
        isDesktop={isDesktop}
        servicios={servicios}
        onCerrar={() => setCerrarDiaOpen(false)}
        onListo={() => { setCerrarDiaOpen(false); router.refresh() }}
      />

      {/* Drawer — confirmar eliminación */}
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
            Esta acción no se puede deshacer. La cita será eliminada
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

// ---------------------------------------------------------------------------
// Dialog — editar duración de la serie
// ---------------------------------------------------------------------------

type EditarSerieInfo = { serieId: string; finActual: string | null }

function DialogEditarSerie({
  info,
  onCerrar,
  onGuardar,
  isPending,
}: {
  info: EditarSerieInfo | null
  onCerrar: () => void
  onGuardar: (datos: DatosEditarSerie) => void
  isPending: boolean
}) {
  // Modo inicial inferido del valor actual
  const modoInicial: "indefinido" | "fecha" =
    info?.finActual ? "fecha" : "indefinido"
  const [modo, setModo] = useState<"indefinido" | "n_meses" | "fecha">(modoInicial)
  const [meses, setMeses] = useState("3")
  const [fecha, setFecha] = useState(info?.finActual ?? "")

  // Resincronizar campos cuando se abre con una serie diferente
  useEffect(() => {
    if (info) {
      setModo(info.finActual ? "fecha" : "indefinido")
      setMeses("3")
      setFecha(info.finActual ?? "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.serieId])

  function handleGuardar() {
    if (modo === "fecha" && !fecha) {
      toast.error("Seleccióna la fecha de fin")
      return
    }
    if (modo === "n_meses") {
      const n = Number(meses)
      if (!Number.isFinite(n) || n < 1) {
        toast.error("Número de meses invalido")
        return
      }
    }
    onGuardar({
      modo,
      meses: modo === "n_meses" ? Number(meses) : undefined,
      fecha: modo === "fecha" ? fecha : undefined,
    })
  }

  return (
    <Dialog open={info !== null} onOpenChange={(o) => { if (!o) onCerrar() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar serie mensual</DialogTitle>
          <DialogDescription>
            Cambia la duración de la serie. Solo se afectan las citas futuras —
            las pasadas se respetan siempre.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Duración de la serie</Label>
            <Select
              value={modo}
              onValueChange={(v) =>
                setModo(v as "indefinido" | "n_meses" | "fecha")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="indefinido">Indefinida (12 meses)</SelectItem>
                <SelectItem value="n_meses">Por N meses</SelectItem>
                <SelectItem value="fecha">Hasta una fecha</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {modo === "n_meses" && (
            <div className="space-y-1.5">
              <Label htmlFor="serie-meses">Número de meses</Label>
              <Input
                id="serie-meses"
                type="number"
                min="1"
                max="24"
                step="1"
                value={meses}
                onChange={(e) => setMeses(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Contados desde la primera cita de la serie.
              </p>
            </div>
          )}

          {modo === "fecha" && (
            <div className="space-y-1.5">
              <Label htmlFor="serie-fecha">Fecha de fin</Label>
              <Input
                id="serie-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={isPending}>
            {isPending ? "Aplicando..." : "Aplicar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Cerrar día / bloquear por servicio (Drawer en movil, Dialog en escritorio)
// ---------------------------------------------------------------------------

function CerrarDiaModal({
  open, isDesktop, servicios, onCerrar, onListo,
}: {
  open: boolean
  isDesktop: boolean
  servicios: Servicio[]
  onCerrar: () => void
  onListo: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [fecha, setFecha] = useState("")
  const [alcance, setAlcance] = useState<"todo" | "servicio">("todo")
  const [serviceId, setServiceId] = useState("")
  const [motivo, setMotivo] = useState("")

  function confirmar() {
    startTransition(async () => {
      const r = await cerrarDia({
        fecha,
        service_id: alcance === "servicio" ? serviceId : undefined,
        motivo,
      })
      if (!r.ok) { toast.error(r.error ?? "No se pudo cerrar el día."); return }
      const avisadas = r.avisadas ?? 0
      const afectadas = r.afectadas ?? 0
      toast.success(
        afectadas === 0
          ? "Día cerrado. No había citas ese día."
          : `Día cerrado. ${afectadas} cita(s) marcadas por reagendar, ${avisadas} paciente(s) avisados.`,
      )
      setFecha(""); setMotivo(""); setAlcance("todo"); setServiceId("")
      onListo()
    })
  }

  const puedeConfirmar = !isPending && !!fecha && !(alcance === "servicio" && !serviceId)

  const campos = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cerrar-fecha">Fecha a cerrar</Label>
        <Input id="cerrar-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Alcance</Label>
        <button
          type="button"
          onClick={() => setAlcance("todo")}
          className={cn(
            "w-full text-left rounded-lg border p-3 text-sm transition-colors",
            alcance === "todo" ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          <span className="font-medium">Toda la clínica</span>
          <span className="block text-xs text-muted-foreground">No habrá atención ese día</span>
        </button>
        <button
          type="button"
          onClick={() => setAlcance("servicio")}
          className={cn(
            "w-full text-left rounded-lg border p-3 text-sm transition-colors",
            alcance === "servicio" ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          <span className="font-medium">Solo un servicio</span>
          <span className="block text-xs text-muted-foreground">Ej. equipo descompuesto</span>
        </button>
      </div>

      {alcance === "servicio" && (
        <div className="space-y-1.5">
          <Label htmlFor="cerrar-servicio">Servicio a bloquear</Label>
          <select
            id="cerrar-servicio"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecciona un servicio</option>
            {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cerrar-motivo">Motivo (opcional)</Label>
        <Input id="cerrar-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Vacaciones, mantenimiento, etc." />
      </div>

      <p className="text-xs text-muted-foreground">
        Nota: si tienes página de reserva de Google, recuerda marcar también ese día como
        ocupado en tu Google Calendar para que no se ofrezca en tu página de reservas.
      </p>
    </div>
  )

  // Escritorio — Dialog centrado
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onCerrar() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cerrar un día</DialogTitle>
            <DialogDescription>
              Bloquea la fecha y avisa a los pacientes con cita ese día para que reagenden.
            </DialogDescription>
          </DialogHeader>
          {campos}
          <DialogFooter>
            <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
            <Button onClick={confirmar} disabled={!puedeConfirmar}>
              {isPending ? "Cerrando..." : "Cerrar día y avisar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Movil — Drawer inferior con margenes
  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onCerrar() }} shouldScaleBackground>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Cerrar un día</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-2 overflow-y-auto">{campos}</div>
        <DrawerFooter className="border-t border-border pt-3 flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={onCerrar}>Cancelar</Button>
          <Button className="flex-1" onClick={confirmar} disabled={!puedeConfirmar}>
            {isPending ? "Cerrando..." : "Cerrar día"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
