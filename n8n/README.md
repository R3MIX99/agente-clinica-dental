# n8n — Workflows del Agente Clínica Dental

Esta carpeta es la **fuente de verdad** de los workflows de n8n, versionados en git.

## Workflows

| Archivo | Nombre en n8n | Descripción |
|---------|---------------|-------------|
| `01-recordatorio-citas-24h.json` | 01 Recordatorio de Citas 24h | Cron cada 15 min — busca citas en ventana 23-25h y envía recordatorio por Telegram |
| `02-asistente-inbound.json` | 02 Asistente Inbound | Recibe mensajes de Telegram, responde FAQ con Claude y hace handoff a agente humano |
| `03-respuesta-agente-humano.json` | 03 Respuesta de Agente Humano | Webhook POST desde el dashboard — reenvía el mensaje del agente al paciente por Telegram |

## Multi-tenant por secret_token (una sola instalación para todas las clínicas)

Estos workflows son **multi-tenant**: se importan **una sola vez** y atienden a todas
las clínicas. No hay credencial de Telegram fija ni `clinica_id` quemado.

- **Entrada (WF02):** un Webhook genérico recibe los updates de todos los bots. Telegram
  envía un `secret_token` por clínica en el header `X-Telegram-Bot-Api-Secret-Token`. El
  workflow resuelve la clínica con el RPC `canal_telegram_por_secret_token` y obtiene el
  `bot_token` de esa clínica.
- **Salida y recordatorios (WF01 y WF03):** obtienen el `bot_token` de la clínica con el
  RPC `canal_telegram_por_clinica` y envían por HTTP a `api.telegram.org/bot<token>/sendMessage`.
- El `bot_token` y el `secret_token` viven en `clinic_channels.config` en Supabase (los
  guarda el dashboard al conectar el bot en el onboarding o desde el panel de superadmin).
  **Nunca** están en estos JSON.

| Tipo de llamada | Mecanismo |
|-----------------|-----------|
| Supabase (REST y RPC) | HTTP Request + credencial `supabaseApi` |
| Claude / Anthropic API | Nodo Anthropic + credencial `anthropicApi` |
| Telegram (envío) | HTTP Request a la API de Telegram con el `bot_token` de la clínica |
| Secreto compartido (Workflow 3) | Constante en Code node (editar una sola vez) |

## Variables de entorno del dashboard relacionadas

```
N8N_OUTBOUND_WEBHOOK_URL=https://n8n-n8n.1wmvpi.easypanel.host/webhook/agente-mensaje
N8N_TELEGRAM_INBOUND_URL=https://n8n-n8n.1wmvpi.easypanel.host/webhook/telegram-inbound
N8N_SHARED_SECRET=<mismo valor que el SECRETO del Code node del WF03>
```

`N8N_TELEGRAM_INBOUND_URL` es la URL del Webhook del WF02; el dashboard la usa al hacer
`setWebhook` de cada bot (con el `secret_token` de la clínica).

## Credenciales a crear en n8n antes de importar

Ir a **Settings > Credentials > Add credential** y crear las siguientes:

### 1. Supabase — Clinica Dental
- Tipo: **Supabase**
- Nombre exacto: `Supabase — Clinica Dental`
- Host: `https://vbsoujyosifqtazcidul.supabase.co`
- Service Role Secret: `<copiar de Supabase: Project Settings > API > service_role>`

### 2. Anthropic account
- Tipo: **Anthropic**
- Nombre exacto: `Anthropic account`
- API Key: `<tu API key de Anthropic>`

(Ya no se crea una credencial de Telegram: el token de cada clínica se lee de Supabase.)

## Secreto compartido (Workflow 3)

Abrir `03-respuesta-agente-humano.json` en el editor de n8n, ir al nodo **"Validar secreto y extraer body"** y cambiar:

```javascript
const SECRETO = 'CAMBIA_ESTE_SECRETO_POR_UNO_SEGURO';
```

Usar el mismo valor en el `.env.local` del dashboard:
```
N8N_SHARED_SECRET=el_mismo_valor
```

## Importar a n8n

1. Abrir n8n: `https://n8n-n8n.1wmvpi.easypanel.host/`
2. **Workflows → Add workflow → Import from File**
3. Seleccionar el archivo `.json` de esta carpeta
4. Mapear las credenciales cuando n8n lo solicite (usa los nombres exactos de arriba)
5. Activar el workflow con el toggle superior derecho

**Orden recomendado de activación:**
1. Workflow 02 primero (registra el webhook de Telegram)
2. Workflow 03 (expone el webhook para el dashboard)
3. Workflow 01 (cron de recordatorios)

## URL del webhook del Workflow 03

Al activar el Workflow 03, n8n expone:
```
https://n8n-n8n.1wmvpi.easypanel.host/webhook/agente-mensaje
```

Esta URL va en `.env.local` del dashboard:
```
N8N_OUTBOUND_WEBHOOK_URL=https://n8n-n8n.1wmvpi.easypanel.host/webhook/agente-mensaje
```

## Configurar webhook de Telegram (Workflow 02)

Después de activar el Workflow 02, registrar el webhook con:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL_DEL_TRIGGER_N8N>
```

n8n también puede registrarlo automáticamente al activar el nodo Telegram Trigger.

## Flujo de round-trip (importar → editar → versionar)

1. Editar en n8n y guardar (Ctrl+S)
2. Exportar: menú del workflow (tres puntos) → **Download**
3. Guardar sobre el mismo archivo en esta carpeta (mismo nombre)
4. Commit:
   ```bash
   git add n8n/02-asistente-inbound.json
   git commit -m "fix(n8n): ajuste en workflow 02"
   git push
   ```

Las credenciales nunca se versionan — solo sus nombres de referencia.
