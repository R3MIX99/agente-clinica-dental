# Agente IA para Clinica Dental — SaaS Multi-tenant

Plataforma SaaS para clinicas dentales con agente de IA conversacional, recordatorios automaticos de cita, handoff a agente humano y panel de administracion multi-tenant.

## Arquitectura

```
Telegram (bot por clinica) ─────────────────────────────────────────────┐
                                                                        |
WhatsApp (preparado, no activo) ────────────────────────────────────────┤
                                                                        |
                                                              n8n (orquestador)
                                                              /          \
                                                        Claude API    Supabase (Postgres + Realtime)
                                                                          |
                                                                  Dashboard Next.js
                                                                  (clinicas + superadmin)
```

## Modelo multi-tenant

La plataforma sigue la jerarquia: **Cuenta → Clinicas → Usuarios/Membresias**.

```
Cuenta (empresa)
  └── Suscripcion (plan activo)
  └── Clinica 1
  │     ├── Usuarios (membresias)
  │     ├── Pacientes / Citas / Conversaciones
  │     ├── Agente IA (configuracion: FAQ, servicios, horarios)
  │     └── Canal (Telegram bot propio)
  └── Clinica 2
        └── ...
```

Cada clinica opera en aislamiento total por RLS en Postgres. Un usuario de la Clinica A no puede ver ni modificar datos de la Clinica B, ni por UI ni manipulando parametros de URL o API.

### Como se registra una empresa

1. El administrador de la empresa accede a `/registro` y crea su cuenta con nombre y contrasena.
2. El sistema crea automaticamente: `Cuenta`, `Clinica` inicial, `Perfil`, `Membresia` como `administrador` y `Suscripcion` en periodo de prueba.
3. El administrador completa el onboarding (`/onboarding`) con los datos de la clinica.
4. Desde `/ajustes` configura: identidad de marca, servicios, FAQ y canal de Telegram.

### Planes y add-ons

| Plan | Clinicas | Doctores | Usuarios | Saldo IA/mes |
|---|---|---|---|---|
| Solo | 1 | 1 | 1 | $120 MXN |
| Profesional | 1 | 5 | 2 | $380 MXN |
| Clinica | 3 | 12 | 4 | $760 MXN |

- El saldo de IA se descuenta por consumo real (tokens de entrada/salida) con markup configurable.
- Los add-ons permiten ampliar doctores, usuarios y recordatorios sin cambiar de plan.
- El cambio de plan aplica prorrateo automatico; la suscripcion activa se ajusta en el siguiente ciclo.
- Los pagos se procesan via Mercado Pago (suscripciones recurrentes).

### Panel de superadmin (`/superadmin`)

Accesible solo para usuarios con `rol: "superadmin"` en sus metadatos de Auth.

| Seccion | Funcion |
|---|---|
| Metricas | MRR estimado, cuentas activas, en prueba, nuevas del mes, distribucion por plan |
| Cuentas | Lista filtrable; detalle con clinicas, usuarios, historial de pagos, uso del mes |
| Planes | CRUD de planes: crear, editar precios/limites, activar/desactivar |

Acciones sensibles (suspender/reactivar cuenta) requieren confirmacion explicita. El superadmin no accede a datos clinicos de pacientes (historiales, mensajes, citas); solo ve agregados de operacion.

Para asignar el rol de superadmin a un usuario: **Authentication → Users → [usuario] → User Metadata → `{"rol": "superadmin"}`**, luego cerrar y volver a iniciar sesion.

## Stack

| Capa | Tecnologia |
|---|---|
| Canal | Telegram (WhatsApp preparado) |
| Orquestacion | n8n (instancia en EasyPanel) |
| Base de datos | Supabase (Postgres + Realtime + Auth) |
| Dashboard | Next.js App Router + TypeScript + Tailwind + shadcn/ui |
| IA | Claude API (Anthropic) — `claude-sonnet-4-6` |
| Pagos | Mercado Pago (suscripciones recurrentes) |
| Animaciones | framer-motion |

## Estructura del repositorio

```
/
├── dashboard/          # Next.js App Router — panel de control
│   ├── app/
│   │   ├── (app)/      # Rutas de clinica (autenticado)
│   │   ├── (auth)/     # Login / registro
│   │   ├── (superadmin)/ # Panel de superadmin
│   │   └── api/        # Route handlers (webhooks, consumo IA)
│   ├── components/     # Componentes UI
│   ├── lib/            # Clientes Supabase, n8n, utilidades
│   └── types/          # Tipos TypeScript generados desde Supabase
├── supabase/
│   ├── migrations/     # SQL de esquema (aplicar en orden 0001→0009)
│   └── seed.sql        # Datos de ejemplo para demo
├── n8n/                # Workflows exportados como JSON (fuente de verdad)
│   ├── 01-recordatorio-citas-24h.json
│   ├── 02-asistente-inbound.json
│   └── 03-respuesta-agente-humano.json
├── docs/               # Documentacion y guia de despliegue
├── .env.example        # Variables de entorno requeridas (sin valores reales)
└── README.md
```

## Requisitos previos

- Node.js 20+
- Cuenta en Supabase
- Instancia de n8n (propia o en la nube — EasyPanel recomendado)
- Bot de Telegram por clinica (via BotFather)
- API key de Anthropic
- Cuenta de Mercado Pago (para billing)

## Setup

### 1. Supabase (`/supabase`)

Aplica las migraciones en orden:

```bash
supabase link --project-ref <TU_PROJECT_REF>
supabase db push
```

O aplica cada archivo `0001_*.sql` → `0009_*.sql` desde el SQL Editor de Supabase.

### 2. Dashboard (`/dashboard`)

```bash
cd dashboard
cp ../.env.example .env.local   # Completa las variables
npm install
npm run dev                      # http://localhost:3002
```

Variables requeridas (ver `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — solo en servidor, nunca en cliente
- `ANTHROPIC_API_KEY`
- `N8N_OUTBOUND_WEBHOOK_URL` / `N8N_SHARED_SECRET`
- `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` (Mercado Pago)

### 3. n8n (`/n8n`)

Importa los tres workflows y configura:

**WF01 — Recordatorio de Citas 24h**
- Importa el JSON tal cual. No requiere configuracion adicional por clinica.
- Configura el nodo `Contexto de clinica` con el UUID de la clinica y la cuenta.
- Credencial Supabase: service role key.

**WF02 — Asistente Inbound** (duplicar por cada clinica)
- En el nodo `Extraer datos del mensaje`, reemplaza `REEMPLAZAR_CON_UUID_DE_CLINICA` con el UUID de la clinica.
- Asigna la credencial de Telegram del bot de esa clinica.
- Credenciales necesarias: Supabase (service role) y Anthropic.

**WF03 — Respuesta de Agente Humano** (compartido entre clinicas)
- Configura el secreto en el nodo `Validar secreto`: debe coincidir con `N8N_SHARED_SECRET` en el dashboard.
- Credenciales necesarias: Supabase (service role) y Telegram del bot.

## Workflows de n8n — descripcion

| Workflow | Descripcion |
|---|---|
| WF01 Recordatorio | Corre cada 15 min. Filtra citas en ventana 23-25h, envia recordatorio por Telegram, registra en metering. |
| WF02 Inbound | Recibe mensajes de Telegram. Verifica saldo IA, consulta datos de la clinica, genera respuesta con Claude, registra consumo, actualiza analitica. Handoff si saldo agotado. |
| WF03 Agente | Recibe mensajes del agente desde el dashboard. Verifica aislamiento de clinica, envia por Telegram, guarda en Supabase. |

## Seguridad

- Todas las claves de API y secretos se configuran fuera del repositorio (`.env.local`, variables de entorno en n8n).
- `.env` y `.env.*` estan en `.gitignore`; solo `.env.example` (sin valores) esta versionado.
- La `service_role` key de Supabase solo se usa en el servidor.
- RLS habilitado en todas las tablas; politicas por `clinica_id` con la funcion `usuario_en_clinica()`.
- El token del bot de Telegram se almacena en `clinic_channels.config` (JSONB en Supabase), nunca en el cliente ni en el repositorio.
- Las funciones SECURITY DEFINER estan restringidas: el rol `anon` no puede ejecutar funciones de negocio.
- Cambios de permisos y eliminaciones permanentes los hace el administrador desde la UI; nunca automaticamente.

## Calidad de codigo

```bash
cd dashboard
npx tsc --noEmit    # 0 errores
npm run lint        # 0 errores (solo advertencias)
npm run build       # build exitoso
```

## Cuenta demo

La migracion inicial crea:
- Cuenta: `00000000-0000-0000-0000-000000000001` (Cuenta demo)
- Clinica: `00000000-0000-0000-0000-000000000002` (Infantil Dental Klinic)
- Planes: Solo, Profesional, Clinica

Usuarios demo para pruebas: `admin@clinicadental.com`, `doctor@clinicadental.com`, `supervisor@clinicadental.com`.
