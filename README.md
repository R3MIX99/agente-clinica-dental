# Agente IA para Clínica Dental

Demo de un agente de inteligencia artificial para clínica dental con recordatorios automáticos de cita, asistente conversacional FAQ y handoff a agente humano.

## Arquitectura

```
Telegram ─────────────────────────────────────────────────────────────────────┐
                                                                              |
WhatsApp (preparado, no activo) ──────────────────────────────────────────────┤
                                                                              |
                                                                    n8n (orquestador)
                                                                    /          \
                                                              Claude API    Supabase (Postgres + Realtime)
                                                                                |
                                                                        Dashboard Next.js
```

### Diagrama de flujo detallado

```
[Paciente] -> [Telegram] -> [n8n Workflow 2: Asistente Inbound]
                                    |
                          ┌─────────┴──────────┐
                          |                    |
                    mode = bot           mode = humano
                          |                    |
                    [Claude API]         [NoOp: espera
                          |              agente en dashboard]
                    [Respuesta FAQ]             |
                          |             [Dashboard: agente
                    [Supabase:           toma control]
                     guardar msg]               |
                                        [Workflow 3: enviar
                                         mensaje del agente]
                                                |
                                         [Telegram: entrega]

[Cron cada hora] -> [Workflow 1: Recordatorio 24h]
                         |
                  [Supabase: buscar citas
                   en ventana 23h-25h]
                         |
                  [Telegram: enviar recordatorio]
                         |
                  [Supabase: marcar enviado]
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Canal | Telegram (WhatsApp preparado) |
| Orquestación | n8n (instancia en EasyPanel) |
| Base de datos | Supabase (Postgres + Realtime) |
| Dashboard | Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui |
| IA | Claude API (Anthropic) — modelo `claude-haiku-4-5-20251001` |
| Animaciones | framer-motion |

## Estructura del repositorio

```
/
├── dashboard/          # Next.js App Router — panel de control de la clínica
│   ├── app/            # Rutas y páginas
│   ├── components/     # Componentes UI
│   ├── lib/            # Clientes Supabase, utilidades
│   └── types/          # Tipos TypeScript generados desde Supabase
├── supabase/
│   ├── migrations/     # SQL de esquema (aplicar en orden)
│   └── seed.sql        # Datos de ejemplo para demo
├── n8n/                # Workflows exportados como JSON + README de importación
├── docs/               # Documentación, diagramas y guía de despliegue
├── .env.example        # Variables de entorno requeridas (sin valores reales)
└── README.md           # Este archivo
```

## Requisitos previos

- Node.js 20+
- Cuenta en Supabase
- Instancia de n8n (propia o en la nube)
- Bot de Telegram (via BotFather)
- API key de Anthropic

## Setup por carpeta

### 1. Supabase (`/supabase`)

Aplica las migraciones en orden y luego el seed. Ver `/supabase/README.md` para instrucciones detalladas.

```bash
# Con CLI de Supabase
supabase link --project-ref <TU_PROJECT_REF>
supabase db push
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

### 2. n8n (`/n8n`)

Importa los tres workflows desde la interfaz de n8n y configura las credenciales. Ver `/n8n/README.md`.

### 3. Dashboard (`/dashboard`)

```bash
cd dashboard
cp ../.env.example .env.local   # Completa las variables
npm install
npm run dev                      # http://localhost:3000
```

## Funcionalidades

1. **Recordatorios automáticos**: el Workflow 1 de n8n corre cada hora y envía un mensaje por Telegram a los pacientes con cita en las próximas 24 horas (fecha, hora, servicio y costo).

2. **Asistente FAQ**: el Workflow 2 recibe mensajes de Telegram, consulta `clinic_info` y `services` en Supabase, y usa Claude para responder preguntas frecuentes (ubicación, horarios, servicios, cómo agendar, formas de pago, facturación).

3. **Handoff a agente humano**: cuando el paciente pide hablar con una persona, la conversación pasa a modo `humano` y aparece como pendiente en el dashboard. El agente toma el control y responde desde el panel; sus mensajes llegan al paciente via Telegram a través del Workflow 3.

## Variables de entorno

Ver `.env.example` con descripción de cada variable.

## Seguridad

- El token de GitHub y todas las claves de API se manejan fuera del repositorio.
- La `service_role` key de Supabase solo se usa en el servidor (n8n y route handlers de Next.js).
- RLS habilitado en todas las tablas de Supabase.
