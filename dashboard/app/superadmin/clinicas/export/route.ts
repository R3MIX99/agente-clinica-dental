import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { obtenerSuperadmin } from "@/lib/auth/superadmin"
import { listarClinicasAdmin } from "../../actions"

export const dynamic = "force-dynamic"

export async function GET() {
  const admin = await obtenerSuperadmin()
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const clinicas = await listarClinicasAdmin()

  const filas = clinicas.map((c) => ({
    Clinica: c.clinica_nombre ?? "",
    Cuenta: c.cuenta_nombre,
    Estado: c.cuenta_estado,
    Plan: c.plan_nombre ?? "",
    Doctores: c.doctores,
    Usuarios: c.usuarios,
    "Recordatorios enviados": c.recordatorios_enviados,
    "Tope recordatorios": c.recordatorios_tope,
    "Saldo IA (MXN)": c.saldo_disponible_mxn,
    Telegram: c.telegram_conectado ? "Conectado" : "Sin conectar",
    Onboarding: c.onboarding_completado ? "Completado" : "Pendiente",
    "Ultima actividad": c.ultima_actividad ? new Date(c.ultima_actividad).toLocaleString("es-MX") : "",
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(filas)
  XLSX.utils.book_append_sheet(wb, ws, "Clinicas")
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer

  const nombre = `clinicas-${new Date().toISOString().slice(0, 10)}.xlsx`
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  })
}
