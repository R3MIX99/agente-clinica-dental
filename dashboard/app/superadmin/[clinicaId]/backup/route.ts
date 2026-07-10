import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { createServerClient } from "@/lib/supabase/server"
import { obtenerSuperadmin } from "@/lib/auth/superadmin"

export const dynamic = "force-dynamic"

// Tablas del dominio de una clinica que se incluyen en la copia de seguridad.
const TABLAS = [
  "clinicas",
  "services",
  "doctors",
  "doctor_schedules",
  "patients",
  "patient_doctors",
  "appointments",
  "clinical_notes",
  "studies",
  "conversations",
  "messages",
] as const

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clinicaId: string }> },
) {
  // Candado: solo el superadmin autorizado
  const admin = await obtenerSuperadmin()
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { clinicaId } = await params
  const formato = req.nextUrl.searchParams.get("formato") === "xlsx" ? "xlsx" : "json"

  const db = createServerClient()

  // Recolectar cada tabla filtrada por clinica_id (clinicas se filtra por id)
  const datos: Record<string, unknown[]> = {}
  for (const tabla of TABLAS) {
    const columna = tabla === "clinicas" ? "id" : "clinica_id"
    // La columna es dinamica por tabla; el tipado estricto de .eq no lo admite.
    const { data } = await (db.from(tabla).select("*") as unknown as {
      eq: (col: string, val: string) => Promise<{ data: unknown[] | null }>
    }).eq(columna, clinicaId)
    datos[tabla] = data ?? []
  }

  const nombreBase = `respaldo-clinica-${clinicaId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}`

  if (formato === "json") {
    const cuerpo = JSON.stringify(
      { generado_en: new Date().toISOString(), clinica_id: clinicaId, datos },
      null,
      2,
    )
    return new NextResponse(cuerpo, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombreBase}.json"`,
      },
    })
  }

  // Excel: una hoja por tabla
  const wb = XLSX.utils.book_new()
  for (const tabla of TABLAS) {
    const filas = datos[tabla] as Record<string, unknown>[]
    // Aplanar valores objeto/array a JSON para que quepan en una celda
    const filasPlanas = filas.map((f) => {
      const salida: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(f)) {
        salida[k] = v !== null && typeof v === "object" ? JSON.stringify(v) : v
      }
      return salida
    })
    const ws = XLSX.utils.json_to_sheet(filasPlanas)
    // Nombre de hoja: max 31 caracteres
    XLSX.utils.book_append_sheet(wb, ws, tabla.slice(0, 31))
  }

  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreBase}.xlsx"`,
    },
  })
}
