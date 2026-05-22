"use client"

import { useState, useEffect, useTransition, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { crearDoctor, actualizarDoctor, eliminarDoctor } from "./actions"
import { supabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
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
  ChevronRight,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  SquarePen,
  Trash2,
  X,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Tipos — lista
// ---------------------------------------------------------------------------

type Doctor = {
  id: string
  nombre: string
  email: string | null
  especialidades: string[] | null
  fecha_ingreso: string | null
  created_at: string | null
}

type FormDoctor = {
  nombre: string
  email: string
  fecha_ingreso: string
  especialidades: string[]
}

// ---------------------------------------------------------------------------
// Tipos — drawer (ficha)
// ---------------------------------------------------------------------------

type HorarioFicha = {
  id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}

type CitaDoctorFicha = {
  id: string
  fecha_hora: string
  status: string
  paciente: { id: string; nombre: string } | null
  servicio: { id: string; nombre: string; duracion_min: number | null } | null
}

type PacienteDoctorFicha = {
  id: string
  nombre: string
  telefono: string | null
  orden: number
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const FORM_INICIAL: FormDoctor = {
  nombre: "",
  email: "",
  fecha_ingreso: "",
  especialidades: [],
}

// Lunes a Sabado, luego Domingo
const DIAS_ORDEN = [1, 2, 3, 4, 5, 6, 0]

const DIA_NOMBRE: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miercoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sabado",
}

const STATUS_ESTILO: Record<string, string> = {
  programada:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  confirmada:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
}

const STATUS_LABEL: Record<string, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
}

const ROL_LABEL: Record<number, string> = {
  1: "Principal",
  2: "Respaldo 1",
  3: "Respaldo 2",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFechaIngreso(raw: string): string {
  const [y, m, d] = raw.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatHora(raw: string): string {
  return raw.slice(0, 5)
}

function formatFechaCita(raw: string): string {
  return new Date(raw).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatHoraCita(raw: string): string {
  return new Date(raw).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function agruparCitasPorDia(
  citas: CitaDoctorFicha[]
): Array<{ fechaKey: string; label: string; citas: CitaDoctorFicha[] }> {
  const grupos = new Map<string, CitaDoctorFicha[]>()
  for (const cita of citas) {
    const key = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Mexico_City",
    }).format(new Date(cita.fecha_hora))
    const lista = grupos.get(key) ?? []
    lista.push(cita)
    grupos.set(key, lista)
  }
  return Array.from(grupos.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, lista]) => ({
      fechaKey: key,
      label: formatFechaCita(lista[0].fecha_hora),
      citas: lista,
    }))
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function DoctoresClient({
  doctores: doctoresIniciales,
}: {
  doctores: Doctor[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [doctores, setDoctores] = useState<Doctor[]>(doctoresIniciales)
  const [busqueda, setBusqueda] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [eliminarId, setEliminarId] = useState<string | null>(null)
  const [doctorEditando, setDoctorEditando] = useState<Doctor | null>(null)
  const [form, setForm] = useState<FormDoctor>(FORM_INICIAL)
  const [espInput, setEspInput] = useState("")
  const espInputRef = useRef<HTMLInputElement>(null)

  // Drawer — ficha del doctor (mobile)
  const [drawerDoctor, setDrawerDoctor] = useState<Doctor | null>(null)
  const [drawerCargando, setDrawerCargando] = useState(false)
  const [drawerHorarios, setDrawerHorarios] = useState<HorarioFicha[]>([])
  const [drawerCitas, setDrawerCitas] = useState<CitaDoctorFicha[]>([])
  const [drawerPacientes, setDrawerPacientes] = useState<
    PacienteDoctorFicha[]
  >([])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDoctores(doctoresIniciales)
  }, [doctoresIniciales])

  const doctoresFiltrados = busqueda.trim()
    ? doctores.filter(
        (d) =>
          d.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          (d.email ?? "").toLowerCase().includes(busqueda.toLowerCase())
      )
    : doctores

  // -------------------------------------------------------------------------
  // Handlers — form
  // -------------------------------------------------------------------------

  function abrirFormNuevo() {
    setDoctorEditando(null)
    setForm(FORM_INICIAL)
    setEspInput("")
    setFormOpen(true)
  }

  function abrirFormEdicion(d: Doctor) {
    setDoctorEditando(d)
    setForm({
      nombre: d.nombre,
      email: d.email ?? "",
      fecha_ingreso: d.fecha_ingreso ?? "",
      especialidades: d.especialidades ?? [],
    })
    setEspInput("")
    setFormOpen(true)
  }

  function agregarEspecialidad() {
    const val = espInput.trim()
    if (!val) return
    if (form.especialidades.includes(val)) {
      setEspInput("")
      return
    }
    setForm((prev) => ({
      ...prev,
      especialidades: [...prev.especialidades, val],
    }))
    setEspInput("")
    espInputRef.current?.focus()
  }

  function quitarEspecialidad(esp: string) {
    setForm((prev) => ({
      ...prev,
      especialidades: prev.especialidades.filter((e) => e !== esp),
    }))
  }

  function handleGuardar() {
    if (!form.nombre.trim()) {
      toast.error("El nombre del doctor es requerido")
      return
    }
    startTransition(async () => {
      try {
        if (doctorEditando) {
          await actualizarDoctor(doctorEditando.id, form)
          toast.success("Doctor actualizado correctamente")
        } else {
          await crearDoctor(form)
          toast.success("Doctor creado correctamente")
        }
        setFormOpen(false)
        router.refresh()
      } catch (e: unknown) {
        toast.error(
          e instanceof Error ? e.message : "Error al guardar el doctor"
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
        await eliminarDoctor(id)
        setDoctores((prev) => prev.filter((d) => d.id !== id))
        toast.success("Doctor eliminado")
        router.refresh()
      } catch (e: unknown) {
        toast.error(
          e instanceof Error ? e.message : "Error al eliminar el doctor"
        )
      }
    })
  }

  // -------------------------------------------------------------------------
  // Handler — abrir drawer (mobile)
  // -------------------------------------------------------------------------

  async function abrirDrawer(d: Doctor) {
    setDrawerDoctor(d)
    setDrawerCargando(true)
    setDrawerHorarios([])
    setDrawerCitas([])
    setDrawerPacientes([])

    const ahora = new Date().toISOString()

    try {
      const [
        { data: horariosFetch },
        { data: citasRaw },
        { data: pacientesRaw },
      ] = await Promise.all([
        supabase
          .from("doctor_schedules")
          .select("id, dia_semana, hora_inicio, hora_fin")
          .eq("doctor_id", d.id)
          .order("dia_semana")
          .order("hora_inicio"),
        supabase
          .from("appointments")
          .select(
            "id, fecha_hora, status, patients(id, nombre), services(id, nombre, duracion_min)"
          )
          .eq("doctor_id", d.id)
          .gte("fecha_hora", ahora)
          .in("status", ["programada", "confirmada"])
          .order("fecha_hora"),
        supabase
          .from("patient_doctors")
          .select("orden, patients(id, nombre, telefono)")
          .eq("doctor_id", d.id),
      ])

      setDrawerHorarios(
        (horariosFetch ?? []).map((h) => ({
          id: h.id,
          dia_semana: h.dia_semana,
          hora_inicio: h.hora_inicio,
          hora_fin: h.hora_fin,
        }))
      )

      const citasNorm: CitaDoctorFicha[] = (citasRaw ?? []).map((c) => ({
        id: c.id,
        fecha_hora: c.fecha_hora,
        status: c.status,
        paciente: c.patients as { id: string; nombre: string } | null,
        servicio: c.services as {
          id: string
          nombre: string
          duracion_min: number | null
        } | null,
      }))
      setDrawerCitas(citasNorm)

      const pacientesNorm: PacienteDoctorFicha[] = (pacientesRaw ?? [])
        .map((pd) => {
          const p = pd.patients as {
            id: string
            nombre: string
            telefono: string | null
          } | null
          if (!p) return null
          return {
            id: p.id,
            nombre: p.nombre,
            telefono: p.telefono,
            orden: pd.orden,
          }
        })
        .filter((x): x is PacienteDoctorFicha => x !== null)
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
      setDrawerPacientes(pacientesNorm)
    } catch {
      // Si falla la carga el usuario puede ir a la ficha completa
    } finally {
      setDrawerCargando(false)
    }
  }

  // Datos derivados para el drawer
  const horariosPorDia: Record<number, HorarioFicha[]> = {}
  for (let i = 0; i <= 6; i++) horariosPorDia[i] = []
  for (const h of drawerHorarios) {
    horariosPorDia[h.dia_semana].push(h)
  }
  const diasConHorario = DIAS_ORDEN.filter((d) => horariosPorDia[d].length > 0)
  const citasAgrupadas = agruparCitasPorDia(drawerCitas)

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-6 pb-20 md:pb-5 space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Doctores</h1>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-muted-foreground">
            {doctoresFiltrados.length !== doctores.length
              ? `${doctoresFiltrados.length} de ${doctores.length} registros`
              : `${doctores.length} registros`}
          </span>
          <Button size="sm" onClick={abrirFormNuevo}>
            Nuevo doctor
          </Button>
        </div>
      </div>

      {/* Busqueda */}
      <div className="relative w-full md:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nombre o correo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Vista mobile — lista de filas                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="md:hidden">
        {doctoresFiltrados.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {busqueda
              ? "Sin resultados para esa busqueda."
              : "Sin doctores registrados."}
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            {doctoresFiltrados.map((d) => (
              <button
                key={d.id}
                onClick={() => abrirDrawer(d)}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 active:bg-muted/40 transition-colors text-left"
              >
                {/* Nombre */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{d.nombre}</p>
                  {d.email && (
                    <p className="text-xs text-muted-foreground truncate">
                      {d.email}
                    </p>
                  )}
                </div>

                {/* Especialidad + chevron */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {d.especialidades && d.especialidades.length > 0 ? (
                    <span className="text-xs text-muted-foreground text-right max-w-[120px] truncate">
                      {d.especialidades[0]}
                      {d.especialidades.length > 1 && (
                        <span className="text-muted-foreground/60">
                          {" "}+{d.especialidades.length - 1}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">
                      Sin especialidad
                    </span>
                  )}
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
      <div className="hidden md:block rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {[
                "Nombre",
                "Especialidades",
                "Correo",
                "Fecha de ingreso",
                "Acciones",
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
            {doctoresFiltrados.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  {busqueda
                    ? "Sin resultados para esa busqueda."
                    : "Sin doctores registrados."}
                </td>
              </tr>
            )}
            {doctoresFiltrados.map((d) => (
              <tr
                key={d.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                {/* Nombre */}
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <Link
                    href={`/doctores/${d.id}`}
                    className="hover:underline hover:text-primary transition-colors"
                  >
                    {d.nombre}
                  </Link>
                </td>

                {/* Especialidades */}
                <td className="px-4 py-3">
                  {d.especialidades && d.especialidades.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {d.especialidades.map((esp) => (
                        <span
                          key={esp}
                          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          {esp}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">—</span>
                  )}
                </td>

                {/* Correo */}
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {d.email ?? "—"}
                </td>

                {/* Fecha de ingreso */}
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {d.fecha_ingreso ? formatFechaIngreso(d.fecha_ingreso) : "—"}
                </td>

                {/* Acciones */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => abrirFormEdicion(d)}
                      title="Editar doctor"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <SquarePen size={15} />
                    </button>
                    <button
                      onClick={() => setEliminarId(d.id)}
                      title="Eliminar doctor"
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
      {/* Drawer — ficha del doctor (mobile)                                   */}
      {/* ------------------------------------------------------------------ */}
      <Drawer
        open={drawerDoctor !== null}
        onOpenChange={(o) => {
          if (!o) setDrawerDoctor(null)
        }}
        shouldScaleBackground
      >
        <DrawerContent style={{ height: "92svh" }}>
          {/* Encabezado: nombre + iconos de accion */}
          <DrawerHeader className="flex-shrink-0 border-b border-border pb-3 text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <DrawerTitle className="truncate">
                  {drawerDoctor?.nombre}
                </DrawerTitle>
                {drawerDoctor?.especialidades &&
                  drawerDoctor.especialidades.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {drawerDoctor.especialidades.map((esp) => (
                        <span
                          key={esp}
                          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          {esp}
                        </span>
                      ))}
                    </div>
                  )}
              </div>

              {/* Iconos editar / eliminar */}
              {drawerDoctor && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => {
                      abrirFormEdicion(drawerDoctor)
                      setDrawerDoctor(null)
                    }}
                    title="Editar doctor"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <SquarePen size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setEliminarId(drawerDoctor.id)
                      setDrawerDoctor(null)
                    }}
                    title="Eliminar doctor"
                    className="p-1.5 rounded-md text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Enlace a ficha completa */}
            {drawerDoctor && (
              <Link
                href={`/doctores/${drawerDoctor.id}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
              >
                <ExternalLink size={12} />
                Ver ficha completa
              </Link>
            )}
          </DrawerHeader>

          {/* Contenido desplazable */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {drawerCargando ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : drawerDoctor ? (
              <div className="px-4 pt-4 pb-8 space-y-6">

                {/* -------------------------------------------------------- */}
                {/* Datos del doctor                                           */}
                {/* -------------------------------------------------------- */}
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Datos
                  </p>
                  <div className="space-y-2 text-sm">
                    {drawerDoctor.email && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Correo</span>
                        <span className="font-medium truncate text-right max-w-[200px]">
                          {drawerDoctor.email}
                        </span>
                      </div>
                    )}
                    {drawerDoctor.fecha_ingreso && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground flex-shrink-0">
                          Fecha de ingreso
                        </span>
                        <span className="font-medium text-right">
                          {formatFechaIngreso(drawerDoctor.fecha_ingreso)}
                        </span>
                      </div>
                    )}
                    {!drawerDoctor.email && !drawerDoctor.fecha_ingreso && (
                      <p className="text-sm text-muted-foreground">
                        Sin datos adicionales registrados.
                      </p>
                    )}
                  </div>
                </div>

                {/* -------------------------------------------------------- */}
                {/* Horarios                                                   */}
                {/* -------------------------------------------------------- */}
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Disponibilidad semanal
                  </p>
                  {diasConHorario.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin horarios configurados.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {diasConHorario.map((dia, idx) => (
                        <div key={dia}>
                          {idx > 0 && <Separator className="mb-3" />}
                          <div className="flex items-start gap-3">
                            <p className="text-sm font-medium w-20 flex-shrink-0 pt-0.5">
                              {DIA_NOMBRE[dia]}
                            </p>
                            <div className="flex-1 space-y-1.5">
                              {horariosPorDia[dia]
                                .sort((a, b) =>
                                  a.hora_inicio.localeCompare(b.hora_inicio)
                                )
                                .map((h) => (
                                  <div
                                    key={h.id}
                                    className="rounded-md border border-border px-3 py-1.5"
                                  >
                                    <span className="text-sm tabular-nums">
                                      {formatHora(h.hora_inicio)} –{" "}
                                      {formatHora(h.hora_fin)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* -------------------------------------------------------- */}
                {/* Citas proximas                                             */}
                {/* -------------------------------------------------------- */}
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Citas proximas
                    {drawerCitas.length > 0 ? ` (${drawerCitas.length})` : ""}
                  </p>
                  {citasAgrupadas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin citas proximas asignadas.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {citasAgrupadas.map((grupo) => (
                        <div key={grupo.fechaKey}>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                            {grupo.label}
                          </p>
                          <div className="space-y-2">
                            {grupo.citas.map((cita) => (
                              <div
                                key={cita.id}
                                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                              >
                                <p className="text-sm tabular-nums font-medium w-12 flex-shrink-0">
                                  {formatHoraCita(cita.fecha_hora)}
                                </p>
                                <div className="w-px h-6 bg-border flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {cita.paciente?.nombre ?? "—"}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {cita.servicio?.nombre ?? "Sin servicio"}
                                    {cita.servicio?.duracion_min != null && (
                                      <span className="ml-1">
                                        · {cita.servicio.duracion_min} min
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium flex-shrink-0",
                                    STATUS_ESTILO[cita.status] ??
                                      "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {STATUS_LABEL[cita.status] ?? cita.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* -------------------------------------------------------- */}
                {/* Pacientes asignados                                        */}
                {/* -------------------------------------------------------- */}
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Pacientes asignados
                    {drawerPacientes.length > 0
                      ? ` (${drawerPacientes.length})`
                      : ""}
                  </p>
                  {drawerPacientes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin pacientes asignados.
                    </p>
                  ) : (
                    <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                      {drawerPacientes.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 px-3 py-2.5"
                        >
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/pacientes/${p.id}`}
                              className="text-sm font-medium hover:underline underline-offset-4 truncate block"
                            >
                              {p.nombre}
                            </Link>
                            {p.telefono && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {p.telefono}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {ROL_LABEL[p.orden] ?? "Respaldo"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog — crear / editar doctor                                        */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {doctorEditando ? "Editar doctor" : "Nuevo doctor"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nombre */}
            <div className="space-y-1.5">
              <Label>
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Nombre completo"
                value={form.nombre}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, nombre: e.target.value }))
                }
              />
            </div>

            {/* Email y Fecha ingreso */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Correo electronico</Label>
                <Input
                  type="email"
                  placeholder="doctor@clinica.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de ingreso</Label>
                <Input
                  type="date"
                  value={form.fecha_ingreso}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      fecha_ingreso: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Especialidades */}
            <div className="space-y-2">
              <Label>Especialidades</Label>
              <div className="flex gap-2">
                <Input
                  ref={espInputRef}
                  placeholder="Ej. Ortodoncia"
                  value={espInput}
                  onChange={(e) => setEspInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      agregarEspecialidad()
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={agregarEspecialidad}
                  disabled={!espInput.trim()}
                  className="gap-1"
                >
                  <Plus size={14} />
                  Agregar
                </Button>
              </div>
              {form.especialidades.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.especialidades.map((esp) => (
                    <span
                      key={esp}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {esp}
                      <button
                        type="button"
                        onClick={() => quitarEspecialidad(esp)}
                        className="ml-0.5 rounded-full hover:text-foreground transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar} disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog — confirmar eliminacion                                        */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={eliminarId !== null}
        onOpenChange={(o) => !o && setEliminarId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar doctor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Esta accion no se puede deshacer. Si el doctor tiene citas o
            pacientes asociados, no podra eliminarse.
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
