import { listarPlanes } from "../actions"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

const moneda = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })

export default async function SuperadminPlanesPage() {
  const planes = await listarPlanes()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Planes</h1>
        <p className="text-sm text-muted-foreground">Catálogo de planes y sus límites.</p>
      </div>

      <div className="rounded-lg border border-border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Precio/mes</TableHead>
              <TableHead>Doctores</TableHead>
              <TableHead>Usuarios</TableHead>
              <TableHead>Recordatorios</TableHead>
              <TableHead>Saldo IA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planes.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nombre}</TableCell>
                <TableCell>{moneda(p.precio_mensual_mxn)}</TableCell>
                <TableCell>{p.max_doctores}</TableCell>
                <TableCell>{p.max_usuarios}</TableCell>
                <TableCell>{p.max_recordatorios_mes}</TableCell>
                <TableCell>{moneda(p.saldo_ia_incluido_mxn)}</TableCell>
              </TableRow>
            ))}
            {planes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No hay planes configurados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        La edición del catálogo de planes se agregará próximamente.
      </p>
    </div>
  )
}
