"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { agregarBloqueHorario, eliminarBloqueHorario } from "./actions"
import { actualizarDoctor } from "../actions"
import type { DatosDoctor } from "../actions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { toast } from "sonner"
import { ArrowLeft, Plus, SquarePen, Trash2, X } from "lucide-react"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Doctor = {
  id: string
  nombre: string
  email: string | null
  especialidades: string[] | null
  fecha_ingreso: string | null
  created_at: string | null
}

type Horario = {
  id: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  created_at: string
}

type CitaDoctor = {
  id: string
  fecha_hora: string
  status: string
  notas: string | null
  paciente: { id: string; nombre: string } | null
  servicio: { id: string; nombre: string; duracion_min: number | null } | null
}

interface Props {
  doctor: Doctor
  horarios: Horario[]
  citas: CitaDoctor[]
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

// Orden: Lunes … Sabado … Domingo
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFechaIngreso(raw: string): string {
  const [y, m, d] = raw.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function formatHora(raw: string): string {
  // raw puede ser "HH:MM:SS" o "HH:MM"
  return raw.slice(0, 5)
}

function formatFechaCita(raw: string): string {
  const d = new Date(raw)
  return d.toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatHoraCita(raw: string): string {
  const d = new Date(raw)
  return d.toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Agrupa citas por fecha (dia) en America/Mexico_City
function agruparCitasPorDia(
  citas: CitaDoctor[]
): Array<{ fechaKey: string; label: string; citas: CitaDoctor[] }> {
  const grupos = new Map<string, CitaDoctor[]>()
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
// Componente principal
// ---------------------------------------------------------------------------

export function DoctorFichaClient({ doctor, horarios, citas }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Dialog — editar doctor
  const [editarOpen, setEditarOpen] = useState(false)
  const [formDoctor, setFormDoctor] = useState<DatosDoctor>({
    nombre: doctor.nombre,
    email: doctor.email ?? "",
    fecha_ingreso: doctor.fecha_ingreso ?? "",
    especialidades: doctor.especialidades ?? [],
  })
  const [espInput, setEspInput] = useState("")

  // Dialog — agregar bloque horario
  const [horarioOpen, setHorarioOpen] = useState(false)
  const [formHorario, setFormHorario] = useState({
    dia_semana: "1",
    hora_inicio: "09:00",
    hora_fin: "18:00",
  })

  // ---------------------------------------------------------------------------
  // Handlers — editar doctor
  // ---------------------------------------------------------------------------

  function abrirEditar() {
    setFormDoctor({
      nombre: doctor.nombre,
      email: doctor.email ?? "",
      fecha_ingreso: doctor.fecha_ingreso ?? "",
      especialidades: doctor.especialidades ?? [],
    })
    setEspInput("")
    setEditarOpen(true)
  }

  function agregarEspecialidad() {
    const val = espInput.trim()
    if (!val || formDoctor.especialidades.includes(val)) {
      setEspInput("")
      return
    }
    setFormDoctor((prev) => ({
      ...prev,
      especialidades: [...prev.especialidades, val],
    }))
    setEspInput("")
  }

  function quitarEspecialidad(esp: string) {
    setFormDoctor((prev) => ({
      ...prev,
      especialidades: prev.especialidades.filter((e) => e !== esp),
    }))
  }

  function handleGuardarDoctor() {
    if (!formDoctor.nombre.trim()) {
      toast.error("El nombre es requerido")
      return
    }
    startTransition(async () => {
      try {
        await actualizarDoctor(doctor.id, formDoctor)
        toast.success("Doctor actualizado correctamente")
        setEditarOpen(false)
        router.refresh()
      } catch (e: unknown) {
        toast.error(
          e instanceof Error ? e.message : "Error al actualizar el doctor"
        )
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Handlers — horarios
  // ---------------------------------------------------------------------------

  function handleAgregarBloque() {
    startTransition(async () => {
      try {
        await agregarBloqueHorario(doctor.id, formHorario)
        toast.success("Bloque de horario agregado")
        setHorarioOpen(false)
        setFormHorario({ dia_semana: "1", hora_inicio: "09:00", hora_fin: "18:00" })
        router.refresh()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Error al agregar el bloque")
      }
    })
  }

  function handleEliminarBloque(scheduleId: string) {
    startTransition(async () => {
      try {
        await eliminarBloqueHorario(scheduleId, doctor.id)
        toast.success("Bloque eliminado")
        router.refresh()
      } catch (e: unknown) {
        toast.error(
          e instanceof Error ? e.message : "Error al eliminar el bloque"
        )
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Datos derivados
  // ---------------------------------------------------------------------------

  // Agrupar horarios por dia_semana
  const horariosPorDia: Record<number, Horario[]> = {}
  for (let i = 0; i <= 6; i++) horariosPorDia[i] = []
  for (const h of horarios) {
    horariosPorDia[h.dia_semana].push(h)
  }

  const diasConHorario = DIAS_ORDEN.filter(
    (d) => horariosPorDia[d].length > 0
  )
  const citasAgrupadas = agruparCitasPorDia(citas)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Enlace de regreso */}
      <Link
        href="/doctores"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={15} />
        Regresar a doctores
      </Link>

      {/* ------------------------------------------------------------------ */}
      {/* Encabezado                                                           */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">{doctor.nombre}</h1>

              {/* Especialidades */}
              {doctor.especialidades && doctor.especialidades.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {doctor.especialidades.map((esp) => (
                    <span
                      key={esp}
                      className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {esp}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-1 text-sm text-muted-foreground">
                {doctor.email && (
                  <p>
                    <span className="font-medium text-foreground/70">
                      Correo:{" "}
                    </span>
                    {doctor.email}
                  </p>
                )}
                {doctor.fecha_ingreso && (
                  <p>
                    <span className="font-medium text-foreground/70">
                      Fecha de ingreso a la clinica:{" "}
                    </span>
                    {formatFechaIngreso(doctor.fecha_ingreso)}
                  </p>
                )}
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={abrirEditar}
              className="gap-1.5 sm:flex-shrink-0"
            >
              <SquarePen size={14} />
              Editar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Tabs                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Tabs defaultValue="horarios">
        <TabsList>
          <TabsTrigger value="horarios">Horarios</TabsTrigger>
          <TabsTrigger value="citas">
            Citas proximas{citas.length > 0 ? ` (${citas.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        {/* Tab — Horarios                                                     */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="horarios" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-medium">
                Disponibilidad semanal
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setHorarioOpen(true)}
                className="h-7 text-xs gap-1.5"
              >
                <Plus size={13} />
                Agregar bloque
              </Button>
            </CardHeader>
            <CardContent>
              {horarios.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sin horarios configurados. Agrega bloques de disponibilidad.
                </p>
              ) : (
                <div className="space-y-4">
                  {diasConHorario.map((dia, idx) => (
                    <div key={dia}>
                      {idx > 0 && <Separator className="mb-4" />}
                      <div className="flex items-start gap-4">
                        <p className="text-sm font-medium w-24 pt-1 flex-shrink-0">
                          {DIA_NOMBRE[dia]}
                        </p>
                        <div className="flex-1 space-y-2">
                          {horariosPorDia[dia]
                            .sort((a, b) =>
                              a.hora_inicio.localeCompare(b.hora_inicio)
                            )
                            .map((h) => (
                              <div
                                key={h.id}
                                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                              >
                                <span className="text-sm tabular-nums">
                                  {formatHora(h.hora_inicio)} –{" "}
                                  {formatHora(h.hora_fin)}
                                </span>
                                <button
                                  onClick={() => handleEliminarBloque(h.id)}
                                  disabled={isPending}
                                  title="Eliminar bloque"
                                  className="p-1 rounded text-muted-foreground hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Tab — Citas proximas                                               */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="citas" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">
                Citas proximas asignadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {citasAgrupadas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sin citas proximas asignadas a este doctor.
                </p>
              ) : (
                <div className="space-y-6">
                  {citasAgrupadas.map((grupo) => (
                    <div key={grupo.fechaKey}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        {grupo.label}
                      </p>
                      <div className="space-y-2">
                        {grupo.citas.map((cita) => (
                          <div
                            key={cita.id}
                            className="flex items-center gap-4 rounded-lg border border-border px-4 py-3"
                          >
                            {/* Hora */}
                            <p className="text-sm tabular-nums font-medium w-14 flex-shrink-0">
                              {formatHoraCita(cita.fecha_hora)}
                            </p>

                            <Separator
                              orientation="vertical"
                              className="h-8"
                            />

                            {/* Paciente y servicio */}
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

                            {/* Estado */}
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium flex-shrink-0",
                                STATUS_ESTILO[cita.status] ??
                                  "bg-muted text-muted-foreground"
                              )}
                            >
                              {cita.status === "programada"
                                ? "Programada"
                                : "Confirmada"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog — editar doctor                                               */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={editarOpen} onOpenChange={setEditarOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar doctor</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formDoctor.nombre}
                onChange={(e) =>
                  setFormDoctor((prev) => ({ ...prev, nombre: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Correo electronico</Label>
                <Input
                  type="email"
                  value={formDoctor.email}
                  onChange={(e) =>
                    setFormDoctor((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de ingreso</Label>
                <Input
                  type="date"
                  value={formDoctor.fecha_ingreso}
                  onChange={(e) =>
                    setFormDoctor((prev) => ({
                      ...prev,
                      fecha_ingreso: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Especialidades</Label>
              <div className="flex gap-2">
                <Input
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
              {formDoctor.especialidades.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {formDoctor.especialidades.map((esp) => (
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
            <Button variant="ghost" onClick={() => setEditarOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarDoctor} disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Dialog — agregar bloque de horario                                   */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={horarioOpen} onOpenChange={setHorarioOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar bloque de horario</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Dia de la semana</Label>
              <Select
                value={formHorario.dia_semana}
                onValueChange={(v) =>
                  setFormHorario((prev) => ({ ...prev, dia_semana: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_ORDEN.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {DIA_NOMBRE[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Hora de inicio</Label>
                <Input
                  type="time"
                  value={formHorario.hora_inicio}
                  onChange={(e) =>
                    setFormHorario((prev) => ({
                      ...prev,
                      hora_inicio: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hora de fin</Label>
                <Input
                  type="time"
                  value={formHorario.hora_fin}
                  onChange={(e) =>
                    setFormHorario((prev) => ({
                      ...prev,
                      hora_fin: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setHorarioOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAgregarBloque} disabled={isPending}>
              {isPending ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
