import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { RegisterServiceWorker } from "@/components/register-sw"
import { ThemeColorMeta } from "@/components/theme-color-meta"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Clínica Dental — Panel de Control",
  description: "Panel de control del agente IA para clinica dental",
  appleWebApp: {
    title: "DentAI",
    statusBarStyle: "default",
  },
}

// Color de la barra de estado del sistema (Android/iOS) segun el tema del
// SO, para el primer render antes de hidratar. ThemeColorMeta ajusta esto
// en vivo si el usuario cambia el tema manualmente con el switch de la app.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f8f8" },
    { media: "(prefers-color-scheme: dark)", color: "#02090e" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" />
          <RegisterServiceWorker />
          <ThemeColorMeta />
        </ThemeProvider>
      </body>
    </html>
  )
}
