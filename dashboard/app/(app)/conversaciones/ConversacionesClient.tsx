"use client"

import { useState, useEffect, useRef, useTransition } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase/client"
import {
  tomarControl,
  devolverAlBot,
  obtenerMensajes,
  enviarMensajeAlPaciente,
  archivarConversacion,
  restaurarConversacion,
  vaciarPapelera,
} from "./actions"
import { cn } from "@/lib/utils"
import { useAtencion } from "@/lib/atencion-context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Trash2, Archive, RotateCcw, Eraser, ArrowLeft } from "lucide-react"

// ---------------------------------------------------------------------------
// Tipos locales
// ---------------------------------------------------------------------------

type Paciente = {
  id: string
  nombre: string
  channel: "telegram" | "whatsapp"
  channel_user_id: string | null
}

type AgenteAsignado = { nombre: string }

type Conversacion = {
  id: string
  channel: "telegram" | "whatsapp"
  mode: "bot" | "humano"
  status: "abierta" | "pendiente" | "cerrada"
  last_message_at: string
  assigned_agent_id: string | null
  patients: Paciente | null
  agents: AgenteAsignado | null
}

type Mensaje = {
  id: string
  contenido: string
  direction: "entrante" | "saliente"
  sender: "paciente" | "bot" | "agente"
  created_at: string
  metadata: unknown
}

type Agente = {
  id: string
  nombre: string
  role: string
}

type Vista = "activas" | "papelera"

interface Props {
  conversaciones: Conversacion[]
  agentes: Agente[]
  papelera: Conversacion[]
}

// ---------------------------------------------------------------------------
// Helpers de datos — usan el cliente del navegador (JWT del usuario autenticado)
// ---------------------------------------------------------------------------

async function fetchConversacionCliente(id: string): Promise<Conversacion | null> {
  const { data } = await supabase
    .from("conversations")
    .select(
      "id, channel, mode, status, last_message_at, assigned_agent_id, patients(id, nombre, channel, channel_user_id), agents(nombre)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  return (data as unknown as Conversacion) ?? null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ordenarPorUltimo(lista: Conversacion[]): Conversacion[] {
  return [...lista].sort(
    (a, b) =>
      new Date(b.last_message_at).getTime() -
      new Date(a.last_message_at).getTime()
  )
}

function tiempoRelativo(fecha: string): string {
  const iso = fecha.replace(" ", "T").replace(/\+(\d{2})$/, "+$1:00")
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "ahora"
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h`
  return `${Math.floor(h / 24)} d`
}

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

// ---------------------------------------------------------------------------
// Burbuja de mensaje
// ---------------------------------------------------------------------------

function MensajeBurbuja({ mensaje }: { mensaje: Mensaje }) {
  const esEntrante = mensaje.direction === "entrante"
  const hora = new Date(mensaje.created_at).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  })

  return (
    <div className={cn("flex", esEntrante ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "rounded-2xl px-3 py-2 max-w-[75%] text-sm leading-relaxed",
          esEntrante
            ? "bg-muted text-foreground rounded-tl-sm"
            : mensaje.sender === "bot"
            ? "bg-blue-500 text-white rounded-tr-sm"
            : "bg-emerald-600 text-white rounded-tr-sm"
        )}
      >
        {!esEntrante && (
          <p className="text-[10px] opacity-70 mb-0.5 font-medium">
            {mensaje.sender === "bot" ? "Bot" : "Agente"}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{mensaje.contenido}</p>
        <p
          className={cn(
            "text-[10px] mt-1",
            esEntrante ? "text-muted-foreground" : "opacity-60"
          )}
        >
          {hora}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Item de conversacion
// ---------------------------------------------------------------------------

function ConvItem({
  conv,
  esSeleccionada,
  onSelect,
  accionIcon,
  onAccion,
  accionDisabled,
  accionTitle,
  accionHoverClass,
  opaco,
  tieneAtencion,
}: {
  conv: Conversacion
  esSeleccionada: boolean
  onSelect: () => void
  accionIcon: React.ReactNode
  onAccion: () => void
  accionDisabled: boolean
  accionTitle: string
  accionHoverClass: string
  opaco?: boolean
  tieneAtencion?: boolean
}) {
  const nombre = conv.patients?.nombre ?? "Desconocido"

  return (
    <div
      className={cn(
        "relative group border-b border-border/50 transition-colors",
        "hover:bg-muted/50",
        esSeleccionada && "bg-muted"
      )}
    >
      <button
        onClick={onSelect}
        className={cn("w-full text-left px-4 py-3 pr-10", opaco && "opacity-60")}
      >
        <div className="flex items-start gap-2.5">
          <div className="relative shrink-0 mt-0.5">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
              {iniciales(nombre)}
            </div>
            {tieneAtencion && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-sm font-medium truncate">{nombre}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {tiempoRelativo(conv.last_message_at)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-medium leading-none",
                  conv.mode === "humano"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                )}
              >
                {conv.mode === "humano" ? "Humano" : "Bot"}
              </span>
              <span className="text-[10px] text-muted-foreground capitalize">
                {conv.channel}
              </span>
            </div>
          </div>
        </div>
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onAccion() }}
        disabled={accionDisabled}
        title={accionTitle}
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2",
          "p-1.5 rounded-md transition-all",
          "opacity-0 group-hover:opacity-100",
          "disabled:pointer-events-none disabled:opacity-40",
          accionHoverClass
        )}
      >
        {accionIcon}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-panel: lista de conversaciones
// ---------------------------------------------------------------------------

interface ListaPanelProps {
  vista: Vista
  convs: Conversacion[]
  papeleraConvs: Conversacion[]
  conteo: number
  atencionIds: Set<string>
  selectedId: string | null
  agenteActual: Agente | null
  accionandoId: string | null
  vaciando: boolean
  onSelectConv: (id: string) => void
  onSetVista: (v: Vista) => void
  onArchivar: (id: string) => void
  onRestaurar: (id: string) => void
  onVaciarPapelera: () => void
}

function ListaPanel({
  vista, convs, papeleraConvs, conteo, atencionIds, selectedId,
  agenteActual, accionandoId, vaciando,
  onSelectConv, onSetVista, onArchivar, onRestaurar, onVaciarPapelera,
}: ListaPanelProps) {
  const listaActual = vista === "activas" ? convs : papeleraConvs

  return (
    <>
      {/* Cabecera */}
      <div className="flex h-14 items-center border-b border-border px-4 shrink-0 gap-2">
        <h1 className="text-base font-semibold">
          {vista === "activas" ? "Conversaciones" : "Papelera"}
        </h1>
        <span className="text-xs text-muted-foreground tabular-nums">{conteo}</span>
        <div className="ml-auto flex items-center gap-1">
          {vista === "papelera" && papeleraConvs.length > 0 && (
            <button
              onClick={onVaciarPapelera}
              disabled={vaciando}
              title="Vaciar papelera permanentemente"
              className="p-1.5 rounded-md transition-colors text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-40"
            >
              <Eraser className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onSetVista(vista === "activas" ? "papelera" : "activas")}
            title={vista === "activas" ? "Ver papelera" : "Volver a conversaciones activas"}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              vista === "papelera"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Archive className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {listaActual.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            {vista === "activas" ? "Sin conversaciones aun." : "La papelera esta vacia."}
          </p>
        )}
        {vista === "activas"
          ? convs.map((conv) => (
              <ConvItem
                key={conv.id}
                conv={conv}
                esSeleccionada={conv.id === selectedId}
                tieneAtencion={atencionIds.has(conv.id)}
                onSelect={() => onSelectConv(conv.id)}
                accionIcon={<Trash2 className="h-3.5 w-3.5" />}
                onAccion={() => onArchivar(conv.id)}
                accionDisabled={accionandoId === conv.id}
                accionTitle="Archivar conversacion"
                accionHoverClass="hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
              />
            ))
          : papeleraConvs.map((conv) => (
              <ConvItem
                key={conv.id}
                conv={conv}
                esSeleccionada={conv.id === selectedId}
                onSelect={() => onSelectConv(conv.id)}
                accionIcon={<RotateCcw className="h-3.5 w-3.5" />}
                onAccion={() => onRestaurar(conv.id)}
                accionDisabled={accionandoId === conv.id}
                accionTitle="Restaurar conversacion"
                accionHoverClass="hover:bg-emerald-500/10 hover:text-emerald-600 text-muted-foreground"
                opaco
              />
            ))}
      </div>

      {agenteActual && (
        <div className="border-t border-border px-4 py-2.5 shrink-0">
          <p className="text-[11px] text-muted-foreground">
            Agente activo:{" "}
            <span className="font-medium text-foreground">{agenteActual.nombre}</span>
          </p>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Sub-panel: hilo de mensajes
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  scrollRef: React.RefObject<HTMLDivElement | null>
  convSeleccionada: Conversacion | null
  convSeleccionadaEsActiva: boolean
  mensajes: Mensaje[]
  cargandoMensajes: boolean
  texto: string
  enviando: boolean
  isPending: boolean
  accionandoId: string | null
  mostrarBotonVolver: boolean
  onVolver: () => void
  onTomarControl: () => void
  onDevolverAlBot: () => void
  onEnviar: () => void
  onTextoChange: (v: string) => void
  onRestaurar: (id: string) => void
}

function ChatPanel({
  scrollRef, convSeleccionada, convSeleccionadaEsActiva,
  mensajes, cargandoMensajes, texto, enviando, isPending, accionandoId,
  mostrarBotonVolver, onVolver,
  onTomarControl, onDevolverAlBot, onEnviar, onTextoChange, onRestaurar,
}: ChatPanelProps) {
  if (!convSeleccionada) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Selecciona una conversacion para ver el hilo de mensajes.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Cabecera */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4 shrink-0">
        {/* Boton volver — solo en movil */}
        {mostrarBotonVolver && (
          <button
            onClick={onVolver}
            aria-label="Volver a la lista"
            className="p-1.5 -ml-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
          {iniciales(convSeleccionada.patients?.nombre ?? "?")}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {convSeleccionada.patients?.nombre ?? "Desconocido"}
          </p>
          <p className="text-xs text-muted-foreground capitalize">
            {convSeleccionada.channel}
            {convSeleccionada.agents && (
              <> &middot; Atendiendo: {convSeleccionada.agents.nombre}</>
            )}
          </p>
        </div>

        {/* Acciones */}
        {!convSeleccionadaEsActiva ? (
          <Button
            size="sm" variant="outline"
            onClick={() => onRestaurar(convSeleccionada.id)}
            disabled={accionandoId === convSeleccionada.id}
            className="shrink-0"
          >
            Restaurar
          </Button>
        ) : convSeleccionada.mode === "bot" ? (
          <Button
            size="sm" variant="outline"
            onClick={onTomarControl}
            disabled={isPending}
            className="shrink-0"
          >
            Tomar control
          </Button>
        ) : (
          <Button
            size="sm" variant="ghost"
            onClick={onDevolverAlBot}
            disabled={isPending}
            className="shrink-0 text-muted-foreground"
          >
            Devolver al bot
          </Button>
        )}
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {cargandoMensajes ? (
          <div className="space-y-3 pt-2">
            {[40, 60, 35, 55, 45].map((w, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <div className="rounded-2xl bg-muted animate-pulse h-9" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        ) : mensajes.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground pt-8">
            Sin mensajes en esta conversacion.
          </p>
        ) : (
          <div className="space-y-2 pb-2">
            {mensajes.map((msg) => <MensajeBurbuja key={msg.id} mensaje={msg} />)}
          </div>
        )}
      </div>

      {/* Caja de envio / estado */}
      {convSeleccionadaEsActiva && convSeleccionada.mode === "humano" ? (
        <div className="border-t border-border p-3 shrink-0 bg-background">
          <div className="flex gap-2 items-end">
            <Textarea
              value={texto}
              onChange={(e) => onTextoChange(e.target.value)}
              placeholder="Escribe tu mensaje..."
              className="resize-none text-sm min-h-[60px]"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnviar() }
              }}
              disabled={enviando}
            />
            <Button
              onClick={onEnviar}
              disabled={enviando || !texto.trim()}
              size="sm"
              className="h-[60px] px-5 shrink-0"
            >
              {enviando ? "Enviando..." : "Enviar"}
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Enter para enviar &middot; Shift+Enter para nueva linea
          </p>
        </div>
      ) : convSeleccionadaEsActiva ? (
        <div className="border-t border-border px-4 py-3 shrink-0 bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            El bot esta manejando esta conversacion. Haz clic en{" "}
            <strong>Tomar control</strong> para responder como agente.
          </p>
        </div>
      ) : (
        <div className="border-t border-border px-4 py-3 shrink-0 bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Esta conversacion esta archivada. Restaurala para poder interactuar con ella.
          </p>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function ConversacionesClient({ conversaciones, agentes, papelera }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [cargandoMensajes, setCargandoMensajes] = useState(false)
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [vista, setVista] = useState<Vista>("activas")
  const [accionandoId, setAccionandoId] = useState<string | null>(null)
  const [vaciando, setVaciando] = useState(false)
  // Vista movil: "lista" | "chat"
  const [mobileVistaChat, setMobileVistaChat] = useState(false)

  // Refs de scroll separados para movil y escritorio
  const scrollMobileRef = useRef<HTMLDivElement>(null)
  const scrollDesktopRef = useRef<HTMLDivElement>(null)

  const { atencionIds, addAtencion, removeAtencion } = useAtencion()

  const selectedIdRef = useRef<string | null>(null)
  const convsRef = useRef<Conversacion[]>(ordenarPorUltimo(conversaciones))
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  const [convs, setConvs] = useState<Conversacion[]>(() => ordenarPorUltimo(conversaciones))
  const [papeleraConvs, setPapeleraConvs] = useState<Conversacion[]>(() => papelera)

  useEffect(() => { setConvs(ordenarPorUltimo(conversaciones)) }, [conversaciones])
  useEffect(() => { setPapeleraConvs(papelera) }, [papelera])
  useEffect(() => { convsRef.current = convs }, [convs])

  const agenteActual = agentes[0] ?? null

  const convSeleccionada =
    convs.find((c) => c.id === selectedId) ??
    papeleraConvs.find((c) => c.id === selectedId) ??
    null

  const convSeleccionadaEsActiva = convs.some((c) => c.id === selectedId)

  // Si la conversacion seleccionada desaparece, volver a la lista en movil
  useEffect(() => {
    if (mobileVistaChat && !convSeleccionada) {
      setMobileVistaChat(false)
    }
  }, [mobileVistaChat, convSeleccionada])

  // -------------------------------------------------------------------------
  // Cargar mensajes al cambiar de conversacion
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!selectedId) return
    setCargandoMensajes(true)
    setMensajes([])
    obtenerMensajes(selectedId)
      .then((data) => setMensajes(data as Mensaje[]))
      .catch(() => toast.error("Error al cargar mensajes"))
      .finally(() => setCargandoMensajes(false))
  }, [selectedId])

  // Scroll al fondo — aplica a ambos paneles
  useEffect(() => {
    if (scrollMobileRef.current) {
      scrollMobileRef.current.scrollTop = scrollMobileRef.current.scrollHeight
    }
    if (scrollDesktopRef.current) {
      scrollDesktopRef.current.scrollTop = scrollDesktopRef.current.scrollHeight
    }
  }, [mensajes])

  // -------------------------------------------------------------------------
  // Realtime: mensajes
  // -------------------------------------------------------------------------

  useEffect(() => {
    const ch = supabase
      .channel("rt-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const nuevo = payload.new as Mensaje & { conversation_id: string }
          if (nuevo.conversation_id === selectedIdRef.current) {
            setMensajes((prev) => {
              if (prev.some((m) => m.id === nuevo.id)) return prev
              return [...prev, nuevo]
            })
            return
          }
          if (nuevo.direction === "entrante") {
            const conv = convsRef.current.find((c) => c.id === nuevo.conversation_id)
            if (conv && conv.mode === "humano") addAtencion(nuevo.conversation_id)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // -------------------------------------------------------------------------
  // Realtime: conversaciones
  // -------------------------------------------------------------------------

  useEffect(() => {
    const ch = supabase
      .channel("rt-conversations")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        async (payload) => {
          const id = (payload.new as { id: string }).id
          const nueva = await fetchConversacionCliente(id)
          if (!nueva) return
          setConvs((prev) => {
            if (prev.some((c) => c.id === id)) return prev
            return ordenarPorUltimo([nueva, ...prev])
          })
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        async (payload) => {
          const upd = payload.new as Partial<Conversacion> & {
            id: string
            deleted_at?: string | null
          }
          if (upd.deleted_at) {
            setConvs((prev) => prev.filter((c) => c.id !== upd.id))
            return
          }
          const existeEnActivas = convsRef.current.some((c) => c.id === upd.id)
          if (!existeEnActivas) {
            const completa = await fetchConversacionCliente(upd.id)
            if (!completa) return
            setConvs((p) => {
              if (p.some((c) => c.id === upd.id)) return p
              setPapeleraConvs((pp) => pp.filter((c) => c.id !== upd.id))
              return ordenarPorUltimo([completa, ...p])
            })
            return
          }
          setConvs((prev) =>
            ordenarPorUltimo(
              prev.map((c) =>
                c.id === upd.id
                  ? {
                      ...c,
                      mode: upd.mode !== undefined ? upd.mode : c.mode,
                      status: upd.status !== undefined ? upd.status : c.status,
                      assigned_agent_id:
                        upd.assigned_agent_id !== undefined ? upd.assigned_agent_id : c.assigned_agent_id,
                      last_message_at:
                        upd.last_message_at !== undefined ? upd.last_message_at : c.last_message_at,
                    }
                  : c
              )
            )
          )
          if (upd.mode === "humano" && upd.id !== selectedIdRef.current) addAtencion(upd.id)
          if (upd.mode === "bot") removeAtencion(upd.id)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleSetVista = (v: Vista) => {
    setVista(v)
    setSelectedId(null)
    setMobileVistaChat(false)
  }

  const handleSelectConv = (id: string) => {
    setSelectedId(id)
    removeAtencion(id)
    setMobileVistaChat(true)
  }

  const handleMobileVolver = () => {
    setMobileVistaChat(false)
  }

  const handleTomarControl = () => {
    if (!selectedId || !agenteActual) return
    startTransition(async () => {
      try {
        await tomarControl(selectedId, agenteActual.id)
        toast.success("Conversacion tomada — modo humano activado")
      } catch { toast.error("Error al tomar control de la conversacion") }
    })
  }

  const handleDevolverAlBot = () => {
    if (!selectedId) return
    startTransition(async () => {
      try {
        await devolverAlBot(selectedId)
        toast.success("Bot retomando la conversacion...")
      } catch { toast.error("Error al devolver la conversacion al bot") }
    })
  }

  const handleEnviar = async () => {
    if (!texto.trim() || !convSeleccionada || !agenteActual) return
    if (!convSeleccionada.patients?.channel_user_id) {
      toast.error("El paciente no tiene canal configurado")
      return
    }
    setEnviando(true)
    try {
      await enviarMensajeAlPaciente({
        conversationId: selectedId!,
        channel: convSeleccionada.channel,
        channelUserId: convSeleccionada.patients.channel_user_id,
        texto: texto.trim(),
        agenteId: agenteActual.id,
      })
      setTexto("")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al enviar mensaje")
    } finally { setEnviando(false) }
  }

  const handleArchivar = async (id: string) => {
    const conv = convs.find((c) => c.id === id)
    if (!conv) return
    setConvs((prev) => prev.filter((c) => c.id !== id))
    setPapeleraConvs((prev) => [conv, ...prev])
    if (selectedId === id) { setSelectedId(null); setMobileVistaChat(false) }
    setAccionandoId(id)
    try {
      await archivarConversacion(id)
      toast.success("Conversacion archivada")
    } catch {
      setConvs((prev) => ordenarPorUltimo([conv, ...prev]))
      setPapeleraConvs((prev) => prev.filter((c) => c.id !== id))
      toast.error("Error al archivar la conversacion")
    } finally { setAccionandoId(null) }
  }

  const handleVaciarPapelera = async () => {
    if (papeleraConvs.length === 0) return
    const ok = window.confirm(
      `Se eliminaran permanentemente ${papeleraConvs.length} conversacion${papeleraConvs.length === 1 ? "" : "es"} y todos sus mensajes. Esta accion no se puede deshacer.`
    )
    if (!ok) return
    setVaciando(true)
    setPapeleraConvs([])
    setSelectedId(null)
    setMobileVistaChat(false)
    try {
      await vaciarPapelera()
      toast.success("Papelera vaciada")
    } catch { toast.error("Error al vaciar la papelera") }
    finally { setVaciando(false) }
  }

  const handleRestaurar = async (id: string) => {
    const conv = papeleraConvs.find((c) => c.id === id)
    if (!conv) return
    setPapeleraConvs((prev) => prev.filter((c) => c.id !== id))
    setConvs((prev) => ordenarPorUltimo([conv, ...prev]))
    if (selectedId === id) { setSelectedId(null); setMobileVistaChat(false) }
    setAccionandoId(id)
    try {
      await restaurarConversacion(id)
      toast.success("Conversacion restaurada")
    } catch {
      setPapeleraConvs((prev) => [conv, ...prev])
      setConvs((prev) => prev.filter((c) => c.id !== id))
      toast.error("Error al restaurar la conversacion")
    } finally { setAccionandoId(null) }
  }

  // -------------------------------------------------------------------------
  // Props compartidas entre paneles
  // -------------------------------------------------------------------------

  const listaActual = vista === "activas" ? convs : papeleraConvs
  const conteo = listaActual.length

  const listaProps: ListaPanelProps = {
    vista, convs, papeleraConvs, conteo, atencionIds, selectedId,
    agenteActual, accionandoId, vaciando,
    onSelectConv: handleSelectConv,
    onSetVista: handleSetVista,
    onArchivar: handleArchivar,
    onRestaurar: handleRestaurar,
    onVaciarPapelera: handleVaciarPapelera,
  }

  const chatPropsBase = {
    convSeleccionada,
    convSeleccionadaEsActiva,
    mensajes,
    cargandoMensajes,
    texto,
    enviando,
    isPending,
    accionandoId,
    onTomarControl: handleTomarControl,
    onDevolverAlBot: handleDevolverAlBot,
    onEnviar: handleEnviar,
    onTextoChange: setTexto,
    onRestaurar: handleRestaurar,
    onVolver: handleMobileVolver,
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex h-full overflow-hidden">

      {/* ================================================================== */}
      {/* MOVIL (< md) — lista o chat a pantalla completa con animacion       */}
      {/* ================================================================== */}
      <div className="flex flex-1 flex-col overflow-hidden md:hidden">
        <AnimatePresence mode="wait" initial={false}>
          {!mobileVistaChat ? (
            <motion.div
              key="mobile-lista"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <ListaPanel {...listaProps} />
            </motion.div>
          ) : (
            <motion.div
              key="mobile-chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <ChatPanel
                {...chatPropsBase}
                scrollRef={scrollMobileRef}
                mostrarBotonVolver
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ================================================================== */}
      {/* ESCRITORIO (md+) — panel izquierdo + panel derecho lado a lado      */}
      {/* ================================================================== */}

      {/* Panel izquierdo — lista */}
      <div className="hidden md:flex w-72 shrink-0 border-r border-border bg-background flex-col overflow-hidden">
        <ListaPanel {...listaProps} />
      </div>

      {/* Panel derecho — chat */}
      <div className="hidden md:flex flex-1 flex-col min-w-0 overflow-hidden">
        <ChatPanel
          {...chatPropsBase}
          scrollRef={scrollDesktopRef}
          mostrarBotonVolver={false}
        />
      </div>
    </div>
  )
}
