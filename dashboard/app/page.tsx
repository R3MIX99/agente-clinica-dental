import Link from "next/link"
import { Stethoscope, CalendarCheck, MessageSquare, Bell, BarChart3, Check, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { createServerClient } from "@/lib/supabase/server"

// Datos estaticos que complementan cada plan con descripcion y caracteristicas
const EXTRAS_PLAN: Record<string, {
  destacado: boolean
  badge?: string
  descripcion: string
  caracteristicas: string[]
}> = {
  Solo: {
    destacado: false,
    descripcion: "Para consultorios independientes que quieren automatizar desde el primer dia.",
    caracteristicas: [
      "1 clinica y 1 doctor",
      "Agente IA 24/7 en WhatsApp",
      "Agenda y recordatorios automaticos",
      "Ficha digital de pacientes",
      "Panel de control basico",
    ],
  },
  Profesional: {
    destacado: true,
    badge: "Mas popular",
    descripcion: "Para clinicas en crecimiento con equipo y reportes avanzados.",
    caracteristicas: [
      "1 clinica, hasta 5 doctores",
      "2 usuarios administrativos",
      "Todo lo del plan Solo",
      "Panel de reportes avanzado",
      "Soporte prioritario por correo",
    ],
  },
  Clinica: {
    destacado: false,
    descripcion: "Para grupos dentales con varias sucursales.",
    caracteristicas: [
      "Hasta 3 clinicas",
      "Hasta 12 doctores y 4 usuarios",
      "Todo lo del plan Profesional",
      "Gestion multi-sucursal",
      "Soporte dedicado",
    ],
  },
}

export default async function LandingPage() {
  const db = createServerClient()
  const { data: planes } = await db
    .from("planes")
    .select("id, nombre, precio_mensual_mxn, precio_anual_mxn")
    .eq("activo", true)
    .order("precio_mensual_mxn")

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Encabezado */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="font-semibold text-foreground">DentalIA</span>
          </div>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Iniciar sesion</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/registro">Empezar gratis</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <Badge variant="secondary" className="mb-6 text-xs font-medium">
            14 dias de prueba gratuita — sin tarjeta de credito
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            El asistente de IA que
            <br className="hidden sm:inline" /> cuida a tus pacientes
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Agenda citas, responde preguntas frecuentes, envia recordatorios y
            mantiene tu clinica funcionando — sin que tengas que estar pendiente.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/registro">
                Empezar gratis
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/login">Ya tengo cuenta</Link>
            </Button>
          </div>
        </section>

        <Separator />

        {/* Caracteristicas */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              Todo lo que tu clinica necesita
            </h2>
            <p className="mt-3 text-muted-foreground">
              Un solo sistema que conecta tu agenda, tus pacientes y tu equipo.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icono: MessageSquare,
                titulo: "Conversaciones automaticas",
                texto: "El agente responde en WhatsApp a cualquier hora: horarios, precios y dudas frecuentes.",
              },
              {
                icono: CalendarCheck,
                titulo: "Agenda inteligente",
                texto: "Los pacientes agendan, reprograman o cancelan citas sin llamar ni esperar.",
              },
              {
                icono: Bell,
                titulo: "Recordatorios automaticos",
                texto: "Envia recordatorios el dia anterior y reduce las inasistencias hasta un 40 %.",
              },
              {
                icono: BarChart3,
                titulo: "Panel de control",
                texto: "Consulta tu agenda, fichas de pacientes, estudios y notas clinicas en un solo lugar.",
              },
            ].map(({ icono: Icono, titulo, texto }) => (
              <Card key={titulo} className="border-border">
                <CardHeader className="pb-3">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icono className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base">{titulo}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{texto}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        {/* Precios */}
        <section id="precios" className="mx-auto max-w-6xl px-4 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              Planes y precios
            </h2>
            <p className="mt-3 text-muted-foreground">
              Todos los planes incluyen 14 dias de prueba gratuita.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {(planes ?? []).map((plan) => {
              const extras = EXTRAS_PLAN[plan.nombre] ?? {
                destacado: false,
                descripcion: "",
                caracteristicas: [],
              }
              return (
                <Card
                  key={plan.id}
                  className={extras.destacado ? "border-primary shadow-md relative" : "border-border relative"}
                >
                  {extras.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="text-xs">{extras.badge}</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">{plan.nombre}</CardTitle>
                    <p className="text-sm text-muted-foreground">{extras.descripcion}</p>
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-foreground">
                        ${Number(plan.precio_mensual_mxn).toLocaleString("es-MX")}
                      </span>
                      <span className="ml-1 text-sm text-muted-foreground">MXN / mes</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      o ${Number(plan.precio_anual_mxn).toLocaleString("es-MX")} MXN al ano
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      asChild
                      className="w-full"
                      variant={extras.destacado ? "default" : "outline"}
                    >
                      <Link href={`/registro?plan=${plan.id}`}>Empezar gratis</Link>
                    </Button>
                    <ul className="space-y-2">
                      {extras.caracteristicas.map((c) => (
                        <li key={c} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <Separator />

        {/* CTA final */}
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
            Lista para empezar?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Configura tu clinica en minutos. Sin contratos, sin instalaciones
            ni costos ocultos.
          </p>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link href="/registro">
                Crear mi cuenta gratis
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Pie de pagina */}
      <footer className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium text-muted-foreground">DentalIA</span>
            </div>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} DentalIA. Todos los derechos reservados.
            </p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <Link href="/login" className="hover:text-foreground transition-colors">
                Iniciar sesion
              </Link>
              <Link href="/registro" className="hover:text-foreground transition-colors">
                Registrarse
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
