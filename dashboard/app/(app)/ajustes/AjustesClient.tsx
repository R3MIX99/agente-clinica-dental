"use client"

import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { guardarAjustes } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

// ---------------------------------------------------------------------------
// Esquema de validacion
// ---------------------------------------------------------------------------

const faqItemSchema = z.object({
  pregunta: z.string().min(1, "La pregunta es requerida"),
  respuesta: z.string().min(1, "La respuesta es requerida"),
})

const ajustesSchema = z.object({
  nombre: z.string(),
  direccion: z.string(),
  telefono: z.string(),
  email: z.union([z.string().email("Correo electrónico inválido"), z.literal("")]),
  sitio_web: z.string(),
  horario: z.string(),
  formas_pago: z.string(),
  facturacion: z.string(),
  mapa_url: z.string(),
  faq: z.array(faqItemSchema),
})

type AjustesForm = z.infer<typeof ajustesSchema>

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type FaqItem = { pregunta: string; respuesta: string }

type ClinicaInfo = {
  nombre: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  sitio_web: string | null
  horario: string | null
  formas_pago: string | null
  facturacion: string | null
  mapa_url: string | null
  faq: FaqItem[] | null
}

interface Props {
  clinica: ClinicaInfo | null
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function AjustesClient({ clinica }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AjustesForm>({
    resolver: zodResolver(ajustesSchema),
    defaultValues: {
      nombre: clinica?.nombre ?? "",
      direccion: clinica?.direccion ?? "",
      telefono: clinica?.telefono ?? "",
      email: clinica?.email ?? "",
      sitio_web: clinica?.sitio_web ?? "",
      horario: clinica?.horario ?? "",
      formas_pago: clinica?.formas_pago ?? "",
      facturacion: clinica?.facturacion ?? "",
      mapa_url: clinica?.mapa_url ?? "",
      faq: Array.isArray(clinica?.faq) ? clinica.faq : [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "faq" })

  const onSubmit = handleSubmit(async (datos) => {
    try {
      await guardarAjustes(datos)
      toast.success("Ajustes guardados correctamente")
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Error al guardar los ajustes"
      )
    }
  })

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Ajustes de la clínica</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Este contenido alimenta las respuestas del asistente de IA.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Informacion general */}
        <div className="rounded-lg border border-border p-6 space-y-4">
          <h2 className="text-sm font-semibold">Información general</h2>

          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre de la clínica</Label>
            <Input
              id="nombre"
              placeholder="Clínica Dental..."
              {...register("nombre")}
            />
          </div>

          {/* Direccion */}
          <div className="space-y-1.5">
            <Label htmlFor="direccion">Dirección</Label>
            <Input
              id="direccion"
              placeholder="Calle, numero, colonia, ciudad"
              {...register("direccion")}
            />
          </div>

          {/* Telefono y Email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                placeholder="55 1234 5678"
                {...register("telefono")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="info@clinica.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>
          </div>

          {/* Sitio web */}
          <div className="space-y-1.5">
            <Label htmlFor="sitio_web">Sitio web</Label>
            <Input
              id="sitio_web"
              placeholder="https://..."
              {...register("sitio_web")}
            />
          </div>

          {/* Horario */}
          <div className="space-y-1.5">
            <Label htmlFor="horario">Horario de atención</Label>
            <Input
              id="horario"
              placeholder="Lun-Vie 9:00-18:00, Sáb 9:00-14:00"
              {...register("horario")}
            />
          </div>

          {/* Formas de pago */}
          <div className="space-y-1.5">
            <Label htmlFor="formas_pago">Formas de pago</Label>
            <Input
              id="formas_pago"
              placeholder="Efectivo, tarjeta de crédito/débito, transferencia"
              {...register("formas_pago")}
            />
          </div>

          {/* Facturacion */}
          <div className="space-y-1.5">
            <Label htmlFor="facturacion">Facturación</Label>
            <Input
              id="facturacion"
              placeholder="Factura disponible, RFC requerido al momento de la cita"
              {...register("facturacion")}
            />
          </div>

          {/* Mapa URL */}
          <div className="space-y-1.5">
            <Label htmlFor="mapa_url">URL del mapa (Google Maps)</Label>
            <Input
              id="mapa_url"
              placeholder="https://maps.google.com/..."
              {...register("mapa_url")}
            />
          </div>
        </div>

        {/* FAQ */}
        <div className="rounded-lg border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Preguntas frecuentes</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append({ pregunta: "", respuesta: "" })}
            >
              <Plus size={14} className="mr-1.5" />
              Agregar
            </Button>
          </div>

          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sin preguntas frecuentes. Haz clic en "Agregar" para añadir una.
            </p>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-md border border-border p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Pregunta {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    title="Eliminar pregunta"
                    className="p-1 rounded text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`faq-${index}-pregunta`}>Pregunta</Label>
                  <Input
                    id={`faq-${index}-pregunta`}
                    placeholder="¿Cuál es el horario de atención?"
                    {...register(`faq.${index}.pregunta`)}
                  />
                  {errors.faq?.[index]?.pregunta?.message && (
                    <p className="text-xs text-red-500">
                      {errors.faq?.[index]?.pregunta?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`faq-${index}-respuesta`}>Respuesta</Label>
                  <Textarea
                    id={`faq-${index}-respuesta`}
                    placeholder="Atendemos de lunes a viernes de 9:00 a 18:00 horas."
                    rows={2}
                    className="resize-none"
                    {...register(`faq.${index}.respuesta`)}
                  />
                  {errors.faq?.[index]?.respuesta?.message && (
                    <p className="text-xs text-red-500">
                      {errors.faq?.[index]?.respuesta?.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar ajustes"}
        </Button>
      </form>
    </div>
  )
}
