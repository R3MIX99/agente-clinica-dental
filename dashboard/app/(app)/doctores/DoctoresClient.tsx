"use client"

import { useState, useEffect, useTransition, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { crearDoctor, actualizarDoctor, eliminarDoctor } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Plus, Search, SquarePen, Trash2, X } from "lucide-react"

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

type FormDoctor = {
  nombre: string
  email: string
  fecha_ingreso: string
  especialidades: string[]
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

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function DoctoresClient({ doctores: doctoresIniciales }: { doctores: Doctor[] }) {
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

  useEffect(() => {
    setDoctores(doctoresIniciales)
  }, [doctoresIniciales])

  const doctoresFiltrados = busqueda.trim()
    ? doctores.filter((d) =>
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
        toast.error(e instanceof Error ? e.message : "Error al guardar el doctor")
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
        toast.error(e instanceof Error ? e.message : "Error al eliminar el doctor")
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
        <h1 className="text-xl font-semibold">Doctores</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
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
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nombre o correo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {["Nombre", "Especialidades", "Correo", "Fecha de ingreso", "Acciones"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
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

      {/* Dialog — crear / editar */}
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

      {/* Dialog — confirmar eliminacion */}
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
