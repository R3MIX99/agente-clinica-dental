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
import { toast } from "sonner"
import { CalendarPlus, Search, SquarePen, Trash2 } from "lucide-react"

// ---------------------------------------------------------------------------
// Tipos
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

// ---------------------------------------------------------------------------
// Componente
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

  useEffect(() => {
    setPacientes(pacientesIniciales)
  }, [pacientesIniciales])

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
      tiempo_cita_min: p.tiempo_cita_min != null ? String(p.tiempo_cita_min) : "",
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
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pacientes</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
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
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nombre o telefono..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[1120px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {[
                "Nombre",
                "Telefono",
                "Proxima cita",
                "Doctor asignado",
                "Laboratorio",
                "Est. pendientes",
                "Agendar cita",
                "Canal",
                "Tiempo cita",
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
            {pacientesFiltrados.length === 0 && (
              <tr>
                <td
                  colSpan={10}
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

                {/* Telefono */}
                <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                  {p.telefono ?? "—"}
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

                {/* Doctor asignado */}
                <td className="px-4 py-3 whitespace-nowrap">
                  {p.doctor_principal ? (
                    <span>{p.doctor_principal.nombre}</span>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">
                      Sin asignar
                    </span>
                  )}
                </td>

                {/* Laboratorio */}
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {p.laboratorio ?? "—"}
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

                {/* Agendar cita */}
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => abrirAgendarCita(p)}
                    className="h-7 text-xs gap-1.5"
                  >
                    <CalendarPlus size={13} />
                    Agendar
                  </Button>
                </td>

                {/* Canal */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {CANAL_LABEL[p.channel] ?? p.channel}
                  </span>
                </td>

                {/* Tiempo cita */}
                <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                  {p.tiempo_cita_min != null ? `${p.tiempo_cita_min} min` : "—"}
                </td>

                {/* Acciones */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
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

      {/* Dialog — crear / editar paciente */}
      <Dialog open={formPacienteOpen} onOpenChange={setFormPacienteOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {pacienteEditando ? "Editar paciente" : "Nuevo paciente"}
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
                value={formPaciente.nombre}
                onChange={(e) => actualizarCampoPaciente("nombre", e.target.value)}
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

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setFormPacienteOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleGuardarPaciente} disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
