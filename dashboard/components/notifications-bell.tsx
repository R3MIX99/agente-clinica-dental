"use client"

import { useEffect, useState } from "react"
import { Bell, CalendarPlus, CalendarClock, CalendarX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"

type Notificacion = {
  id: string
  tipo: "cita_agendada" | "cita_reagendada" | "cita_cancelada"
  paciente_nombre: string | null
  doctor_nombre: string | null
  fecha_hora: string | null
  leida: boolean
  created_at: string
}

const MAX_NOTIFICACIONES = 30

function formatFecha(raw: string | null): string {
  if (!raw) return ""
  const d = new Date(raw)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function tiempoRelativoCorto(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "hace un momento"
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

function textoNotificacion(n: Notificacion): { titulo: string; icono: React.ReactNode } {
  const paciente = n.paciente_nombre || "Un paciente"
  switch (n.tipo) {
    case "cita_agendada":
      return { titulo: `${paciente} agendó una cita`, icono: <CalendarPlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> }
    case "cita_reagendada":
      return { titulo: `${paciente} reagendó su cita`, icono: <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" /> }
    case "cita_cancelada":
      return { titulo: `${paciente} canceló su cita`, icono: <CalendarX className="h-4 w-4 text-destructive" /> }
  }
}

export function NotificationsBell({ clinicaId }: { clinicaId: string | null }) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [open, setOpen] = useState(false)

  const noLeidas = notificaciones.filter((n) => !n.leida).length

  useEffect(() => {
    if (!clinicaId) return
    const supabase = createClient()

    supabase
      .from("notificaciones")
      .select("id, tipo, paciente_nombre, doctor_nombre, fecha_hora, leida, created_at")
      .eq("clinica_id", clinicaId)
      .order("created_at", { ascending: false })
      .limit(MAX_NOTIFICACIONES)
      .then(({ data }) => {
        if (data) setNotificaciones(data as Notificacion[])
      })

    const channel = supabase
      .channel(`notificaciones-realtime-${clinicaId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones", filter: `clinica_id=eq.${clinicaId}` },
        (payload) => {
          setNotificaciones((prev) => [payload.new as Notificacion, ...prev].slice(0, MAX_NOTIFICACIONES))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clinicaId])

  function marcarTodasComoLeidas() {
    if (noLeidas === 0 || !clinicaId) return
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
    const supabase = createClient()
    supabase
      .from("notificaciones")
      .update({ leida: true })
      .eq("clinica_id", clinicaId)
      .eq("leida", false)
      .then(() => {})
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) marcarTodasComoLeidas()
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificaciones" className="relative">
          <Bell className="h-4 w-4" />
          {noLeidas > 0 && (
            <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none">
              {noLeidas > 9 ? "9+" : noLeidas}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notificaciones.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No tienes notificaciones
          </p>
        ) : (
          <ScrollArea className="h-80">
            <div className="flex flex-col">
              {notificaciones.map((n) => {
                const { titulo, icono } = textoNotificacion(n)
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-2.5 px-2 py-2.5 text-sm ${!n.leida ? "bg-accent/50" : ""}`}
                  >
                    <span className="mt-0.5 shrink-0">{icono}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatFecha(n.fecha_hora)}
                        {n.doctor_nombre ? ` · ${n.doctor_nombre}` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70">{tiempoRelativoCorto(n.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
