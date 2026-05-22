"use client"

import { useState, useEffect, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  crearPaciente,
  actualizarPaciente,
  eliminarPaciente,
  agendarCitaPaciente,
} from "./actions"
import { supabase } from "@/lib/supabase/client"
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
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "sonner"
import {
  Calendar,
  CalendarPlus,
  ChevronRight,
  ExternalLink,
  FileText,
  FlaskConical,
  Loader2,
  Search,
  SquarePen,
  Trash2,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Tipos — lista
// ---------------------------------------------------------------------------

type ProximaCita = {
  fecha_hora: string
  servicio_nombre: string | null
}

type DoctorRef = {
  id: string
  nombre: string
  orden: number
}

type PacienteConDatos = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  channel: string
  channel_user_id: string | null
  notas: string | null
  created_at: string
  laboratorio: string | null
  tiempo_cita_min: number | null
  fecha_ingreso: string | null
  proxima_cita: ProximaCita | null
  doctor_principal: DoctorRef | null
  doctores_respaldo: DoctorRef[]
  estudios_pendientes: number
}

type Servicio = { id: string; nombre: string; precio: number }
type Doctor = { id: string; nombre: string }

type FormPaciente = {
  nombre: string
  telefono: string
  email: string
  channel: string
  channel_user_id: string
  notas: string
  laboratorio: string
  tiempo_cita_min: string
  fecha_ingreso: string
  doctor_principal: string
  doctor_respaldo1: string
  doctor_respaldo2: string
}

type FormCita = {
  service_id: string
  fecha_hora: string
  status: string
  costo: string
  notas: string
}

interface Props {
  pacientes: PacienteConDatos[]
  servicios: Servicio[]
  doctores: Doctor[]
}

// ---------------------------------------------------------------------------
// Tipos — drawer (ficha completa)
// ---------------------------------------------------------------------------

type CitaFicha = {
  id: string
  fecha_hora: string
  status: string
  costo: number | null
  notas: string | null
  servicio: { id: string; nombre: string; duracion_min: number | null } | null
  doctor: { id: string; nombre: string } | null
}

type EstudioFicha = {
  id: string
  nombre: string
  descripcion: string | null
  status: string
  fecha_indicacion: string | null
  created_at: string | null
}

type NotaFicha = {
  id: string
  contenido: string
  created_at: string | null
}

type DoctorAsignadoFicha = {
  id: string
  nombre: string
  especialidades: string[] | null
  email: string | null
  orden: number
}

type EventoTimeline =
  | { tipo: "cita"; fecha: string; key: string; data: CitaFicha }
  | { tipo: "estudio"; fecha: string; key: string; data: EstudioFicha }
  | { tipo: "nota"; fecha: string; key: string; data: NotaFicha }

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const FORM_INICIAL: FormPaciente = {
  nombre: "",
  telefono: "",
  email: "",
  channel: "telegram",
  channel_user_id: "",
  notas: "",
  laboratorio: "",
  tiempo_cita_min: "",
  fecha_ingreso: "",
  doctor_principal: "",
  doctor_respaldo1: "",
  doctor_respaldo2: "",
}

const FORM_CITA_INICIAL: FormCita = {
  service_id: "",
  fecha_hora: "",
  status: "programada",
  costo: "",
  notas: "",
}

const CANAL_LABEL: Record<string, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
}

const STATUS_LABELS: Record<string, string> = {
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
  cancelada:
    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFechaCita(raw: string): string {
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

function buildTimeline(
  citas: CitaFicha[],
  estudios: EstudioFicha[],
  notas: NotaFicha[]
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
      fecha: n.created_at ?? new Date(0).toISOString(),
      key: `nota-${n.id}`,
      data: n,
    })),
  ]
  return eventos.sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  )
}

// ---------------------------------------------------------------------------
// Subcomponente — item del timeline (dentro del drawer)
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
    evento.tipo === "nota" && "bg-muted text-muted-foreground"
  )

  return (
    <div className="flex gap-4">
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

      <div className={cn("flex-1 min-w-0", !isLast && "pb-5")}>
        <p className="text-[11px] text-muted-foreground mb-0.5">
          {formatFechaCorta(evento.fecha)}
        </p>

        {evento.tipo === "cita" && (
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {evento.data.servicio?.nombre ?? "Cita sin servicio"}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                  STATUS_CITA_ESTILO[evento.data.status] ??
                    "bg-muted text-muted-foreground"
                )}
              >
                {STATUS_LABELS[evento.data.status] ?? evento.data.status}
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
            <div className="flex items-center gap-2 flex-wrap">
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
                <span className="text-xs text-muted-foreground truncate max-w-[220px]">
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

export function PacientesClient({
  pacientes: pacientesIniciales,
  servicios,
  doctores,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Lista y busqueda
  const [pacientes, setPacientes] =
    useState<PacienteConDatos[]>(pacientesIniciales)
  const [busqueda, setBusqueda] = useState("")

  // Dialog paciente
  const [formPacienteOpen, setFormPacienteOpen] = useState(false)
  const [pacienteEditando, setPacienteEditando] =
    useState<PacienteConDatos | null>(null)
  const [formPaciente, setFormPaciente] = useState<FormPaciente>(FORM_INICIAL)

  // Dialog agendar cita
  const [agendarOpen, setAgendarOpen] = useState(false)
  const [agendarNombre, setAgendarNombre] = useState("")
  const [agendarPacienteId, setAgendarPacienteId] = useState("")
  const [formCita, setFormCita] = useState<FormCita>(FORM_CITA_INICIAL)

  // Dialog eliminar
  const [eliminarId, setEliminarId] = useState<string | null>(null)

  // Drawer — ficha mobile
  const [drawerPaciente, setDrawerPaciente] =
    useState<PacienteConDatos | null>(null)
  const [drawerCargando, setDrawerCargando] = useState(false)
  const [drawerCitas, setDrawerCitas] = useState<CitaFicha[]>([])
  const [drawerEstudios, setDrawerEstudios] = useState<EstudioFicha[]>([])
  const [drawerNotas, setDrawerNotas] = useState<NotaFicha[]>([])
  const [drawerDoctores, setDrawerDoctores] = useState<DoctorAsignadoFicha[]>(
    []
  )
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPacientes(pacientesIniciales)
  }, [pacientesIniciales])

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const pacientesFiltrados = busqueda.trim()
    ? pacientes.filter(
        (p) =>
          p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          (p.telefono ?? "").includes(busqueda)
      )
    : pacientes

  // -------------------------------------------------------------------------
  // Handlers — formulario paciente
  // -------------------------------------------------------------------------

  function abrirFormNuevo() {
    setPacienteEditando(null)
    setFormPaciente(FORM_INICIAL)
    setFormPacienteOpen(true)
  }

  function abrirFormEdicion(p: PacienteConDatos) {
    setPacienteEditando(p)
    setFormPaciente({
      nombre: p.nombre,
      telefono: p.telefono ?? "",
      email: p.email ?? "",
      channel: p.channel,
      channel_user_id: p.channel_user_id ?? "",
      notas: p.notas ?? "",
      laboratorio: p.laboratorio ?? "",
      tiempo_cita_min:
        p.tiempo_cita_min != null ? String(p.tiempo_cita_min) : "",
      fecha_ingreso: p.fecha_ingreso ?? "",
      doctor_principal: p.doctor_principal?.id ?? "",
      doctor_respaldo1: p.doctores_respaldo[0]?.id ?? "",
      doctor_respaldo2: p.doctores_respaldo[1]?.id ?? "",
    })
    setFormPacienteOpen(true)
  }

  function actualizarCampoPaciente<K extends keyof FormPaciente>(
    key: K,
    value: FormPaciente[K]
  ) {
    setFormPaciente((prev) => ({ ...prev, [key]: value }))
  }

  function handleGuardarPaciente() {
    if (!formPaciente.nombre.trim()) {
      toast.error("El nombre del paciente es requerido")
      return
    }

    const doctoresOrdenados = [
      formPaciente.doctor_principal,
      formPaciente.doctor_respaldo1,
      formPaciente.doctor_respaldo2,
    ].filter(Boolean)

    startTransition(async () => {
      try {
        if (pacienteEditando) {
          await actualizarPaciente(pacienteEditando.id, {
            ...formPaciente,
            doctores: doctoresOrdenados,
          })
          toast.success("Paciente actualizado correctamente")
        } else {
          await crearPaciente({ ...formPaciente, doctores: doctoresOrdenados })
          toast.success("Paciente creado correctamente")
        }
        setFormPacienteOpen(false)
        router.refresh()
      } catch (e: unknown) {
        toast.error(
          e instanceof Error ? e.message : "Error al guardar el paciente"
        )
      }
    })
  }

  // -------------------------------------------------------------------------
  // Handlers — agendar cita
  // -------------------------------------------------------------------------

  function abrirAgendarCita(p: PacienteConDatos) {
    setAgendarPacienteId(p.id)
    setAgendarNombre(p.nombre)
    setFormCita(FORM_CITA_INICIAL)
    setAgendarOpen(true)
  }

  function actualizarCampoCita<K extends keyof FormCita>(
    key: K,
    value: FormCita[K]
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
        await agendarCitaPaciente({
          patient_id: agendarPacienteId,
          service_id: formCita.service_id,
          fecha_hora: formCita.fecha_hora,
          status: formCita.status,
          costo: formCita.costo,
          notas: formCita.notas,
        })
        toast.success("Cita agendada correctamente")
        setAgendarOpen(false)
        router.refresh()
      } catch (e: unknown) {
        toast.error(
          e instanceof Error ? e.message : "Error al agendar la cita"
        )
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
        await eliminarPaciente(id)
        setPacientes((prev) => prev.filter((p) => p.id !== id))
        toast.success("Paciente eliminado")
        router.refresh()
      } catch (e: unknown) {
        toast.error(
          e instanceof Error ? e.message : "Error al eliminar el paciente"
        )
      }
    })
  }

  // -------------------------------------------------------------------------
  // Handler — abrir drawer (mobile)
  // -------------------------------------------------------------------------

  async function abrirDrawer(p: PacienteConDatos) {
    setDrawerPaciente(p)
    setDrawerCargando(true)
    setDrawerCitas([])
    setDrawerEstudios([])
    setDrawerNotas([])
    setDrawerDoctores([])

    try {
      const [
        { data: asignaciones },
        { data: citasRaw },
        { data: estudiosRaw },
        { data: notasRaw },
      ] = await Promise.all([
        supabase
          .from("patient_doctors")
          .select("orden, doctors(id, nombre, especialidades, email)")
          .eq("patient_id", p.id)
          .order("orden"),
        supabase
          .from("appointments")
          .select(
            "id, fecha_hora, status, costo, notas, services(id, nombre, duracion_min), doctors(id, nombre)"
          )
          .eq("patient_id", p.id)
          .order("fecha_hora", { ascending: false }),
        supabase
          .from("studies")
          .select(
            "id, nombre, descripcion, status, fecha_indicacion, created_at"
          )
          .eq("patient_id", p.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("clinical_notes")
          .select("id, contenido, created_at")
          .eq("patient_id", p.id)
          .order("created_at", { ascending: false }),
      ])

      const doctoresNorm: DoctorAsignadoFicha[] = (asignaciones ?? [])
        .map((a) => {
          const d = a.doctors as {
            id: string
            nombre: string
            especialidades: string[] | null
            email: string | null
          } | null
          if (!d) return null
          return {
            id: d.id,
            nombre: d.nombre,
            especialidades: d.especialidades,
            email: d.email,
            orden: a.orden,
          }
        })
        .filter((x): x is DoctorAsignadoFicha => x !== null)
        .sort((a, b) => a.orden - b.orden)

      const citasNorm: CitaFicha[] = (citasRaw ?? []).map((c) => ({
        id: c.id,
        fecha_hora: c.fecha_hora,
        status: c.status,
        costo: c.costo ?? null,
        notas: (c as Record<string, unknown>).notas as string | null ?? null,
        servicio: c.services as {
          id: string
          nombre: string
          duracion_min: number | null
        } | null,
        doctor: c.doctors as { id: string; nombre: string } | null,
      }))

      const estudiosNorm: EstudioFicha[] = (estudiosRaw ?? []).map((e) => ({
        id: e.id,
        nombre: e.nombre,
        descripcion: e.descripcion ?? null,
        status: e.status,
        fecha_indicacion: e.fecha_indicacion ?? null,
        created_at: e.created_at ?? null,
      }))

      const notasNorm: NotaFicha[] = (notasRaw ?? []).map((n) => ({
        id: n.id,
        contenido: n.contenido,
        created_at: n.created_at ?? null,
      }))

      setDrawerDoctores(doctoresNorm)
      setDrawerCitas(citasNorm)
      setDrawerEstudios(estudiosNorm)
      setDrawerNotas(notasNorm)
    } catch {
      // Si falla la carga, el usuario puede ir a la ficha completa
    } finally {
      setDrawerCargando(false)
    }
  }

  // Datos derivados para el drawer
  const drawerTimeline = buildTimeline(drawerCitas, drawerEstudios, drawerNotas)

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pacientes</h1>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-muted-foreground">
            {pacientesFiltrados.length !== pacientes.length
              ? `${pacientesFiltrados.length} de ${pacientes.length} registros`
              : `${pacientes.length} registros`}
          </span>
          <Button size="sm" onClick={abrirFormNuevo}>
            Nuevo paciente
          </Button>
        </div>
      </div>

      {/* Busqueda */}
      <div className="relative w-full md:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nombre o telefono..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Vista mobile — lista de filas                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="md:hidden">
        {pacientesFiltrados.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {busqueda
              ? "Sin resultados para esa busqueda."
              : "Sin pacientes registrados."}
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            {pacientesFiltrados.map((p) => (
              <button
                key={p.id}
                onClick={() => abrirDrawer(p)}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 active:bg-muted/40 transition-colors text-left"
              >
                {/* Info izquierda */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.nombre}</p>
                  {p.doctor_principal ? (
                    <p className="text-xs text-muted-foreground truncate">
                      {p.doctor_principal.nombre}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/50">
                      Sin doctor asignado
                    </p>
                  )}
                </div>

                {/* Proxima cita + chevron */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="text-right">
                    {p.proxima_cita ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {formatFechaCita(p.proxima_cita.fecha_hora)}
                        </p>
                        {p.proxima_cita.servicio_nombre && (
                          <p className="text-[11px] text-muted-foreground/60 truncate max-w-[120px]">
                            {p.proxima_cita.servicio_nombre}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground/50">
                        Sin cita
                      </p>
                    )}
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
              {["Nombre", "Proxima cita", "Doctor", "Est. pendientes", "Acciones"].map((h) => (
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
            {pacientesFiltrados.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  {busqueda
                    ? "Sin resultados para esa busqueda."
                    : "Sin pacientes registrados."}
                </td>
              </tr>
            )}
            {pacientesFiltrados.map((p) => (
              <tr
                key={p.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                {/* Nombre */}
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <Link
                    href={`/pacientes/${p.id}`}
                    className="hover:underline hover:text-primary transition-colors"
                  >
                    {p.nombre}
                  </Link>
                </td>

                {/* Proxima cita */}
                <td className="px-4 py-3 whitespace-nowrap">
                  {p.proxima_cita ? (
                    <span className="text-muted-foreground">
                      {formatFechaCita(p.proxima_cita.fecha_hora)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">
                      Sin cita
                    </span>
                  )}
                </td>

                {/* Doctor */}
                <td className="px-4 py-3 whitespace-nowrap">
                  {p.doctor_principal ? (
                    <span>{p.doctor_principal.nombre}</span>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">
                      Sin asignar
                    </span>
                  )}
                </td>

                {/* Estudios pendientes */}
                <td className="px-4 py-3">
                  {p.estudios_pendientes === 0 ? (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      0
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-400">
                      {p.estudios_pendientes}
                    </span>
                  )}
                </td>

                {/* Acciones */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => abrirAgendarCita(p)}
                      title="Agendar cita"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <CalendarPlus size={15} />
                    </button>
                    <button
                      onClick={() => abrirFormEdicion(p)}
                      title="Editar paciente"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <SquarePen size={15} />
                    </button>
                    <button
                      onClick={() => setEliminarId(p.id)}
                      title="Eliminar paciente"
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
      {/* Drawer — ficha del paciente (mobile)                                 */}
      {/* ------------------------------------------------------------------ */}
      <Drawer
        open={drawerPaciente !== null}
        onOpenChange={(o) => {
          if (!o) setDrawerPaciente(null)
        }}
        shouldScaleBackground
      >
        <DrawerContent style={{ height: "92svh" }}>
          {/* Encabezado fijo */}
          <DrawerHeader className="flex-shrink-0 border-b border-border pb-3 text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <DrawerTitle className="truncate">
                  {drawerPaciente?.nombre}
                </DrawerTitle>
                {drawerPaciente && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground mt-1">
                    {CANAL_LABEL[drawerPaciente.channel] ??
                      drawerPaciente.channel}
                  </span>
                )}
              </div>
              {drawerPaciente && (
                <Link
                  href={`/pacientes/${drawerPaciente.id}`}
                  className="flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0 mt-0.5"
                >
                  <ExternalLink size={12} />
                  Ver ficha
                </Link>
              )}
            </div>
          </DrawerHeader>

          {/* Contenido desplazable */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {drawerCargando ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : drawerPaciente ? (
              <div className="px-4 pt-4 pb-8 space-y-6">

                {/* -------------------------------------------------------- */}
                {/* Datos del paciente                                         */}
                {/* -------------------------------------------------------- */}
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Datos
                  </p>
                  <div className="space-y-2 text-sm">
                    {drawerPaciente.telefono && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Telefono</span>
                        <span className="font-medium tabular-nums">
                          {drawerPaciente.telefono}
                        </span>
                      </div>
                    )}
                    {drawerPaciente.email && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground flex-shrink-0">
                          Email
                        </span>
                        <span className="font-medium truncate text-right max-w-[200px]">
                          {drawerPaciente.email}
                        </span>
                      </div>
                    )}
                    {drawerPaciente.fecha_ingreso && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground flex-shrink-0">
                          Fecha de ingreso
                        </span>
                        <span className="font-medium text-right">
                          {formatFechaIngreso(drawerPaciente.fecha_ingreso)}
                        </span>
                      </div>
                    )}
                    {drawerPaciente.laboratorio && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          Laboratorio
                        </span>
                        <span className="font-medium">
                          {drawerPaciente.laboratorio}
                        </span>
                      </div>
                    )}
                    {drawerPaciente.tiempo_cita_min != null && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          Duracion de cita
                        </span>
                        <span className="font-medium tabular-nums">
                          {drawerPaciente.tiempo_cita_min} min
                        </span>
                      </div>
                    )}
                    {drawerPaciente.estudios_pendientes > 0 && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          Estudios pendientes
                        </span>
                        <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-400">
                          {drawerPaciente.estudios_pendientes}
                        </span>
                      </div>
                    )}
                    {drawerPaciente.notas && (
                      <div className="pt-1 border-t border-border">
                        <p className="text-muted-foreground text-xs mb-1">
                          Notas
                        </p>
                        <p className="text-sm italic text-muted-foreground leading-relaxed">
                          {drawerPaciente.notas}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* -------------------------------------------------------- */}
                {/* Medicos asignados                                          */}
                {/* -------------------------------------------------------- */}
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Medicos
                  </p>
                  {drawerDoctores.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin doctores asignados.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {drawerDoctores.map((doc, idx) => (
                        <div
                          key={doc.id}
                          className="flex items-start gap-2.5 rounded-lg border border-border p-3"
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-medium mt-0.5",
                              idx === 0
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {idx === 0 ? "P" : String(idx)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{doc.nombre}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {idx === 0
                                ? "Principal"
                                : `Respaldo ${idx}`}
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
                  )}
                </div>

                {/* -------------------------------------------------------- */}
                {/* Citas                                                      */}
                {/* -------------------------------------------------------- */}
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Citas
                    {drawerCitas.length > 0 ? ` (${drawerCitas.length})` : ""}
                  </p>
                  {drawerCitas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin citas registradas.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {drawerCitas.map((cita) => {
                        const proxima = esProxima(cita.fecha_hora)
                        return (
                          <div
                            key={cita.id}
                            className={cn(
                              "rounded-lg border p-3 space-y-1.5",
                              proxima
                                ? "border-blue-200 bg-blue-50/40 dark:border-blue-800/40 dark:bg-blue-950/20"
                                : "border-border"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium leading-tight">
                                {cita.servicio?.nombre ?? "Cita sin servicio"}
                              </p>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium flex-shrink-0",
                                  STATUS_CITA_ESTILO[cita.status] ??
                                    "bg-muted text-muted-foreground"
                                )}
                              >
                                {STATUS_LABELS[cita.status] ?? cita.status}
                              </span>
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
                            {cita.costo != null && (
                              <p className="text-xs text-muted-foreground tabular-nums">
                                $
                                {Number(cita.costo).toLocaleString("es-MX", {
                                  minimumFractionDigits: 0,
                                })}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* -------------------------------------------------------- */}
                {/* Trayectoria                                                */}
                {/* -------------------------------------------------------- */}
                {drawerTimeline.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-3">
                      Trayectoria
                    </p>
                    <div>
                      {drawerTimeline.map((evento, idx) => (
                        <ItemTimeline
                          key={evento.key}
                          evento={evento}
                          isLast={idx === drawerTimeline.length - 1}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* Enlace a ficha completa                                    */}
                {/* -------------------------------------------------------- */}
                <Link
                  href={`/pacientes/${drawerPaciente.id}`}
                  className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  <ExternalLink size={14} />
                  Abrir ficha completa
                </Link>

              </div>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>

      {/* ------------------------------------------------------------------ */}
      {/* Formulario crear / editar paciente — mobile: dialog, desktop: sheet*/}
      {/* ------------------------------------------------------------------ */}
      {(() => {
        const titulo = pacienteEditando ? "Editar paciente" : "Nuevo paciente"

        const camposForm = (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
            {/* Nombre */}
            <div className="space-y-1.5">
              <Label>
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Nombre completo"
                value={formPaciente.nombre}
                onChange={(e) =>
                  actualizarCampoPaciente("nombre", e.target.value)
                }
              />
            </div>

            {/* Telefono y Email */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Telefono</Label>
                <Input
                  placeholder="55 1234 5678"
                  value={formPaciente.telefono}
                  onChange={(e) =>
                    actualizarCampoPaciente("telefono", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={formPaciente.email}
                  onChange={(e) =>
                    actualizarCampoPaciente("email", e.target.value)
                  }
                />
              </div>
            </div>

            {/* Fecha de ingreso y Laboratorio */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fecha de ingreso</Label>
                <Input
                  type="date"
                  value={formPaciente.fecha_ingreso}
                  onChange={(e) =>
                    actualizarCampoPaciente("fecha_ingreso", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Laboratorio</Label>
                <Input
                  placeholder="Nombre del laboratorio"
                  value={formPaciente.laboratorio}
                  onChange={(e) =>
                    actualizarCampoPaciente("laboratorio", e.target.value)
                  }
                />
              </div>
            </div>

            {/* Tiempo de cita */}
            <div className="space-y-1.5">
              <Label>Duracion estandar de cita (minutos)</Label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="45"
                value={formPaciente.tiempo_cita_min}
                onChange={(e) =>
                  actualizarCampoPaciente("tiempo_cita_min", e.target.value)
                }
                className="max-w-[180px]"
              />
            </div>

            {/* Canal */}
            <div className="space-y-1.5">
              <Label>Canal de mensajeria</Label>
              <Select
                value={formPaciente.channel}
                onValueChange={(v) => actualizarCampoPaciente("channel", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Channel user ID */}
            <div className="space-y-1.5">
              <Label>ID de canal</Label>
              <Input
                placeholder="ID del usuario en Telegram o WhatsApp"
                value={formPaciente.channel_user_id}
                onChange={(e) =>
                  actualizarCampoPaciente("channel_user_id", e.target.value)
                }
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Requerido para enviar recordatorios y mensajes automaticos.
              </p>
            </div>

            {/* Asignacion de doctores */}
            {doctores.length > 0 && (
              <div className="space-y-3">
                <Label className="block">Asignacion de doctores</Label>
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      Doctor principal
                    </p>
                    <Select
                      value={formPaciente.doctor_principal || "_none"}
                      onValueChange={(v) =>
                        actualizarCampoPaciente(
                          "doctor_principal",
                          v === "_none" ? "" : v
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sin asignar</SelectItem>
                        {doctores.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Respaldo 1</p>
                    <Select
                      value={formPaciente.doctor_respaldo1 || "_none"}
                      onValueChange={(v) =>
                        actualizarCampoPaciente(
                          "doctor_respaldo1",
                          v === "_none" ? "" : v
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sin asignar</SelectItem>
                        {doctores.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Respaldo 2</p>
                    <Select
                      value={formPaciente.doctor_respaldo2 || "_none"}
                      onValueChange={(v) =>
                        actualizarCampoPaciente(
                          "doctor_respaldo2",
                          v === "_none" ? "" : v
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Sin asignar</SelectItem>
                        {doctores.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Notas */}
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea
                placeholder="Alergias, condiciones relevantes, preferencias..."
                value={formPaciente.notas}
                onChange={(e) =>
                  actualizarCampoPaciente("notas", e.target.value)
                }
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
              onClick={() => setFormPacienteOpen(false)}
            >
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleGuardarPaciente} disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        )

        return (
          <>
            {/* Dialog — solo movil */}
            <Dialog open={formPacienteOpen && !isDesktop} onOpenChange={setFormPacienteOpen}>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{titulo}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">{camposForm}</div>
                <DialogFooter>{botonesForm}</DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Sheet lateral derecho — solo escritorio */}
            <Sheet
              open={formPacienteOpen && isDesktop}
              onOpenChange={(o) => { if (!o) setFormPacienteOpen(false) }}
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
                  <SheetTitle>{titulo}</SheetTitle>
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

      {/* Dialog — agendar cita */}
      <Dialog open={agendarOpen} onOpenChange={setAgendarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar cita</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Paciente (solo lectura) */}
            <div className="space-y-1.5">
              <Label>Paciente</Label>
              <p className="text-sm font-medium px-3 py-2 rounded-md bg-muted">
                {agendarNombre}
              </p>
            </div>

            {/* Servicio */}
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
                  {servicios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha y hora */}
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

            {/* Estado */}
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
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Costo */}
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

            {/* Notas */}
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

      {/* Dialog — confirmar eliminacion */}
      <Dialog
        open={eliminarId !== null}
        onOpenChange={(o) => !o && setEliminarId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar paciente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Esta accion no se puede deshacer. Si el paciente tiene citas o
            conversaciones asociadas, no podra eliminarse.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEliminarId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmarEliminar}
              disabled={isPending}
            >
              {isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
