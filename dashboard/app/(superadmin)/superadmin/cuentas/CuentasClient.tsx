"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CuentaResumen } from "../actions"

const ESTADOS = ["todos", "activa", "prueba", "suspendida", "cancelada", "vencida"]

function badgeVariant(estado: string): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    activa:     "default",
    prueba:     "secondary",
    suspendida: "destructive",
    cancelada:  "destructive",
    vencida:    "outline",
  }
  return map[estado] ?? "outline"
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" })
}

export function CuentasClient({ cuentas }: { cuentas: CuentaResumen[] }) {
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("todos")

  const filtradas = useMemo(() => {
    let lista = cuentas
    if (filtroEstado !== "todos") {
      lista = lista.filter((c) => c.estado === filtroEstado)
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      lista = lista.filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          (c.email_contacto ?? "").toLowerCase().includes(q)
      )
    }
    return lista
  }, [cuentas, busqueda, filtroEstado])

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar por nombre o email..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS.map((e) => (
              <SelectItem key={e} value={e}>
                {e === "todos" ? "Todos los estados" : e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Clinicas</TableHead>
              <TableHead className="text-right">Usuarios</TableHead>
              <TableHead className="text-right">Uso IA (mes)</TableHead>
              <TableHead>Alta</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{c.nombre}</p>
                    {c.email_contacto && (
                      <p className="text-xs text-muted-foreground">{c.email_contacto}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.plan_nombre ?? "Sin plan"}
                </TableCell>
                <TableCell>
                  <Badge variant={badgeVariant(c.estado)} className="text-xs">
                    {c.estado}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{c.num_clinicas}</TableCell>
                <TableCell className="text-right">{c.num_usuarios}</TableCell>
                <TableCell className="text-right">
                  {c.uso_ia_mes > 0 ? c.uso_ia_mes.toLocaleString("es-MX") : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatFecha(c.created_at)}
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/superadmin/cuentas/${c.id}`}>Ver</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-sm">
                  No se encontraron cuentas con los filtros aplicados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtradas.length} de {cuentas.length} cuentas
      </p>
    </div>
  )
}
