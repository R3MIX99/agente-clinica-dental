"use client"

import { useState, useTransition } from "react"
import { isRedirectError } from "next/dist/client/components/redirect-error"
import Link from "next/link"
import { Stethoscope, Loader2, Plus, Trash2, ChevronRight, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  guardarDatosClinica,
  guardarServicios,
  guardarFAQ,
  invitarMiembros,
  completarOnboarding,
} from "@/app/actions/onboarding"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Horario = { día: string; activo: boolean; apertura: string; cierre: string }
type Servicio = { nombre: string; precio: string; duracion_min: string; }
type Miembro = { nombre: string; email: string; rol: "doctor" | "supervisor" }

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sabado", "Domingo"]
const PASO_TOTAL = 5

const PASOS = [
  { titulo: "Datos de la clinica", descripcion: "Completa la información de contacto de tu clinica." },
  { titulo: "Horarios de atención", descripcion: "Configura los días y horarios en que atiendes." },
  { titulo: "Servicios", descripcion: "Agrega los primeros servicios que ofreces." },
  { titulo: "FAQ del asistente", descripcion: "Define las preguntas frecuentes que el agente sabra responder." },
  { titulo: "Invitar equipo", descripcion: "Agrega doctores y colaboradores a tu clinica." },
]

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function OnboardingWizard({
  nombreUsuario,
  clinicaInicial,
  serviciosIniciales,
}: {
  nombreUsuario: string
  clinicaInicial: {
    nombre: string
    telefono: string
    email: string
    direccion: string
    sitio_web: string
    horario: string
  }
  serviciosIniciales: Servicio[]
}) {
  const [paso, setPaso] = useState(1)
  const [isPending, startTransition] = useTransition()

  // ---- Estado paso 1 ----
  const [tel, setTel] = useState(clinicaInicial.telefono)
  const [emailClinica, setEmailClinica] = useState(clinicaInicial.email)
  const [dir, setDir] = useState(clinicaInicial.direccion)
  const [web, setWeb] = useState(clinicaInicial.sitio_web)

  // ---- Estado paso 2 ----
  const [horarios, setHorarios] = useState<Horario[]>(
    DIAS.map((día) => ({
      día,
      activo: !["Sabado", "Domingo"].includes(día),
      apertura: "09:00",
      cierre: "18:00",
    }))
  )

  // ---- Estado paso 3 ----
  const [servicios, setServicios] = useState<Servicio[]>(
    serviciosIniciales.length > 0
      ? serviciosIniciales
      : [{ nombre: "Consulta general", precio: "0", duracion_min: "30" }]
  )

  // ---- Estado paso 4 ----
  const [faq, setFaq] = useState(
    "¿Atienden seguros medicos?\nR: En este momento no manejamos seguros. Trabajamos con pago directo.\n\n¿Cual es el tiempo de espera para agendar?\nR: Generalmente podemos recibirte dentro de los próximos 2 a 5 días habiles.\n\n¿Que formas de pago aceptan?\nR: Aceptamos efectivo y transferencia bancaria."
  )

  // ---- Estado paso 5 ----
  const [miembros, setMiembros] = useState<Miembro[]>([])

  // ---------------------------------------------------------------------------
  // Guardar y avanzar
  // ---------------------------------------------------------------------------

  function avanzar() {
    if (paso < PASO_TOTAL) setPaso(paso + 1)
  }

  function omitir() {
    avanzar()
  }

  function guardarPaso1() {
    startTransition(async () => {
      try {
        const horarioTexto = horarios
          .filter((h) => h.activo)
          .map((h) => `${h.día} ${h.apertura}–${h.cierre}`)
          .join(", ")
        await guardarDatosClinica({
          telefono: tel,
          email: emailClinica,
          direccion: dir,
          sitio_web: web,
          horario: horarioTexto,
        })
        avanzar()
      } catch {
        toast.error("Error al guardar los datos. Intentalo de nuevo.")
      }
    })
  }

  function guardarPaso2() {
    startTransition(async () => {
      try {
        const horarioTexto = horarios
          .filter((h) => h.activo)
          .map((h) => `${h.día} ${h.apertura}–${h.cierre}`)
          .join(", ")
        await guardarDatosClinica({ horario: horarioTexto })
        avanzar()
      } catch {
        toast.error("Error al guardar los horarios. Intentalo de nuevo.")
      }
    })
  }

  function guardarPaso3() {
    startTransition(async () => {
      try {
        await guardarServicios(servicios.filter((s) => s.nombre.trim()))
        avanzar()
      } catch {
        toast.error("Error al guardar los servicios. Intentalo de nuevo.")
      }
    })
  }

  function guardarPaso4() {
    startTransition(async () => {
      try {
        await guardarFAQ(faq)
        avanzar()
      } catch {
        toast.error("Error al guardar la FAQ. Intentalo de nuevo.")
      }
    })
  }

  function finalizar() {
    startTransition(async () => {
      try {
        if (miembros.filter((m) => m.email.trim()).length > 0) {
          await invitarMiembros(miembros.filter((m) => m.email.trim()))
        }
        await completarOnboarding()
      } catch (e) {
        // redirect() lanza un error especial que Next.js maneja internamente — no es un error real
        if (isRedirectError(e)) throw e
        toast.error("Error al finalizar la configuración. Intentalo de nuevo.")
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const { titulo, descripcion } = PASOS[paso - 1]

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background px-4 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold text-foreground">DentalIA</span>
          </div>
          <button
            type="button"
            onClick={() => { startTransition(async () => { await completarOnboarding() }) }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            disabled={isPending}
          >
            Omitir configuración
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          {/* Saludo (solo primer paso) */}
          {paso === 1 && (
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground">
                Bienvenido, {nombreUsuario.split(" ")[0]}
              </h1>
              <p className="mt-1 text-muted-foreground">
                Configuremos tu clinica en pocos pasos. Puedes omitir cualquier paso y completarlo despues.
              </p>
            </div>
          )}

          {/* Barra de progreso */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-foreground">
                Paso {paso} de {PASO_TOTAL} — {titulo}
              </p>
              <p className="text-xs text-muted-foreground">{Math.round((paso / PASO_TOTAL) * 100)}%</p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(paso / PASO_TOTAL) * 100}%` }}
              />
            </div>
            {/* Indicadores de paso */}
            <div className="mt-2 flex justify-between">
              {PASOS.map((_, i) => (
                <div
                  key={i}
                  className={[
                    "h-1.5 rounded-full flex-1 mx-0.5",
                    i + 1 < paso ? "bg-primary" : i + 1 === paso ? "bg-primary/60" : "bg-muted",
                  ].join(" ")}
                />
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{titulo}</CardTitle>
              <CardDescription>{descripcion}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* ---- Paso 1: Datos de la clinica ---- */}
              {paso === 1 && (
                <div className="space-y-4">
                  <CampoOnb
                    id="tel"
                    label="Teléfono de la clinica"
                    value={tel}
                    onChange={setTel}
                    placeholder="55 1234 5678"
                    type="tel"
                  />
                  <CampoOnb
                    id="emailClinica"
                    label="Correo electrónico de la clinica"
                    value={emailClinica}
                    onChange={setEmailClinica}
                    placeholder="contacto@miclinica.com"
                    type="email"
                  />
                  <CampoOnb
                    id="dir"
                    label="Dirección"
                    value={dir}
                    onChange={setDir}
                    placeholder="Calle, colonia, ciudad"
                  />
                  <CampoOnb
                    id="web"
                    label="Sitio web (opcional)"
                    value={web}
                    onChange={setWeb}
                    placeholder="https://miclinica.com"
                    type="url"
                  />
                  <BotonesNavegacion
                    paso={paso}
                    isPending={isPending}
                    onAtras={() => setPaso(paso - 1)}
                    onOmitir={omitir}
                    onContinuar={guardarPaso1}
                  />
                </div>
              )}

              {/* ---- Paso 2: Horarios ---- */}
              {paso === 2 && (
                <div className="space-y-3">
                  {horarios.map((h, i) => (
                    <div key={h.día} className="flex items-center gap-3">
                      <Switch
                        checked={h.activo}
                        onCheckedChange={(v) => {
                          const copia = [...horarios]
                          copia[i] = { ...copia[i], activo: v }
                          setHorarios(copia)
                        }}
                        id={`día-${h.día}`}
                      />
                      <Label htmlFor={`día-${h.día}`} className="w-24 text-sm">
                        {h.día}
                      </Label>
                      {h.activo ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="time"
                            value={h.apertura}
                            onChange={(e) => {
                              const copia = [...horarios]
                              copia[i] = { ...copia[i], apertura: e.target.value }
                              setHorarios(copia)
                            }}
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                          />
                          <span className="text-muted-foreground text-sm">a</span>
                          <input
                            type="time"
                            value={h.cierre}
                            onChange={(e) => {
                              const copia = [...horarios]
                              copia[i] = { ...copia[i], cierre: e.target.value }
                              setHorarios(copia)
                            }}
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Cerrado</span>
                      )}
                    </div>
                  ))}
                  <BotonesNavegacion
                    paso={paso}
                    isPending={isPending}
                    onAtras={() => setPaso(paso - 1)}
                    onOmitir={omitir}
                    onContinuar={guardarPaso2}
                  />
                </div>
              )}

              {/* ---- Paso 3: Servicios ---- */}
              {paso === 3 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                    <span className="col-span-8">Servicio</span>
                    <span className="col-span-3">Duración min</span>
                    <span className="col-span-1" />
                  </div>
                  {servicios.map((s, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        className="col-span-8 h-8 text-sm"
                        value={s.nombre}
                        onChange={(e) => {
                          const copia = [...servicios]
                          copia[i] = { ...copia[i], nombre: e.target.value }
                          setServicios(copia)
                        }}
                        placeholder="Nombre del servicio"
                      />
                      <Input
                        className="col-span-3 h-8 text-sm"
                        type="number"
                        value={s.duracion_min}
                        onChange={(e) => {
                          const copia = [...servicios]
                          copia[i] = { ...copia[i], duracion_min: e.target.value }
                          setServicios(copia)
                        }}
                        placeholder="30"
                      />
                      <button
                        type="button"
                        onClick={() => setServicios(servicios.filter((_, j) => j !== i))}
                        className="col-span-1 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Eliminar servicio"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  {servicios.length < 10 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setServicios([...servicios, { nombre: "", precio: "0", duracion_min: "30" }])}
                    >
                      <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                      Agregar servicio
                    </Button>
                  )}
                  <BotonesNavegacion
                    paso={paso}
                    isPending={isPending}
                    onAtras={() => setPaso(paso - 1)}
                    onOmitir={omitir}
                    onContinuar={guardarPaso3}
                  />
                </div>
              )}

              {/* ---- Paso 4: FAQ ---- */}
              {paso === 4 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="faq">
                      Preguntas frecuentes y respuestas
                    </Label>
                    <Textarea
                      id="faq"
                      value={faq}
                      onChange={(e) => setFaq(e.target.value)}
                      rows={10}
                      className="text-sm font-mono resize-none"
                      placeholder="Escribe aquí las preguntas y respuestas que el agente usara..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Escribe en formato pregunta/respuesta. El agente usara este contenido para responder a tus pacientes.
                    </p>
                  </div>
                  <BotonesNavegacion
                    paso={paso}
                    isPending={isPending}
                    onAtras={() => setPaso(paso - 1)}
                    onOmitir={omitir}
                    onContinuar={guardarPaso4}
                  />
                </div>
              )}

              {/* ---- Paso 5: Equipo ---- */}
              {paso === 5 && (
                <div className="space-y-4">
                  {miembros.length > 0 && (
                    <div className="space-y-3">
                      {miembros.map((m, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <div className="flex-1 grid grid-cols-3 gap-2">
                            <Input
                              className="h-8 text-sm"
                              value={m.nombre}
                              onChange={(e) => {
                                const c = [...miembros]
                                c[i] = { ...c[i], nombre: e.target.value }
                                setMiembros(c)
                              }}
                              placeholder="Nombre"
                            />
                            <Input
                              className="h-8 text-sm"
                              type="email"
                              value={m.email}
                              onChange={(e) => {
                                const c = [...miembros]
                                c[i] = { ...c[i], email: e.target.value }
                                setMiembros(c)
                              }}
                              placeholder="correo@ejemplo.com"
                            />
                            <select
                              value={m.rol}
                              onChange={(e) => {
                                const c = [...miembros]
                                c[i] = { ...c[i], rol: e.target.value as "doctor" | "supervisor" }
                                setMiembros(c)
                              }}
                              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                            >
                              <option value="doctor">Doctor</option>
                              <option value="supervisor">Supervisor</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => setMiembros(miembros.filter((_, j) => j !== i))}
                            className="mt-1 text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Eliminar miembro"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setMiembros([...miembros, { nombre: "", email: "", rol: "doctor" }])
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                    Agregar miembro
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Cada miembro recibira un correo de invitación para crear su acceso.
                  </p>

                  {/* Botones finales */}
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setPaso(paso - 1)}>
                      <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                      Atras
                    </Button>
                    <Button variant="ghost" className="flex-1" onClick={finalizar} disabled={isPending}>
                      Omitir y entrar
                    </Button>
                    <Button className="flex-1" onClick={finalizar} disabled={isPending}>
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          Finalizando...
                        </>
                      ) : (
                        "Finalizar"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function CampoOnb({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function BotonesNavegacion({
  paso,
  isPending,
  onAtras,
  onOmitir,
  onContinuar,
}: {
  paso: number
  isPending: boolean
  onAtras: () => void
  onOmitir: () => void
  onContinuar: () => void
}) {
  return (
    <div className="flex gap-3 pt-2">
      {paso > 1 && (
        <Button variant="outline" onClick={onAtras} className="shrink-0">
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          Atras
        </Button>
      )}
      <Button variant="ghost" onClick={onOmitir} className="flex-1">
        Omitir este paso
      </Button>
      <Button onClick={onContinuar} disabled={isPending} className="flex-1">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Guardando...
          </>
        ) : (
          <>
            Continuar
            <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </>
        )}
      </Button>
    </div>
  )
}
