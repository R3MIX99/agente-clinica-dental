# n8n — Workflows del Agente Clínica Dental

Esta carpeta es la **fuente de verdad** de los workflows de n8n, versionados en git.

## Workflows

| Archivo | Nombre en n8n | Descripción |
|---------|---------------|-------------|
| `01-recordatorio-citas-24h.json` | 01 Recordatorio de Citas 24h | Cron cada 15 min — busca citas en ventana 23h-25h y envía recordatorio por Telegram |
| `02-asistente-inbound.json` | 02 Asistente Inbound | Recibe mensajes de Telegram, responde FAQ con Claude y hace handoff a agente humano |
| `03-respuesta-agente-humano.json` | 03 Respuesta de Agente Humano | Webhook POST desde el dashboard — reenvía el mensaje del agente al paciente por Telegram |

## Flujo de ida y vuelta (round-trip)

La carpeta `/n8n` en git es la fuente canónica. Seguir este proceso garantiza que cada cambio quede versionado:

### Importar a n8n (primera vez o al actualizar desde git)

1. Abrir n8n: `https://n8n-n8n.1wmvpi.easypanel.host/`
2. Ir a **Workflows** en el menú lateral.
3. Clic en **Add workflow** > **Import from File**.
4. Seleccionar el archivo `.json` de esta carpeta.
5. Revisar que las credenciales queden correctamente mapeadas (ver sección de credenciales más abajo).
6. Activar el workflow con el toggle superior derecho.

### Editar en n8n y guardar de vuelta al repo

1. Realizar los cambios en el editor de n8n.
2. Guardar en n8n (Ctrl+S o botón Save).
3. Exportar: menú del workflow (tres puntos en la esquina) > **Download** / **Export**.
4. **Guardar sobre el mismo archivo** en esta carpeta (mismo nombre, sin añadir sufijos ni fechas).
5. Hacer commit del JSON actualizado:
   ```bash
   git add n8n/01-recordatorio-citas-24h.json
   git commit -m "fix(n8n): ajustar filtro de ventana en workflow 01"
   git push
   ```

## Credenciales a configurar en n8n

Antes de activar los workflows, crear las siguientes credenciales en **Settings > Credentials**:

| Nombre esperado en los workflows | Tipo | Campos |
|----------------------------------|------|--------|
| `Telegram Bot — Clinica Dental` | Telegram API | Access Token (del BotFather) |

Las demás integraciones (Supabase y Anthropic) se hacen via nodos **HTTP Request** usando variables de entorno de n8n (`$env.SUPABASE_URL`, `$env.SUPABASE_SERVICE_ROLE_KEY`, `$env.ANTHROPIC_API_KEY`). Configurarlas en **Settings > Environment Variables** de la instancia n8n.

### Variables de entorno requeridas en n8n

```
SUPABASE_URL=https://vbsoujyosifqtazcidul.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<copiar del panel de Supabase>
ANTHROPIC_API_KEY=<clave de Anthropic>
N8N_SHARED_SECRET=<secreto aleatorio seguro, mismo valor que en el dashboard>
```

## Configurar el webhook de Telegram (Workflow 02)

Después de importar y activar el Workflow 02, obtener la URL del webhook de Telegram Trigger en n8n y registrarla con BotFather:

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<URL_DEL_TRIGGER_N8N>
```

O bien, dejar que n8n lo registre automáticamente al activar el workflow con un nodo Telegram Trigger configurado.

## URL del webhook del Workflow 03 (para el dashboard)

Al activar el Workflow 03, n8n expone un webhook en:

```
https://n8n-n8n.1wmvpi.easypanel.host/webhook/agente-mensaje
```

Esta URL va en la variable de entorno `N8N_OUTBOUND_WEBHOOK_URL` del dashboard.

## Notas de seguridad

- Las credenciales **no se versionan**. Los JSON solo referencian credenciales por nombre.
- El secreto `N8N_SHARED_SECRET` debe ser idéntico en n8n y en el dashboard. Usar un valor aleatorio de al menos 32 caracteres.
- El header `X-Shared-Secret` valida que la llamada viene del dashboard y no de terceros.
