import { notFound } from "next/navigation"
import { obtenerClinicaDetalle, listarPlanes } from "../actions"
import { ClinicaDetalleClient } from "./ClinicaDetalleClient"

export const dynamic = "force-dynamic"

export default async function ClinicaDetallePage({
  params,
}: {
  params: Promise<{ clinicaId: string }>
}) {
  const { clinicaId } = await params
  const [detalle, planes] = await Promise.all([
    obtenerClinicaDetalle(clinicaId),
    listarPlanes(),
  ])
  if (!detalle) notFound()
  return <ClinicaDetalleClient detalle={detalle} planes={planes} />
}
