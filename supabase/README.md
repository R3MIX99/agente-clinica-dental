# Supabase — Agente Clínica Dental

Proyecto ya provisionado en Supabase (org Codeal.ai).

## Datos del proyecto

- Nombre: agente-clinica-dental
- Project ref: vbsoujyosifqtazcidul
- URL del API: https://vbsoujyosifqtazcidul.supabase.co
- Región: us-east-2

## Variables de entorno

Para el dashboard (públicas, seguras para el navegador):

```
NEXT_PUBLIC_SUPABASE_URL=https://vbsoujyosifqtazcidul.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<copiar del panel de Supabase>
```

La SERVICE ROLE KEY es secreta. No se incluye aquí. Cópiala desde el panel de Supabase:
Project Settings -> API -> service_role. Úsala solo en el servidor (n8n y route handlers).

```
SUPABASE_URL=https://vbsoujyosifqtazcidul.supabase.co
SUPABASE_SERVICE_ROLE_KEY=   # copiar del panel, no versionar
```

## Estado actual

Ya aplicado en el proyecto vivo:
- Migración 0001_init: enums, tablas (clinic_info, services, patients, agents,
  appointments, conversations, messages), índices, trigger y RLS.
- Migración 0002_fix_function_search_path: fija search_path del trigger (aviso de seguridad).
- seed.sql: datos de ejemplo (1 clínica, 6 servicios, 4 pacientes, 3 agentes, 5 citas
  con 2 dentro de la ventana 24h, 2 conversaciones y 4 mensajes).

## Reaplicar en otro entorno

Con la CLI de Supabase:

```bash
supabase link --project-ref vbsoujyosifqtazcidul
supabase db push          # aplica las migraciones de /supabase/migrations
# seed:
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

O pegando el contenido de los .sql en el SQL Editor del panel, en orden:
0001_init.sql, 0002_fix_function_search_path.sql, seed.sql.

## Regenerar tipos TypeScript

```bash
supabase gen types typescript --project-id vbsoujyosifqtazcidul > dashboard/types/supabase.ts
```

## Realtime

Para el chat en vivo del dashboard, habilita Realtime en la tabla messages
(Database -> Replication) o via:

```sql
alter publication supabase_realtime add table messages;
```
