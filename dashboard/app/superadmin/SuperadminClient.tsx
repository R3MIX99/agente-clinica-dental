"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Plus, Settings, Search, Download } from "lucide-react"
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
import { crearClinica, type ClinicaAdmin, type PlanResumen } from "./actions"

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
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("")

  const q = busqueda.trim().toLowerCase()
  const clinicas = clinicasIniciales.filter((c) => {
    const coincideTexto = !q ||
      (c.clinica_nombre ?? "").toLowerCase().includes(q) ||
      c.cuenta_nombre.toLowerCase().includes(q)
    const coincideEstado = !filtroEstado || c.cuenta_estado === filtroEstado
    return coincideTexto && coincideEstado
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Clínicas</h1>
          <p className="text-sm text-muted-foreground">{clinicas.length} de {clinicasIniciales.length}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/superadmin/clinicas/export" download>
              <Download className="mr-1 h-4 w-4" aria-hidden="true" />
              Exportar
            </a>
          </Button>
          <Button onClick={() => setNuevaAbierta(true)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
            Nueva clínica
          </Button>
        </div>
      </div>

      {/* Buscador y filtro */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            className="pl-8"
            placeholder="Buscar por clínica o cuenta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="activa">Activa</option>
          <option value="prueba">Prueba</option>
          <option value="suspendida">Suspendida</option>
          <option value="cancelada">Cancelada</option>
        </select>
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
              <TableHead>Últ. actividad</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinicas.map((c) => (
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
                <TableCell className="text-xs text-muted-foreground">
                  {c.ultima_actividad ? new Date(c.ultima_actividad).toLocaleDateString("es-MX") : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/superadmin/${c.clinica_id}`}>
                      <Settings className="mr-1 h-4 w-4" aria-hidden="true" />
                      Gestionar
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {clinicas.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  {clinicasIniciales.length === 0
                    ? 'Aún no hay clínicas. Crea la primera con "Nueva clínica".'
                    : "Ninguna clínica coincide con la búsqueda."}
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
      else if (r.password) {
        toast.success(
          `Clínica creada. Contraseña temporal de ${emailAdmin}: ${r.password} (vence en 3 días si no la cambia)`,
          { duration: 30000 },
        )
      } else {
        toast.success("Clínica creada.")
      }
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
            Se crea la cuenta, la clínica, su suscripción y el acceso de la administradora con una
            contraseña temporal generada al momento — cópiala y entrégala por un canal seguro.
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
