"use client"

import { useEffect } from "react"

// Registra el service worker minimo requerido para que el navegador
// (sobre todo Chrome/Android) ofrezca "Instalar app" en vez de solo
// "Crear acceso directo".
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
  }, [])

  return null
}
