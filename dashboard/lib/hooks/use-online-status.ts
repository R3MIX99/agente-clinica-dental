"use client"

import { useEffect, useState } from "react"

// Estado de conexion del navegador, reactivo a los eventos online/offline.
// Arranca en `true` para evitar parpadeos de contenido en el primer render
// (SSR no conoce navigator.onLine); se corrige de inmediato en el efecto.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const marcarOnline = () => setOnline(true)
    const marcarOffline = () => setOnline(false)
    window.addEventListener("online", marcarOnline)
    window.addEventListener("offline", marcarOffline)
    return () => {
      window.removeEventListener("online", marcarOnline)
      window.removeEventListener("offline", marcarOffline)
    }
  }, [])

  return online
}
