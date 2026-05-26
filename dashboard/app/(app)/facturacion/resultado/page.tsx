import { Suspense } from "react"
import { confirmarCheckout } from "@/app/actions/facturacion"
import { CheckCircle2, XCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Esta pagina recibe el retorno de Mercado Pago tras el intento de pago.
// MP envia query params: preapproval_id, status, external_reference, etc.

interface Props {
  searchParams: Promise<{
    preapproval_id?: string
    status?: string
    payment_id?: string
    collection_status?: string
  }>
}

async function ResultadoContent({ searchParams }: Props) {
  const params = await searchParams
  const preapprovalId = params.preapproval_id

  if (!preapprovalId) {
    return (
      <ResultadoCard
        icono={<XCircle className="h-12 w-12 text-destructive" />}
        titulo="Pago no identificado"
        mensaje="No se recibio el identificador de la suscripcion. Verifica tu estado en la seccion de Facturacion."
        accion="/facturacion"
        labelAccion="Ir a Facturacion"
      />
    )
  }

  const { estado, mensaje } = await confirmarCheckout(preapprovalId)

  if (estado === "activa") {
    return (
      <ResultadoCard
        icono={<CheckCircle2 className="h-12 w-12 text-green-600" />}
        titulo="Suscripcion activada"
        mensaje={mensaje}
        accion="/"
        labelAccion="Ir al panel de control"
        secundaria="/facturacion"
        labelSecundaria="Ver facturacion"
      />
    )
  }

  if (estado === "pago_pendiente") {
    return (
      <ResultadoCard
        icono={<Clock className="h-12 w-12 text-amber-500" />}
        titulo="Pago pendiente"
        mensaje={mensaje}
        accion="/facturacion"
        labelAccion="Ver estado de facturacion"
      />
    )
  }

  return (
    <ResultadoCard
      icono={<XCircle className="h-12 w-12 text-destructive" />}
      titulo="Estado de pago"
      mensaje={mensaje}
      accion="/facturacion"
      labelAccion="Ver facturacion"
    />
  )
}

function ResultadoCard({
  icono,
  titulo,
  mensaje,
  accion,
  labelAccion,
  secundaria,
  labelSecundaria,
}: {
  icono: React.ReactNode
  titulo: string
  mensaje: string
  accion: string
  labelAccion: string
  secundaria?: string
  labelSecundaria?: string
}) {
  return (
    <div className="flex flex-col items-center text-center gap-4 max-w-sm mx-auto py-16 px-6">
      {icono}
      <h2 className="text-xl font-semibold text-foreground">{titulo}</h2>
      <p className="text-sm text-muted-foreground">{mensaje}</p>
      <div className="flex gap-3 mt-2">
        <Button asChild>
          <Link href={accion}>{labelAccion}</Link>
        </Button>
        {secundaria && labelSecundaria && (
          <Button variant="outline" asChild>
            <Link href={secundaria}>{labelSecundaria}</Link>
          </Button>
        )}
      </div>
    </div>
  )
}

export default function ResultadoPage(props: Props) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Resultado del pago</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verificando el estado de tu suscripcion con Mercado Pago.
        </p>
      </div>

      <Suspense fallback={
        <div className="text-center py-16 text-sm text-muted-foreground">Verificando pago...</div>
      }>
        <ResultadoContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  )
}
