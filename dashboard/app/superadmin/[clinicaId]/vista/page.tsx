import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Eye } from "lucide-react"
import { obtenerVistaSoporte } from "../../actions"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

export default async function VistaSoportePage({
  params,
}: {
  params: Promise<{ clinicaId: string }>
}) {
  const { clinicaId } = await params
  const vista = await obtenerVistaSoporte(clinicaId)
  if (!vista) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/superadmin/${clinicaId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a la clínica
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Eye className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-xl font-semibold">{vista.clinica_nombre ?? "Clínica"} — Vista de soporte</h1>
        </div>
        <p className="text-sm text-muted-foreground">Solo lectura. No modifica datos de la clínica.</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Conversaciones recientes</h2>
        <div className="rounded-lg border border-border bg-background overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Intención</TableHead>
                <TableHead>Último mensaje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vista.conversaciones.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.paciente}</TableCell>
                  <TableCell>
                    <Badge variant={c.mode === "humano" ? "default" : "secondary"}>{c.mode}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">{c.status}</TableCell>
                  <TableCell className="text-muted-foreground">{c.intencion ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmt(c.last_message_at)}</TableCell>
                </TableRow>
              ))}
              {vista.conversaciones.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Sin conversaciones.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Próximas citas</h2>
        <div className="rounded-lg border border-border bg-background overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Pago</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vista.proximas_citas.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{fmt(a.fecha_hora)}</TableCell>
                  <TableCell className="font-medium">{a.paciente ?? "—"}</TableCell>
                  <TableCell>{a.servicio ?? "—"}</TableCell>
                  <TableCell className="capitalize">{a.status}</TableCell>
                  <TableCell>
                    <Badge variant={a.estado_pago === "pagado" ? "secondary" : "outline"}>
                      {a.estado_pago === "pagado" ? "Pagado" : "Pendiente"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {vista.proximas_citas.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Sin citas próximas.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
