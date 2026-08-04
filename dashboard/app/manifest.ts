import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DentAI — Panel de Control",
    short_name: "DentAI",
    description: "Panel de control del agente IA para clinica dental",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#22d3ee",
    icons: [
      { src: "/branding/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/branding/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
