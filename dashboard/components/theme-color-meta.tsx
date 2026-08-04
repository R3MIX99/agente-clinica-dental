"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

// Colores igual a --background en globals.css (claro / oscuro), convertidos
// de oklch a hex porque los navegadores moviles no soportan oklch() de
// forma consistente en <meta name="theme-color">.
const COLOR_CLARO = "#f8f8f8"
const COLOR_OSCURO = "#02090e"

// Ajusta el color de la barra de estado del sistema (Android/iOS) para que
// siga el tema activo (claro/oscuro) en vez de quedar fijo con el color de
// marca. Se actualiza tanto al cargar como al cambiar el tema.
export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme()
  const [montado, setMontado] = useState(false)

  useEffect(() => setMontado(true), [])

  useEffect(() => {
    if (!montado) return
    const color = resolvedTheme === "dark" ? COLOR_OSCURO : COLOR_CLARO
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement("meta")
      meta.name = "theme-color"
      document.head.appendChild(meta)
    }
    meta.content = color
  }, [montado, resolvedTheme])

  return null
}
