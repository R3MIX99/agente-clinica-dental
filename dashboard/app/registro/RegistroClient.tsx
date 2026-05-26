"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Stethoscope, Loader2, Check, ChevronRight, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { registrarCuenta } from "@/app/actions/registro"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Plan = {
  id: string
  nombre: string
  precio_mensual_mxn: number | string
  precio_anual_mxn: number | string
}

type Errores = Record<string, string>

const ZONAS_HORARIAS = [
  { value: "America/Mexico_City", label: "Ciudad de Mexico — CST/CDT" },
  { value: "America/Monterrey", label: "Monterrey — CST/CDT" },
  { value: "America/Cancun", label: "Cancun — EST" },
  { value: "America/Chihuahua", label: "Chihuahua — MST/MDT" },
  { value: "America/Hermosillo", label: "Sonora — MST (sin horario de verano)" },
  { value: "America/Tijuana", label: "Tijuana / Baja California — PST/PDT" },
]

// ---------------------------------------------------------------------------
// Validacion por paso
// ---------------------------------------------------------------------------

function validarPaso1(campos: {
  nombre: string
  email: string
  password: string
  passwordConfirm: string
  telefono: string
}): Errores {
  const e: Errores = {}
  if (!campos.nombre.trim()) e.nombre = "El nombre es requerido"
  if (!campos.email.trim()) e.email = "El correo es requerido"
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.email)) e.email = "Ingresa un correo valido"
  if (!campos.password) e.password = "La contrasena es requerida"
  else if (campos.password.length < 8) e.password = "La contrasena debe tener al menos 8 caracteres"
  if (campos.password !== campos.passwordConfirm) e.passwordConfirm = "Las contrasenas no coinciden"
  return e
}

function validarPaso2(campos: { clinicaNombre: string }): Errores {
  const e: Errores = {}
  if (!campos.clinicaNombre.trim()) e.clinicaNombre = "El nombre de la clinica es requerido"
  return e
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RegistroClient({
  planes,
  planIdInicial,
}: {
  planes: Plan[]
  planIdInicial: string | null
}) {
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [errores, setErrores] = useState<Errores>({})
  const [confirmacionPendiente, setConfirmacionPendiente] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Campos paso 1
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [telefono, setTelefono] = useState("")

  // Campos paso 2
  const [clinicaNombre, setClinicaNombre] = useState("")
  const [clinicaTelefono, setClinicaTelefono] = useState("")
  const [clinicaEmail, setClinicaEmail] = useState("")
  const [clinicaDireccion, setClinicaDireccion] = useState("")
  const [zonaHoraria, setZonaHoraria] = useState("America/Mexico_City")

  // Paso 3: seleccion de plan
  const defaultPlan = planIdInicial ?? planes[1]?.id ?? planes[0]?.id ?? ""
  const [planId, setPlanId] = useState(defaultPlan)

  function avanzarPaso1() {
    const e = validarPaso1({ nombre, email, password, passwordConfirm, telefono })
    if (Object.keys(e).length > 0) { setErrores(e); return }
    setErrores({})
    // Pre-rellenar nombre de la clinica con el nombre del usuario si esta vacio
    if (!clinicaNombre) setClinicaNombre(nombre)
    setPaso(2)
  }

  function avanzarPaso2() {
    const e = validarPaso2({ clinicaNombre })
    if (Object.keys(e).length > 0) { setErrores(e); return }
    setErrores({})
    setPaso(3)
  }

  function enviar() {
    if (!planId) { toast.error("Selecciona un plan para continuar"); return }
    startTransition(async () => {
      const resultado = await registrarCuenta({
        nombre,
        email,
        password,
        telefono,
        clinicaNombre,
        clinicaTelefono,
        clinicaEmail,
        clinicaDireccion,
        zonaHoraria,
        planId,
      })
      if (resultado?.error) {
        toast.error(resultado.error)
        return
      }
      if (resultado?.confirmacionPendiente) {
        setConfirmacionPendiente(true)
      }
      // Si hubo redirect, Next.js lo maneja automaticamente
    })
  }

  // ---------------------------------------------------------------------------
  // Estado: correo de confirmacion pendiente
  // ---------------------------------------------------------------------------

  if (confirmacionPendiente) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Revisa tu correo</CardTitle>
            <CardDescription>
              Te enviamos un enlace de confirmacion a{" "}
              <span className="font-medium text-foreground">{email}</span>.
              Haz clic en el enlace para activar tu cuenta y continuar con la configuracion.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-center text-muted-foreground">
              Una vez confirmado, regresa e{" "}
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                inicia sesion
              </Link>{" "}
              para completar la configuracion de tu clinica.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Layout principal
  // ---------------------------------------------------------------------------

  const titulos = [
    "Datos de tu cuenta",
    "Datos de la clinica",
    "Selecciona tu plan",
  ]

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background px-4 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold text-foreground">DentalIA</span>
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Ya tengo cuenta
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          {/* Progreso */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-foreground">
                Paso {paso} de 3 — {titulos[paso - 1]}
              </p>
              <p className="text-xs text-muted-foreground">{paso * 33}%</p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${paso * 33.33}%` }}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{titulos[paso - 1]}</CardTitle>
              {paso === 1 && (
                <CardDescription>
                  Crea tu acceso personal al sistema. Solo uses datos de tu empresa.
                </CardDescription>
              )}
              {paso === 2 && (
                <CardDescription>
                  Define tu primera clinica. Podras completar estos datos despues.
                </CardDescription>
              )}
              {paso === 3 && (
                <CardDescription>
                  Elige el plan que mejor se ajusta a tu clinica. Los 14 primeros dias son gratuitos.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {/* ---- PASO 1: Cuenta ---- */}
              {paso === 1 && (
                <div className="space-y-4">
                  <Campo
                    id="nombre"
                    label="Nombre completo"
                    value={nombre}
                    onChange={setNombre}
                    placeholder="Dr. Ana Garcia"
                    error={errores.nombre}
                  />
                  <Campo
                    id="email"
                    label="Correo electronico"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="ana@miclinica.com"
                    error={errores.email}
                    autoComplete="email"
                  />
                  <Campo
                    id="telefono"
                    label="Telefono (opcional)"
                    type="tel"
                    value={telefono}
                    onChange={setTelefono}
                    placeholder="55 1234 5678"
                  />
                  <Campo
                    id="password"
                    label="Contrasena"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Minimo 8 caracteres"
                    error={errores.password}
                    autoComplete="new-password"
                  />
                  <Campo
                    id="passwordConfirm"
                    label="Confirmar contrasena"
                    type="password"
                    value={passwordConfirm}
                    onChange={setPasswordConfirm}
                    placeholder="Repite tu contrasena"
                    error={errores.passwordConfirm}
                    autoComplete="new-password"
                  />
                  <div className="pt-2">
                    <Button className="w-full" onClick={avanzarPaso1}>
                      Continuar
                      <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ---- PASO 2: Clinica ---- */}
              {paso === 2 && (
                <div className="space-y-4">
                  <Campo
                    id="clinicaNombre"
                    label="Nombre de la clinica"
                    value={clinicaNombre}
                    onChange={setClinicaNombre}
                    placeholder="Clinica Dental Garcia"
                    error={errores.clinicaNombre}
                  />
                  <Campo
                    id="clinicaTelefono"
                    label="Telefono de la clinica (opcional)"
                    type="tel"
                    value={clinicaTelefono}
                    onChange={setClinicaTelefono}
                    placeholder="55 1234 5678"
                  />
                  <Campo
                    id="clinicaEmail"
                    label="Correo de la clinica (opcional)"
                    type="email"
                    value={clinicaEmail}
                    onChange={setClinicaEmail}
                    placeholder="contacto@miclinica.com"
                  />
                  <Campo
                    id="clinicaDireccion"
                    label="Direccion (opcional)"
                    value={clinicaDireccion}
                    onChange={setClinicaDireccion}
                    placeholder="Calle, colonia, ciudad"
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="zonaHoraria">Zona horaria</Label>
                    <select
                      id="zonaHoraria"
                      value={zonaHoraria}
                      onChange={(e) => setZonaHoraria(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {ZONAS_HORARIAS.map((z) => (
                        <option key={z.value} value={z.value}>{z.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setPaso(1)}>
                      <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                      Atras
                    </Button>
                    <Button className="flex-1" onClick={avanzarPaso2}>
                      Continuar
                      <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ---- PASO 3: Plan ---- */}
              {paso === 3 && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {planes.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setPlanId(plan.id)}
                        className={[
                          "rounded-lg border p-4 text-left transition-all",
                          planId === plan.id
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-muted-foreground/50",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-medium text-foreground text-sm">{plan.nombre}</span>
                          {planId === plan.id && (
                            <Check className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                          )}
                        </div>
                        <p className="text-xl font-bold text-foreground">
                          ${Number(plan.precio_mensual_mxn).toLocaleString("es-MX")}
                        </p>
                        <p className="text-xs text-muted-foreground">MXN / mes</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Los primeros 14 dias son gratuitos. No se requiere tarjeta de credito.
                  </p>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setPaso(2)}>
                      <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                      Atras
                    </Button>
                    <Button className="flex-1" onClick={enviar} disabled={isPending}>
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          Creando cuenta...
                        </>
                      ) : (
                        "Crear mi cuenta"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Al registrarte aceptas los terminos de uso. Solo recopilamos los datos necesarios para operar el servicio.
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-componente Campo (evita repeticion)
// ---------------------------------------------------------------------------

function Campo({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  type?: string
  placeholder?: string
  autoComplete?: string
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
        autoComplete={autoComplete}
        aria-invalid={!!error}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
