"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Plus, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  crearUsuarioConPassword, cambiarActivoMiembro, fijarPrecioVencimiento, registrarPago,
  recargarSaldoIA, sumarRecordatorios, cambiarPlan, cambiarEstadoCuenta, activarClinica, conectarTelegram,
  type ClinicaDetalle, type PlanResumen, type MiembroDetalle,
} from "../actions"

const moneda = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "—"

const ROL_LABEL: Record<string, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  doctor: "Doctor",
}

export function ClinicaDetalleClient({
  detalle, planes,
}: {
  detalle: ClinicaDetalle
  planes: PlanResumen[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const s = detalle.suscripcion

  const correr = (fn: () => Promise<{ ok: boolean; error?: string }>, exito: string) => {
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) toast.error(r.error ?? "Ocurrió un error.")
      else { toast.success(exito); router.refresh() }
    })
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <Link href="/superadmin/clinicas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a clínicas
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{detalle.clinica_nombre ?? "Clínica"}</h1>
          <Badge variant={detalle.cuenta_estado === "suspendida" ? "destructive" : "secondary"} className="capitalize">
            {detalle.cuenta_estado}
          </Badge>
          {!detalle.telegram_conectado && <Badge variant="outline">Sin Telegram</Badge>}
          {!detalle.onboarding_completado && <Badge variant="outline">Onboarding pendiente</Badge>}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Dato titulo="Plan" valor={s?.plan_nombre ?? "Sin plan"} />
        <Dato titulo="Precio mensual" valor={s ? moneda(s.precio_efectivo_mxn) : "—"}
          nota={s?.precio_personalizado_mxn != null ? "personalizado" : "del plan"} />
        <Dato titulo="Vencimiento" valor={fechaCorta(s?.fecha_vencimiento ?? null)} />
        <Dato titulo="Saldo IA" valor={s ? moneda(s.saldo_ia_disponible_mxn) : "—"} />
        <Dato titulo="Doctores" valor={s ? `${detalle.doctores} / ${s.max_doctores}` : String(detalle.doctores)} />
        <Dato titulo="Usuarios" valor={s ? `${detalle.usuarios} / ${s.max_usuarios}` : String(detalle.usuarios)} />
        <Dato titulo="Recordatorios" valor={s ? `${s.recordatorios_enviados} / ${s.recordatorios_tope}` : "—"} />
        <Dato titulo="Estado suscripción" valor={s?.estado ?? "—"} />
      </div>

      {/* Equipo */}
      <Seccion titulo="Equipo">
        <EquipoTabla clinicaId={detalle.clinica_id} miembros={detalle.miembros} isPending={isPending}
          onToggle={(uid, activa) => correr(() => cambiarActivoMiembro(detalle.clinica_id, uid, activa), activa ? "Miembro activado." : "Miembro desactivado.")} />
        <CrearUsuario clinicaId={detalle.clinica_id} onListo={() => router.refresh()} />
      </Seccion>

      {/* Facturacion */}
      <Seccion titulo="Facturación">
        <PrecioVencimiento cuentaId={detalle.cuenta_id}
          precioActual={s?.precio_personalizado_mxn ?? null}
          precioPlan={s?.precio_plan_mxn ?? 0}
          vencimientoActual={s?.fecha_vencimiento ?? null}
          onListo={() => router.refresh()} />
        <Separator />
        <RegistrarPago cuentaId={detalle.cuenta_id} sugerido={s?.precio_efectivo_mxn ?? 0} onListo={() => router.refresh()} />
        <Separator />
        <div className="grid gap-4 sm:grid-cols-2">
          <MiniAccion titulo="Recargar saldo de IA" etiqueta="Monto MXN" boton="Recargar" tipo="number"
            onEnviar={(v) => correr(() => recargarSaldoIA(detalle.clinica_id, Number(v)), "Saldo recargado.")} isPending={isPending} />
          <MiniAccion titulo="Sumar recordatorios" etiqueta="Cantidad" boton="Agregar" tipo="number"
            onEnviar={(v) => correr(() => sumarRecordatorios(detalle.clinica_id, Number(v)), "Recordatorios agregados.")} isPending={isPending} />
        </div>
        {detalle.historial.length > 0 && (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Concepto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalle.historial.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{new Date(h.created_at).toLocaleDateString("es-MX")}</TableCell>
                    <TableCell>{h.monto_mxn != null ? moneda(h.monto_mxn) : "—"}</TableCell>
                    <TableCell className="capitalize">{h.metodo ?? "—"}</TableCell>
                    <TableCell>{h.concepto ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Seccion>

      {/* Plan */}
      <Seccion titulo="Plan y límites">
        <CambiarPlan planes={planes} planActual={s?.plan_id ?? null}
          onCambiar={(planId) => correr(() => cambiarPlan(detalle.cuenta_id, planId), "Plan actualizado.")} isPending={isPending} />
      </Seccion>

      {/* Estado */}
      <Seccion titulo="Estado de la cuenta">
        <p className="text-xs text-muted-foreground">
          Estado actual: <span className="font-medium text-foreground capitalize">{detalle.cuenta_estado}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {detalle.cuenta_estado !== "activa" && (
            <Button size="sm" disabled={isPending}
              onClick={() => correr(() => activarClinica(detalle.cuenta_id), "Clínica activada.")}>
              Activar clínica
            </Button>
          )}
          {detalle.cuenta_estado === "suspendida" ? (
            <Button size="sm" variant="outline" disabled={isPending}
              onClick={() => correr(() => cambiarEstadoCuenta(detalle.cuenta_id, "activa"), "Cuenta reactivada.")}>
              Reactivar cuenta
            </Button>
          ) : (
            <Button size="sm" variant="destructive" disabled={isPending}
              onClick={() => correr(() => cambiarEstadoCuenta(detalle.cuenta_id, "suspendida"), "Cuenta suspendida.")}>
              Suspender cuenta
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Suspender restringe el acceso sin borrar datos.</p>
      </Seccion>

      {/* Canal */}
      <Seccion titulo="Telegram">
        <ConectarTelegram clinicaId={detalle.clinica_id} conectado={detalle.telegram_conectado} onListo={() => router.refresh()} />
      </Seccion>

      {/* Backup */}
      <Seccion titulo="Copia de seguridad">
        <p className="text-sm text-muted-foreground">
          La descarga de respaldo (JSON y Excel) se habilitará en la siguiente fase.
        </p>
      </Seccion>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function Dato({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-0.5 text-sm font-semibold capitalize">{valor}</p>
      {nota && <p className="text-[10px] text-muted-foreground">{nota}</p>}
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-background p-4 space-y-3">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {children}
    </section>
  )
}

function EquipoTabla({
  miembros, isPending, onToggle,
}: {
  clinicaId: string
  miembros: MiembroDetalle[]
  isPending: boolean
  onToggle: (userId: string, activa: boolean) => void
}) {
  if (miembros.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay miembros en esta clínica.</p>
  }
  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {miembros.map((m) => (
            <TableRow key={m.user_id}>
              <TableCell className="font-medium">{m.nombre}</TableCell>
              <TableCell className="text-muted-foreground">{m.email ?? "—"}</TableCell>
              <TableCell>{ROL_LABEL[m.rol] ?? m.rol}</TableCell>
              <TableCell>
                <Badge variant={m.activa ? "secondary" : "outline"}>{m.activa ? "Activo" : "Inactivo"}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" disabled={isPending}
                  onClick={() => onToggle(m.user_id, !m.activa)}>
                  {m.activa ? "Desactivar" : "Activar"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CrearUsuario({ clinicaId, onListo }: { clinicaId: string; onListo: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [rol, setRol] = useState<"doctor" | "supervisor" | "administrador">("doctor")
  const [password, setPassword] = useState<string | null>(null)

  function crear() {
    startTransition(async () => {
      const r = await crearUsuarioConPassword(clinicaId, { nombre, email, rol })
      if (!r.ok) { toast.error(r.error ?? "No se pudo crear el usuario."); return }
      setPassword(r.password ?? null)
      toast.success("Usuario creado.")
      onListo()
    })
  }

  function cerrar() {
    setAbierto(false); setNombre(""); setEmail(""); setRol("doctor"); setPassword(null)
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAbierto(true)}>
        <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Crear usuario
      </Button>
      <Dialog open={abierto} onOpenChange={(o) => { if (!o) cerrar() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear usuario</DialogTitle>
            <DialogDescription>
              Se crea con una contraseña temporal que el usuario cambiará en su primer acceso.
            </DialogDescription>
          </DialogHeader>

          {password ? (
            <div className="space-y-3">
              <p className="text-sm">Usuario creado. Entrega estos datos (la contraseña se muestra una sola vez):</p>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <p><span className="text-muted-foreground">Correo:</span> {email}</p>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Contraseña:</span>
                  <code className="font-mono font-medium">{password}</code>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => { navigator.clipboard.writeText(password); toast.success("Contraseña copiada") }}
                    aria-label="Copiar contraseña"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={cerrar}>Listo</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cu-nombre">Nombre</Label>
                <Input id="cu-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Dra. Ana López" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cu-email">Correo</Label>
                <Input id="cu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ana@clinica.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cu-rol">Rol</Label>
                <select id="cu-rol" value={rol} onChange={(e) => setRol(e.target.value as typeof rol)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="doctor">Doctor</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="administrador">Administrador</option>
                </select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={cerrar}>Cancelar</Button>
                <Button onClick={crear} disabled={isPending || !nombre.trim() || !email.trim()}>
                  {isPending ? "Creando..." : "Crear usuario"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function PrecioVencimiento({
  cuentaId, precioActual, precioPlan, vencimientoActual, onListo,
}: {
  cuentaId: string
  precioActual: number | null
  precioPlan: number
  vencimientoActual: string | null
  onListo: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [precio, setPrecio] = useState(precioActual != null ? String(precioActual) : "")
  const [venc, setVenc] = useState(vencimientoActual ?? "")

  function guardar() {
    startTransition(async () => {
      const r = await fijarPrecioVencimiento(cuentaId, {
        precio_mxn: precio.trim() === "" ? null : Number(precio),
        fecha_vencimiento: venc || null,
      })
      if (!r.ok) { toast.error(r.error ?? "No se pudo guardar."); return }
      toast.success("Precio y vencimiento guardados.")
      onListo()
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pv-precio">Precio mensual personalizado (MXN)</Label>
          <Input id="pv-precio" type="number" value={precio} onChange={(e) => setPrecio(e.target.value)}
            placeholder={`Vacío = precio del plan (${moneda(precioPlan)})`} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pv-venc">Fecha de vencimiento</Label>
          <Input id="pv-venc" type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
        </div>
      </div>
      <Button size="sm" onClick={guardar} disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar precio y vencimiento"}
      </Button>
    </div>
  )
}

function RegistrarPago({
  cuentaId, sugerido, onListo,
}: {
  cuentaId: string
  sugerido: number
  onListo: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [monto, setMonto] = useState(sugerido ? String(sugerido) : "")
  const [metodo, setMetodo] = useState("transferencia")
  const [nota, setNota] = useState("")

  function registrar() {
    startTransition(async () => {
      const r = await registrarPago(cuentaId, { monto_mxn: Number(monto), metodo, nota })
      if (!r.ok) { toast.error(r.error ?? "No se pudo registrar."); return }
      toast.success("Pago registrado. Vencimiento renovado un mes.")
      setNota("")
      onListo()
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Registrar un pago</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="rp-monto">Monto (MXN)</Label>
          <Input id="rp-monto" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rp-metodo">Método</Label>
          <select id="rp-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rp-nota">Nota (opcional)</Label>
          <Input id="rp-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Referencia..." />
        </div>
      </div>
      <Button size="sm" onClick={registrar} disabled={isPending || !monto}>
        {isPending ? "Registrando..." : "Registrar pago"}
      </Button>
    </div>
  )
}

function MiniAccion({
  titulo, etiqueta, boton, tipo, onEnviar, isPending,
}: {
  titulo: string
  etiqueta: string
  boton: string
  tipo: string
  onEnviar: (valor: string) => void
  isPending: boolean
}) {
  const [valor, setValor] = useState("")
  return (
    <div className="space-y-1.5">
      <Label>{titulo}</Label>
      <div className="flex gap-2">
        <Input type={tipo} placeholder={etiqueta} value={valor} onChange={(e) => setValor(e.target.value)} className="h-9" />
        <Button size="sm" disabled={isPending || !valor} onClick={() => { onEnviar(valor); setValor("") }}>{boton}</Button>
      </div>
    </div>
  )
}

function CambiarPlan({
  planes, planActual, onCambiar, isPending,
}: {
  planes: PlanResumen[]
  planActual: string | null
  onCambiar: (planId: string) => void
  isPending: boolean
}) {
  const [planId, setPlanId] = useState(planActual ?? planes[0]?.id ?? "")
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1.5">
        <Label htmlFor="plan-sel">Plan</Label>
        <select id="plan-sel" value={planId} onChange={(e) => setPlanId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre} — {moneda(p.precio_mensual_mxn)}/mes</option>)}
        </select>
      </div>
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => onCambiar(planId)}>Aplicar plan</Button>
    </div>
  )
}

function ConectarTelegram({
  clinicaId, conectado, onListo,
}: {
  clinicaId: string
  conectado: boolean
  onListo: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [token, setToken] = useState("")

  function conectar() {
    startTransition(async () => {
      const r = await conectarTelegram(clinicaId, token)
      if (!r.ok) { toast.error(r.error ?? "No se pudo conectar."); return }
      setToken("")
      toast.success("Bot de Telegram conectado.")
      onListo()
    })
  }

  return (
    <div className="space-y-2">
      {conectado && <Badge variant="secondary">Conectado</Badge>}
      <div className="flex gap-2">
        <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token del bot (BotFather)" className="h-9" />
        <Button size="sm" disabled={isPending || !token.trim()} onClick={conectar}>Conectar</Button>
      </div>
    </div>
  )
}
