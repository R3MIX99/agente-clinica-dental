"use client"

import { useState, useTransition } from "react"
import { useForm, useFieldArray, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  guardarIdentidad,
  guardarFaq,
  agregarServicio,
  actualizarServicio,
  toggleServicio,
  eliminarServicio,
  guardarCanal,
} from "./actions"
import type { CanalTelegramPublico } from "./actions"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Plus, Trash2, Pencil } from "lucide-react"

// ---------------------------------------------------------------------------
// Tipos locales
// ---------------------------------------------------------------------------

type FaqItem = { pregunta: string; respuesta: string }

type ClinicaInfo = {
  nombre: string | null
  logo_url: string | null
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

type Servicio = {
  id: string
  nombre: string
  descripcion: string | null
  precio: number
  duracion_min: number | null
  activo: boolean
}

interface Props {
  clinica: ClinicaInfo | null
  servicios: Servicio[]
  canalTelegram: CanalTelegramPublico
}

// ---------------------------------------------------------------------------
// Componente raiz
// ---------------------------------------------------------------------------

export function AjustesClient({ clinica, servicios, canalTelegram }: Props) {
  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Ajustes de la clinica</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configura la identidad, servicios, FAQ y canal de mensajeria. El agente
          de IA usa estos datos para responder a los pacientes.
        </p>
      </div>

      {!clinica && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No hay una clinica activa configurada.
        </p>
      )}

      {clinica && (
        <Tabs defaultValue="identidad">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="identidad">Identidad</TabsTrigger>
            <TabsTrigger value="servicios">Servicios</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="canal">Canal</TabsTrigger>
          </TabsList>

          <TabsContent value="identidad" className="mt-6">
            <IdentidadTab clinica={clinica} />
          </TabsContent>

          <TabsContent value="servicios" className="mt-6">
            <ServiciosTab serviciosIniciales={servicios} />
          </TabsContent>

          <TabsContent value="faq" className="mt-6">
            <FaqTab faqInicial={clinica.faq ?? []} />
          </TabsContent>

          <TabsContent value="canal" className="mt-6">
            <CanalTab canalTelegram={canalTelegram} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Identidad
// ---------------------------------------------------------------------------

const identidadSchema = z.object({
  nombre:      z.string(),
  logo_url:    z.string(),
  direccion:   z.string(),
  telefono:    z.string(),
  email:       z.union([z.string().email("Correo electronico invalido"), z.literal("")]),
  sitio_web:   z.string(),
  horario:     z.string(),
  formas_pago: z.string(),
  facturacion: z.string(),
  mapa_url:    z.string(),
})

type IdentidadForm = z.infer<typeof identidadSchema>

function IdentidadTab({ clinica }: { clinica: ClinicaInfo }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<IdentidadForm>({
    resolver: zodResolver(identidadSchema),
    defaultValues: {
      nombre:      clinica.nombre      ?? "",
      logo_url:    clinica.logo_url    ?? "",
      direccion:   clinica.direccion   ?? "",
      telefono:    clinica.telefono    ?? "",
      email:       clinica.email       ?? "",
      sitio_web:   clinica.sitio_web   ?? "",
      horario:     clinica.horario     ?? "",
      formas_pago: clinica.formas_pago ?? "",
      facturacion: clinica.facturacion ?? "",
      mapa_url:    clinica.mapa_url    ?? "",
    },
  })

  const onSubmit = handleSubmit(async (datos) => {
    try {
      await guardarIdentidad(datos)
      toast.success("Identidad guardada correctamente")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al guardar")
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded-lg border border-border p-6 space-y-4">
        <h2 className="text-sm font-semibold">Informacion general</h2>

        {/* Nombre y logo */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre de la clinica</Label>
            <Input id="nombre" placeholder="Clinica Dental..." {...register("nombre")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="logo_url">URL del logo</Label>
            <Input id="logo_url" placeholder="https://..." {...register("logo_url")} />
          </div>
        </div>

        {/* Direccion */}
        <div className="space-y-1.5">
          <Label htmlFor="direccion">Direccion</Label>
          <Input id="direccion" placeholder="Calle, numero, colonia, ciudad" {...register("direccion")} />
        </div>

        {/* Telefono y Email */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="telefono">Telefono</Label>
            <Input id="telefono" placeholder="55 1234 5678" {...register("telefono")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electronico</Label>
            <Input id="email" type="email" placeholder="info@clinica.com" {...register("email")} />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>
        </div>

        {/* Sitio web */}
        <div className="space-y-1.5">
          <Label htmlFor="sitio_web">Sitio web</Label>
          <Input id="sitio_web" placeholder="https://..." {...register("sitio_web")} />
        </div>

        {/* Horario */}
        <div className="space-y-1.5">
          <Label htmlFor="horario">Horario de atencion</Label>
          <Input id="horario" placeholder="Lun-Vie 9:00-18:00, Sab 9:00-14:00" {...register("horario")} />
        </div>

        {/* Formas de pago y Facturacion */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="formas_pago">Formas de pago</Label>
            <Input id="formas_pago" placeholder="Efectivo, tarjeta, transferencia" {...register("formas_pago")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="facturacion">Facturacion</Label>
            <Input id="facturacion" placeholder="RFC requerido al momento de la cita" {...register("facturacion")} />
          </div>
        </div>

        {/* Mapa */}
        <div className="space-y-1.5">
          <Label htmlFor="mapa_url">URL de Google Maps</Label>
          <Input id="mapa_url" placeholder="https://maps.google.com/..." {...register("mapa_url")} />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Guardando..." : "Guardar identidad"}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Tab: Servicios
// ---------------------------------------------------------------------------

const servicioSchema = z.object({
  nombre:       z.string().min(1, "El nombre es requerido"),
  descripcion:  z.string(),
  precio:       z.coerce.number().min(0, "El precio debe ser mayor o igual a 0"),
  duracion_min: z.coerce.number().int().min(0).optional(),
})

type ServicioForm = z.infer<typeof servicioSchema>

function ServiciosTab({ serviciosIniciales }: { serviciosIniciales: Servicio[] }) {
  const [servicios, setServicios] = useState<Servicio[]>(serviciosIniciales)
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [editando, setEditando] = useState<Servicio | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ServicioForm>({
    resolver: zodResolver(servicioSchema) as Resolver<ServicioForm>,
    defaultValues: { nombre: "", descripcion: "", precio: 0, duracion_min: 0 },
  })

  function abrirNuevo() {
    setEditando(null)
    reset({ nombre: "", descripcion: "", precio: 0, duracion_min: 0 })
    setDialogAbierto(true)
  }

  function abrirEdicion(s: Servicio) {
    setEditando(s)
    reset({
      nombre:       s.nombre,
      descripcion:  s.descripcion ?? "",
      precio:       s.precio,
      duracion_min: s.duracion_min ?? 0,
    })
    setDialogAbierto(true)
  }

  const onSubmit = handleSubmit(async (datos) => {
    try {
      if (editando) {
        await actualizarServicio(editando.id, {
          nombre:       datos.nombre,
          descripcion:  datos.descripcion,
          precio:       datos.precio,
          duracion_min: datos.duracion_min ?? 0,
        })
        setServicios((prev) =>
          prev.map((s) =>
            s.id === editando.id
              ? { ...s, nombre: datos.nombre, descripcion: datos.descripcion, precio: datos.precio, duracion_min: datos.duracion_min ?? null }
              : s
          )
        )
        toast.success("Servicio actualizado")
      } else {
        await agregarServicio({
          nombre:       datos.nombre,
          descripcion:  datos.descripcion,
          precio:       datos.precio,
          duracion_min: datos.duracion_min ?? 0,
        })
        toast.success("Servicio agregado")
        // Recargar lista desde servidor via revalidatePath (no necesita window.reload)
      }
      setDialogAbierto(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al guardar servicio")
    }
  })

  function handleToggle(id: string, activo: boolean) {
    startTransition(async () => {
      try {
        await toggleServicio(id, activo)
        setServicios((prev) =>
          prev.map((s) => (s.id === id ? { ...s, activo } : s))
        )
      } catch {
        toast.error("Error al cambiar estado del servicio")
      }
    })
  }

  function handleEliminar(id: string) {
    startTransition(async () => {
      try {
        await eliminarServicio(id)
        setServicios((prev) => prev.filter((s) => s.id !== id))
        toast.success("Servicio eliminado")
      } catch {
        toast.error("Error al eliminar el servicio")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Estos servicios aparecen en las respuestas del agente de IA.
        </p>
        <Button size="sm" onClick={abrirNuevo}>
          <Plus size={14} className="mr-1.5" />
          Agregar servicio
        </Button>
      </div>

      {servicios.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Sin servicios registrados. Agrega el primero.
          </p>
        </div>
      )}

      {servicios.length > 0 && (
        <div className="rounded-lg border border-border divide-y divide-border">
          {servicios.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              {/* Toggle activo */}
              <Switch
                checked={s.activo}
                onCheckedChange={(v) => handleToggle(s.id, v)}
                disabled={isPending}
                aria-label={s.activo ? "Desactivar" : "Activar"}
              />

              {/* Datos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{s.nombre}</span>
                  {!s.activo && (
                    <Badge variant="secondary" className="text-xs shrink-0">inactivo</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {s.duracion_min ? `${s.duracion_min} min` : ""}
                  {s.duracion_min && s.descripcion ? " · " : ""}
                  {s.descripcion ?? ""}
                </p>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => abrirEdicion(s)}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Editar"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleEliminar(s.id)}
                  disabled={isPending}
                  className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  title="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog agregar / editar */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar servicio" : "Agregar servicio"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-nombre">Nombre</Label>
              <Input id="s-nombre" placeholder="Blanqueamiento dental" {...register("nombre")} />
              {errors.nombre && (
                <p className="text-xs text-red-500">{errors.nombre.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-duracion">Duracion (min)</Label>
                <Input id="s-duracion" type="number" min="0" step="5" placeholder="60" {...register("duracion_min")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="s-descripcion">Descripcion (opcional)</Label>
              <Input id="s-descripcion" placeholder="Incluye estudio previo..." {...register("descripcion")} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : editando ? "Actualizar" : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: FAQ
// ---------------------------------------------------------------------------

const faqItemSchema = z.object({
  pregunta:  z.string().min(1, "La pregunta es requerida"),
  respuesta: z.string().min(1, "La respuesta es requerida"),
})

const faqSchema = z.object({
  faq: z.array(faqItemSchema),
})

type FaqForm = z.infer<typeof faqSchema>

function FaqTab({ faqInicial }: { faqInicial: FaqItem[] }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FaqForm>({
    resolver: zodResolver(faqSchema),
    defaultValues: { faq: faqInicial },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "faq" })

  const onSubmit = handleSubmit(async ({ faq }) => {
    try {
      await guardarFaq(faq)
      toast.success("Preguntas frecuentes guardadas")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al guardar FAQ")
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          El agente usa estas respuestas para contestar preguntas comunes.
        </p>
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
        <div className="rounded-lg border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Sin preguntas frecuentes. Haz clic en &quot;Agregar&quot; para anadir una.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-md border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Pregunta {index + 1}
              </span>
              <button
                type="button"
                onClick={() => remove(index)}
                className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Eliminar"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`faq-${index}-pregunta`}>Pregunta</Label>
              <Input
                id={`faq-${index}-pregunta`}
                placeholder="Cual es el horario de atencion?"
                {...register(`faq.${index}.pregunta`)}
              />
              {errors.faq?.[index]?.pregunta?.message && (
                <p className="text-xs text-red-500">{errors.faq[index]!.pregunta!.message}</p>
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
                <p className="text-xs text-red-500">{errors.faq[index]!.respuesta!.message}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Guardando..." : "Guardar FAQ"}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Tab: Canal
// ---------------------------------------------------------------------------

const canalSchema = z.object({
  activo:      z.boolean(),
  bot_token:   z.string(),
  webhook_url: z.string(),
  bot_url:     z.string(),
})

type CanalForm = z.infer<typeof canalSchema>

function CanalTab({ canalTelegram }: { canalTelegram: CanalTelegramPublico }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<CanalForm>({
    defaultValues: {
      activo:      canalTelegram?.activo ?? false,
      bot_token:   "",
      webhook_url: canalTelegram?.webhook_url ?? "",
      bot_url:     canalTelegram?.bot_url ?? "",
    },
  })

  const activo = watch("activo")

  const onSubmit = handleSubmit(async (datos) => {
    const result = await guardarCanal({
      canal:       "telegram",
      activo:      datos.activo,
      bot_token:   datos.bot_token || undefined,
      webhook_url: datos.webhook_url || undefined,
      bot_url:     datos.bot_url,
    })
    if (result.ok) {
      toast.success("Canal de Telegram configurado")
    } else {
      toast.error(result.mensaje)
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Telegram */}
      <div className="rounded-lg border border-border p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Telegram</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              El bot de Telegram recibe mensajes de los pacientes y los envía al agente de IA.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={activo}
              onCheckedChange={(v) => setValue("activo", v)}
              aria-label="Activar canal Telegram"
            />
            <span className="text-sm text-muted-foreground">
              {activo ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>

        {/* Token del bot */}
        <div className="space-y-1.5">
          <Label htmlFor="bot_token">Token del bot</Label>
          <Input
            id="bot_token"
            type="password"
            autoComplete="off"
            placeholder={
              canalTelegram?.tiene_token
                ? "Token configurado — escribe uno nuevo para reemplazarlo"
                : "123456:ABCdef..."
            }
            {...register("bot_token")}
          />
          <p className="text-xs text-muted-foreground">
            Obtenlo en @BotFather de Telegram. Se almacena de forma segura en el servidor y nunca se muestra completo.
          </p>
        </div>

        {/* URL publica del bot */}
        <div className="space-y-1.5">
          <Label htmlFor="bot_url">URL publica del bot (para QR)</Label>
          <Input
            id="bot_url"
            placeholder="https://t.me/clinica_bot"
            {...register("bot_url")}
          />
          <p className="text-xs text-muted-foreground">
            Enlace publico al bot de Telegram. Se usa para generar el codigo QR que los pacientes escanean para iniciar conversacion.
          </p>
        </div>

        {/* Webhook URL (informativo) */}
        <div className="space-y-1.5">
          <Label htmlFor="webhook_url">URL del webhook (opcional)</Label>
          <Input
            id="webhook_url"
            placeholder="https://n8n.tuservidor.com/webhook/telegram-inbound"
            {...register("webhook_url")}
          />
          <p className="text-xs text-muted-foreground">
            Si usas n8n, ingresa la URL del trigger de Telegram para esta clinica.
          </p>
        </div>

        {canalTelegram?.updated_at && (
          <p className="text-xs text-muted-foreground">
            Ultima actualizacion:{" "}
            {new Date(canalTelegram.updated_at).toLocaleString("es-MX")}
          </p>
        )}
      </div>

      {/* WhatsApp — preparado */}
      <div className="rounded-lg border border-border border-dashed p-6 opacity-50">
        <h2 className="text-sm font-semibold">WhatsApp</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Disponible proximamente. La abstraccion de canal esta preparada para integrarlo sin cambios en la logica del agente.
        </p>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Guardando..." : "Guardar configuracion de canal"}
      </Button>
    </form>
  )
}
