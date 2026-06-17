"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { useAtencion } from "@/lib/atencion-context"

// Escucha cambios de modo en conversaciones y mensajes entrantes.
// Se monta en el layout y permanece activo sin importar en que pagina este el usuario.
// Alimenta el mismo Set<string> que usa ConversacionesClient para los puntos por conv,
// de modo que al navegar a /conversaciones los indicadores ya esten activos.
export function GlobalAtencionListener() {
  const { addAtencion, removeAtencion } = useAtencion()
  const pathname = usePathname()
  const humanoConvsRef = useRef<Set<string>>(new Set())
  const pathnameRef = useRef(pathname)

  // Mantener la referencia de pathname actualizada para los callbacks de Realtime
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  // Carga inicial + suscripciones Realtime
  useEffect(() => {
    // Consulta inicial: cargar todas las convs activas en modo humano
    supabase
      .from("conversations")
      .select("id")
      .eq("mode", "humano")
      .neq("status", "cerrada")
      .is("deleted_at", null)
      .then(({ data }) => {
        if (data) {
          humanoConvsRef.current = new Set(data.map((c: { id: string }) => c.id))
        }
      })

    // Suscripción a actualizaciónes de conversaciones
    const chConvs = supabase
      .channel("global-rt-conversations")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations" },
        (payload) => {
          const upd = payload.new as {
            id: string
            mode?: string
            status?: string
            deleted_at?: string | null
          }

          // Si se archiva o cierra, sacarla del set de humano y quitar indicador
          if (upd.deleted_at || upd.status === "cerrada") {
            humanoConvsRef.current.delete(upd.id)
            removeAtencion(upd.id)
            return
          }

          if (upd.mode === "humano") {
            humanoConvsRef.current.add(upd.id)
            // Solo activar si el usuario NO esta en /conversaciones.
            // Cuando esta ahi, ConversacionesClient lo maneja con el check de selectedId,
            // evitando el punto en la conv que ya tiene abierta.
            if (!pathnameRef.current.startsWith("/conversaciones")) {
              addAtencion(upd.id)
            }
          } else if (upd.mode === "bot") {
            humanoConvsRef.current.delete(upd.id)
            removeAtencion(upd.id)
          }
        }
      )
      .subscribe()

    // Suscripción a mensajes entrantes
    const chMsgs = supabase
      .channel("global-rt-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as {
            conversation_id: string
            direction: string
          }

          // Solo agregar si es mensaje del paciente en una conv humano
          // y el usuario esta en OTRA pagina (en /conversaciones lo maneja ConversacionesClient)
          if (
            msg.direction === "entrante" &&
            humanoConvsRef.current.has(msg.conversation_id) &&
            !pathnameRef.current.startsWith("/conversaciones")
          ) {
            addAtencion(msg.conversation_id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(chConvs)
      supabase.removeChannel(chMsgs)
    }
  }, [addAtencion, removeAtencion])

  return null
}
