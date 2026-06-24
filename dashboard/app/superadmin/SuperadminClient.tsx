"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import {
  crearClinica, agregarMiembros, recargarSaldoIA, sumarRecordatorios,
  cambiarPlan, cambiarEstadoCuenta, conectarTelegram,
  type ClinicaAdmin, type PlanResumen, type MiembroNuevo,
} from "./actions"

const moneda = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })

export function SuperadminClient({
  clinicasIniciales,
  planes,
}: {
  clinicasIniciales: ClinicaAdmin[]
  planes: PlanResumen[]
}) {
  const router = useRouter()
  const [nuevaAbierta, setNuevaAbierta] = useState(false)
  const [gestion, setGestion] = useState<ClinicaAdmin | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Clínicas</h1>
          <p className="text-sm text-muted-foreground">{clinicasIniciales.length} en total</p>
        </div>
        <Button onClick={() => setNuevaAbierta(true)}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          Nueva clínica
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clínica</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Doctores</TableHead>
              <TableHead>Usuarios</TableHead>
              <TableHead>Recordatorios</TableHead>
              <TableHead>Saldo IA</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinicasIniciales.map((c) => (
              <TableRow key={c.clinica_id}>
                <TableCell>
                  <div className="font-medium text-foreground">{c.clinica_nombre ?? "Sin nombre"}</div>
                  <div className="text-xs text-muted-foreground">{c.cuenta_nombre}</div>
                </TableCell>
                <TableCell>{c.plan_nombre ?? "Sin plan"}</TableCell>
                <TableCell>{c.doctores}</TableCell>
                <TableCell>{c.usuarios}</TableCell>
                <TableCell>{c.recordatorios_enviados} / {c.recordatorios_tope}</TableCell>
                <TableCell>{moneda(c.saldo_disponible_mxn)}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge variant={c.cuenta_estado === "suspendida" ? "destructive" : "secondary"}>
                      {c.cuenta_estado}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {c.telegram_conectado ? "Telegram conectado" : "Sin Telegram"}
                      {c.onboarding_completado ? "" : " · onboarding pendiente"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setGestion(c)}>
                    <Settings className="mr-1 h-4 w-4" aria-hidden="true" />
                    Gestionar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {clinicasIniciales.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  Aún no hay clínicas. Crea la primera con "Nueva clínica".
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DialogNuevaClinica
        abierta={nuevaAbierta}
        onCerrar={() => setNuevaAbierta(false)}
        planes={planes}
        onListo={() => { setNuevaAbierta(false); router.refresh() }}
      />

      {gestion && (
        <DialogGestion
          clinica={gestion}
          planes={planes}
          onCerrar={() => setGestion(null)}
          onCambio={() => router.refresh()}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialogo: nueva clinica
// ---------------------------------------------------------------------------

function DialogNuevaClinica({
  abierta, onCerrar, planes, onListo,
}: {
  abierta: boolean
  onCerrar: () => void
  planes: PlanResumen[]
  onListo: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [nombre, setNombre] = useState("")
  const [emailAdmin, setEmailAdmin] = useState("")
  const [nombreAdmin, setNombreAdmin] = useState("")
  const [telefono, setTelefono] = useState("")
  const [direccion, setDireccion] = useState("")
  const [planId, setPlanId] = useState(planes[0]?.id ?? "")

  function guardar() {
    startTransition(async () => {
      const r = await crearClinica({
        nombre_clinica: nombre, email_admin: emailAdmin, nombre_admin: nombreAdmin,
        plan_id: planId, telefono, direccion,
      })
      if (!r.ok) { toast.error(r.error ?? "No se pudo crear la clínica."); return }
      if (r.error) toast.warning(r.error)
      else toast.success("Clínica creada. Se envió la invitación a la administradora.")
      setNombre(""); setEmailAdmin(""); setNombreAdmin(""); setTelefono(""); setDireccion("")
      onListo()
    })
  }

  return (
    <Dialog open={abierta} onOpenChange={(o) => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva clínica</DialogTitle>
          <DialogDescription>
            Se crea la cuenta, la clínica y su suscripción, y se invita a la administradora al onboarding.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Campo label="Nombre de la clínica" value={nombre} onChange={setNombre} placeholder="Clínica Dental Sonrisa" />
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nombre de la administradora" value={nombreAdmin} onChange={setNombreAdmin} placeholder="Dra. Ana López" />
            <Campo label="Correo de la administradora" value={emailAdmin} onChange={setEmailAdmin} placeholder="ana@clinica.com" type="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Teléfono (opcional)" value={telefono} onChange={setTelefono} placeholder="55 1234 5678" />
            <Campo label="Dirección (opcional)" value={direccion} onChange={setDireccion} placeholder="Calle, ciudad" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan">Plan</Label>
            <select
              id="plan"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {moneda(p.precio_mensual_mxn)}/mes · {p.max_doctores} doctores · {p.max_usuarios} usuarios
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button onClick={guardar} disabled={isPending || !nombre.trim() || !emailAdmin.trim() || !planId}>
            {isPending ? "Creando..." : "Crear clínica"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialogo: gestionar una clinica
// ---------------------------------------------------------------------------

function DialogGestion({
  clinica, planes, onCerrar, onCambio,
}: {
  clinica: ClinicaAdmin
  planes: PlanResumen[]
  onCerrar: () => void
  onCambio: () => void
}) {
  const [isPending, startTransition] = useTransition()

  // Miembros
  const [miembros, setMiembros] = useState<MiembroNuevo[]>([])
  // Recarga
  const [monto, setMonto] = useState("")
  // Recordatorios
  const [recs, setRecs] = useState("")
  // Plan
  const [planId, setPlanId] = useState(clinica.plan_id ?? planes[0]?.id ?? "")
  // Telegram
  const [token, setToken] = useState("")

  const correr = (fn: () => Promise<{ ok: boolean; error?: string }>, exito: string) => {
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) toast.error(r.error ?? "Ocurrió un error.")
      else { toast.success(exito); onCambio() }
    })
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{clinica.clinica_nombre ?? "Clínica"}</DialogTitle>
          <DialogDescription>{clinica.cuenta_nombre} · {clinica.plan_nombre ?? "Sin plan"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Agregar miembros */}
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Agregar usuarios y doctores</h3>
            {miembros.map((m, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-4 h-8 text-sm" placeholder="Nombre" value={m.nombre}
                  onChange={(e) => { const c = [...miembros]; c[i] = { ...c[i], nombre: e.target.value }; setMiembros(c) }} />
                <Input className="col-span-5 h-8 text-sm" placeholder="correo@ejemplo.com" type="email" value={m.email}
                  onChange={(e) => { const c = [...miembros]; c[i] = { ...c[i], email: e.target.value }; setMiembros(c) }} />
                <select className="col-span-2 h-8 rounded-md border border-input bg-background px-1 text-sm" value={m.rol}
                  onChange={(e) => { const c = [...miembros]; c[i] = { ...c[i], rol: e.target.value as MiembroNuevo["rol"] }; setMiembros(c) }}>
                  <option value="doctor">Doctor</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="administrador">Admin</option>
                </select>
                <button type="button" className="col-span-1 text-muted-foreground hover:text-destructive"
                  onClick={() => setMiembros(miembros.filter((_, j) => j !== i))} aria-label="Quitar">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setMiembros([...miembros, { nombre: "", email: "", rol: "doctor" }])}>
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />Agregar fila
              </Button>
              {miembros.length > 0 && (
                <Button size="sm" disabled={isPending}
                  onClick={() => correr(async () => {
                    const validos = miembros.filter((m) => m.email.trim())
                    const r = await agregarMiembros(clinica.clinica_id, validos)
                    if (r.ok) setMiembros([])
                    return r
                  }, "Invitaciones enviadas.")}>
                  Invitar
                </Button>
              )}
            </div>
          </section>

          <Separator />

          {/* Recargar saldo IA */}
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Recargar saldo de IA</h3>
            <p className="text-xs text-muted-foreground">Saldo actual: {moneda(clinica.saldo_disponible_mxn)}</p>
            <div className="flex gap-2">
              <Input className="h-8 text-sm" type="number" placeholder="Monto MXN" value={monto} onChange={(e) => setMonto(e.target.value)} />
              <Button size="sm" disabled={isPending}
                onClick={() => correr(() => recargarSaldoIA(clinica.clinica_id, Number(monto)), "Saldo recargado.")}>
                Recargar
              </Button>
            </div>
          </section>

          <Separator />

          {/* Sumar recordatorios */}
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Sumar recordatorios</h3>
            <p className="text-xs text-muted-foreground">Tope actual: {clinica.recordatorios_tope} / mes</p>
            <div className="flex gap-2">
              <Input className="h-8 text-sm" type="number" placeholder="Cantidad" value={recs} onChange={(e) => setRecs(e.target.value)} />
              <Button size="sm" disabled={isPending}
                onClick={() => correr(() => sumarRecordatorios(clinica.clinica_id, Number(recs)), "Recordatorios agregados.")}>
                Agregar
              </Button>
            </div>
          </section>

          <Separator />

          {/* Cambiar plan */}
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Cambiar de plan</h3>
            <div className="flex gap-2">
              <select className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre} — {moneda(p.precio_mensual_mxn)}/mes</option>)}
              </select>
              <Button size="sm" variant="outline" disabled={isPending}
                onClick={() => correr(() => cambiarPlan(clinica.cuenta_id, planId), "Plan actualizado.")}>
                Aplicar
              </Button>
            </div>
          </section>

          <Separator />

          {/* Conectar Telegram */}
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              Telegram {clinica.telegram_conectado && <Badge variant="secondary" className="ml-1">conectado</Badge>}
            </h3>
            <div className="flex gap-2">
              <Input className="h-8 text-sm" placeholder="Token del bot (BotFather)" value={token} onChange={(e) => setToken(e.target.value)} />
              <Button size="sm" disabled={isPending}
                onClick={() => correr(async () => {
                  const r = await conectarTelegram(clinica.clinica_id, token)
                  if (r.ok) setToken("")
                  return r
                }, "Bot de Telegram conectado.")}>
                Conectar
              </Button>
            </div>
          </section>

          <Separator />

          {/* Suspender / reactivar */}
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Estado de la cuenta</h3>
            {clinica.cuenta_estado === "suspendida" ? (
              <Button size="sm" variant="outline" disabled={isPending}
                onClick={() => correr(() => cambiarEstadoCuenta(clinica.cuenta_id, "activa"), "Cuenta reactivada.")}>
                Reactivar cuenta
              </Button>
            ) : (
              <Button size="sm" variant="destructive" disabled={isPending}
                onClick={() => correr(() => cambiarEstadoCuenta(clinica.cuenta_id, "suspendida"), "Cuenta suspendida.")}>
                Suspender cuenta
              </Button>
            )}
            <p className="text-xs text-muted-foreground">Suspender restringe el acceso sin borrar datos.</p>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Campo simple
// ---------------------------------------------------------------------------

function Campo({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}
