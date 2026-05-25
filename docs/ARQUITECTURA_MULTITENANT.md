# Arquitectura multi-tenant

Este documento registra las decisiones de arquitectura para convertir el sistema
de una sola clínica en un SaaS multi-tenant. No contiene secretos ni credenciales.
Es el entregable de la Fase S0 del plan de desarrollo SaaS.

---

## 1. Estado actual: supuestos de clínica única

El código base asume en todo momento que existe una sola clínica. Los indicadores
concretos encontrados durante la exploración:

| Archivo | Supuesto detectado |
|---|---|
| `app/(app)/ajustes/page.tsx` | `.limit(1).single()` sobre `clinic_info` |
| `app/(app)/ajustes/actions.ts` | Busca o inserta la única fila de `clinic_info` |
| `app/(app)/citas/page.tsx` | Consulta `patients`, `services`, `doctors`, `appointments` sin filtro de clínica |
| `app/(app)/citas/actions.ts` | CRUD de citas sin aislamiento por clínica |
| `app/(app)/doctores/actions.ts` | CRUD de doctores sin aislamiento; sincroniza con `auth.admin` sin prefijo de cuenta |
| `app/(app)/usuarios/actions.ts` | CRUD de perfiles y usuarios de Auth sin separación por clínica |
| `app/(app)/conversaciones/ConversacionesClient.tsx` | Muestra todas las conversaciones del sistema |
| `app/(app)/pacientes/` | Todos los pacientes son visibles a todos los usuarios |
| `lib/supabase/server.ts` (`createServerClient`) | Usa `SUPABASE_SERVICE_ROLE_KEY`: ignora RLS completamente |

Tablas actuales que no tienen columna de inquilino:
`agents`, `appointments`, `clinic_info`, `clinical_notes`, `conversations`,
`doctor_schedules`, `doctors`, `messages`, `patient_doctors`, `patients`,
`profiles`, `services`, `studies`.

---

## 2. Modelo de aislamiento elegido: base de datos compartida con aislamiento por fila

### Descripción

Una sola base de datos Supabase alberga a todos los inquilinos. Cada tabla del
dominio lleva dos columnas de referencia:

- `cuenta_id` — referencia a la cuenta (empresa que paga).
- `clinica_id` — referencia a la clínica (sede dentro de la cuenta).

Las políticas RLS de Supabase filtran automáticamente cada consulta según el
contexto del usuario autenticado, de modo que un usuario de la Cuenta A nunca
puede leer ni escribir filas de la Cuenta B.

### Por qué esta opción y no las alternativas

| Criterio | BD compartida + RLS | Esquema por inquilino | BD por inquilino |
|---|---|---|---|
| Costo de infraestructura | Bajo (un solo proyecto Supabase) | Medio | Alto (un proyecto por cliente) |
| Complejidad operativa | Baja | Alta (migraciones en N esquemas) | Muy alta |
| Escalabilidad inicial | Adecuada para cientos de clínicas | Limitada por esquemas de Postgres | Adecuada solo con muchos clientes grandes |
| Aislamiento de datos | Fuerte (RLS verificado por Postgres) | Fuerte (namespacing nativo) | Total |
| Facilidad de migración de datos actuales | Alta (columnas nuevas + UPDATE) | Media | Baja |
| Soporte nativo en Supabase | Nativo (RLS es el caso de uso previsto) | Manual | No nativo |

Para el volumen esperado (decenas a cientos de clínicas en México), la base de
datos compartida con RLS es el modelo correcto: menor costo, menor complejidad y
el que Supabase soporta de forma nativa.

---

## 3. Jerarquía de entidades nueva

```
cuentas
  └── clinicas          (una cuenta puede tener 1..N clínicas)
        └── membresias  (relación usuario ↔ clínica con rol)
        └── [todas las entidades del dominio]

planes
  └── suscripciones     (una cuenta tiene una suscripción activa a un plan)
        └── uso_metering (consumo del periodo: IA, recordatorios, doctores activos)
```

### Tablas nuevas a crear en S1

#### `cuentas`
Representa a la empresa o persona que contrata y paga.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `nombre` | `text` | Nombre comercial |
| `email_contacto` | `text` | |
| `estado` | `text` | `activa`, `prueba`, `suspendida`, `cancelada` |
| `created_at` | `timestamptz` | |

#### `clinicas`
Una sede dentro de una cuenta. Reemplaza la tabla `clinic_info` de fila única.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `cuenta_id` | `uuid` FK → `cuentas.id` | |
| `nombre` | `text` | |
| `direccion` | `text` | |
| `telefono` | `text` | |
| `email` | `text` | |
| `sitio_web` | `text` | |
| `horario` | `jsonb` | |
| `formas_pago` | `text` | |
| `facturacion` | `text` | |
| `mapa_url` | `text` | |
| `faq` | `jsonb` | |
| `activa` | `boolean` | |
| `created_at` | `timestamptz` | |

#### `membresias`
Relaciona a un usuario de Auth con una clínica y define su rol en ella.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `auth.users.id` | |
| `cuenta_id` | `uuid` FK → `cuentas.id` | |
| `clinica_id` | `uuid` FK → `clinicas.id` | Puede ser NULL si el rol es de cuenta |
| `rol` | `text` | `administrador`, `supervisor`, `doctor` |
| `activa` | `boolean` | |
| `created_at` | `timestamptz` | |

#### `planes`
Catálogo de planes del SaaS (administrado por el superadmin).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `nombre` | `text` | `Solo`, `Profesional`, `Clinica` |
| `precio_mensual_mxn` | `numeric` | |
| `precio_anual_mxn` | `numeric` | |
| `max_doctores` | `integer` | |
| `max_usuarios` | `integer` | |
| `max_clinicas` | `integer` | |
| `saldo_ia_incluido_mxn` | `numeric` | |
| `max_recordatorios_mes` | `integer` | |
| `activo` | `boolean` | |

#### `suscripciones`
Instancia activa de un plan para una cuenta.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `cuenta_id` | `uuid` FK → `cuentas.id` | |
| `plan_id` | `uuid` FK → `planes.id` | |
| `estado` | `text` | `prueba`, `activa`, `vencida`, `cancelada`, `suspendida` |
| `periodo` | `text` | `mensual`, `anual` |
| `inicio_periodo` | `date` | |
| `fin_periodo` | `date` | |
| `saldo_ia_disponible_mxn` | `numeric` | Saldo actual (incluido + recargas - consumo) |
| `recordatorios_enviados` | `integer` | Contador del periodo |
| `mp_subscription_id` | `text` | ID de suscripción en Mercado Pago (no es secreto) |
| `created_at` | `timestamptz` | |

#### `uso_metering`
Registro granular de consumo por evento (para auditoría y facturación).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `cuenta_id` | `uuid` FK → `cuentas.id` | |
| `clinica_id` | `uuid` FK → `clinicas.id` | |
| `tipo` | `text` | `ia`, `recordatorio` |
| `cantidad` | `numeric` | Para IA: costo en MXN; para recordatorio: 1 |
| `referencia_id` | `uuid` | ID de la conversación o cita relacionada |
| `created_at` | `timestamptz` | |

---

## 4. Columnas de inquilino en tablas existentes

En S1 se agrega `clinica_id uuid NOT NULL` (con FK a `clinicas.id`) a las
siguientes tablas. La columna `cuenta_id` puede resolverse siempre desde la
clínica, por lo que solo se añade donde sea necesario para simplificar las
políticas RLS sin hacer JOIN.

| Tabla | Columnas a agregar |
|---|---|
| `appointments` | `clinica_id` |
| `clinic_info` | Reemplazada por la tabla `clinicas` |
| `clinical_notes` | `clinica_id` (heredado del paciente; se añade para RLS directo) |
| `conversations` | `clinica_id` |
| `doctor_schedules` | `clinica_id` (heredado del doctor) |
| `doctors` | `clinica_id` |
| `messages` | `clinica_id` (heredado de la conversación) |
| `patient_doctors` | `clinica_id` |
| `patients` | `clinica_id` |
| `profiles` | `cuenta_id`, `clinica_id` (puede ser NULL si el usuario pertenece a varias clínicas; la membresía es la fuente de verdad) |
| `services` | `clinica_id` |
| `studies` | `clinica_id` (heredado del paciente) |
| `agents` | `clinica_id` |

---

## 5. Propagación del contexto de inquilino por petición

### Estrategia

La membresía de un usuario a una clínica vive en la tabla `membresias`. El
contexto activo (qué clínica está viendo el usuario en esta sesión) se resuelve
en dos capas:

**Capa 1 — JWT de Supabase Auth (claims personalizados)**

En S1 se implementa un hook `auth.users` → función Postgres que, al crear o
actualizar una sesión, inyecta en el JWT los claims:

```json
{
  "rol": "administrador",
  "cuenta_id": "<uuid>",
  "clinica_id": "<uuid>"
}
```

Si el usuario tiene acceso a una sola clínica (caso más común), los claims se
resuelven al inicio de sesión. Si tiene acceso a varias, el `clinica_id` del JWT
corresponde a la clínica activa seleccionada; cambiar de clínica requiere renovar
el JWT (o leer de la tabla `membresias` en el servidor con un call explícito).

**Capa 2 — Políticas RLS**

Las políticas RLS de cada tabla leen `auth.jwt() -> 'clinica_id'` y lo comparan
con la columna `clinica_id` de la fila. Esto garantiza el aislamiento incluso si
alguna consulta del servidor no filtra explícitamente:

```sql
-- Ejemplo de política RLS sobre "patients"
create policy "solo_clinica_activa"
  on patients
  for all
  using (clinica_id = (auth.jwt() ->> 'clinica_id')::uuid);
```

**Capa 3 — Server Actions y consultas del servidor**

`createServerClient()` usa `service_role` y omite RLS. En S2 se refactorizará
para que las Server Actions usen el cliente con la sesión del usuario
(`createAuthClient()`) siempre que sea posible, y solo usen `service_role` para
operaciones administrativas que así lo requieran (sincronización de Auth, webhooks
de pago). El `clinica_id` activo se lee del JWT decodificado en el servidor y se
pasa explícitamente como filtro en toda consulta que use `service_role`.

**Flujo de resolución de inquilino**

```
Petición HTTP
  → middleware.ts: valida sesión, obtiene JWT
  → JWT contiene: rol, cuenta_id, clinica_id
  → layout.tsx / Server Action: extrae clinica_id del JWT
  → consulta Supabase: WHERE clinica_id = :clinica_id
  → RLS (segunda línea de defensa): mismo filtro aplicado por Postgres
```

---

## 6. Plan de migración de la clínica actual

Al ejecutar la Fase S1, todos los datos existentes se migran de la siguiente
forma, sin pérdida:

### Paso 1 — Crear la cuenta y la clínica demo

```sql
-- (S1 lo ejecutará como migración numerada)
INSERT INTO cuentas (id, nombre, email_contacto, estado)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Cuenta demo',
  'demo@agentedental.mx',
  'prueba'
);

INSERT INTO clinicas (id, cuenta_id, nombre, activa)
VALUES (
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Clinica demo',
  true
);
```

Los datos de `clinic_info` (nombre real, teléfono, FAQ, etc.) se copian a esta
fila de `clinicas`.

### Paso 2 — Asignar clinica_id a todas las filas existentes

```sql
-- Para cada tabla del dominio:
UPDATE doctors       SET clinica_id = 'bbbbbbbb-0000-0000-0000-000000000001';
UPDATE patients      SET clinica_id = 'bbbbbbbb-0000-0000-0000-000000000001';
UPDATE appointments  SET clinica_id = 'bbbbbbbb-0000-0000-0000-000000000001';
UPDATE services      SET clinica_id = 'bbbbbbbb-0000-0000-0000-000000000001';
UPDATE conversations SET clinica_id = 'bbbbbbbb-0000-0000-0000-000000000001';
UPDATE messages      SET clinica_id = 'bbbbbbbb-0000-0000-0000-000000000001';
-- ... y el resto de tablas
```

### Paso 3 — Crear membresías para los usuarios existentes

Cada fila de `profiles` se convierte en una membresía con el mismo rol que ya
tiene:

```sql
INSERT INTO membresias (user_id, cuenta_id, clinica_id, rol, activa)
SELECT id, 'aaaaaaaa-...', 'bbbbbbbb-...', rol::text, activo
FROM profiles;
```

### Paso 4 — Activar RLS y verificar

Después de la migración, se activan las políticas RLS en cada tabla y se ejecutan
pruebas de aislamiento: iniciar sesión como el administrador de la Clínica demo y
confirmar que todos los datos siguen visibles y que ninguna fila queda fuera del
filtro de clínica.

### Paso 5 — Deprecar clinic_info

La tabla `clinic_info` se mantiene en el esquema durante la migración de S1 para
no romper nada, y se elimina en S2 una vez que todo el código use `clinicas`.

---

## 7. Rol de superadmin

El superadmin (dueño del SaaS) tiene un rol especial `superadmin` almacenado en
`auth.users.user_metadata.rol`. Las políticas RLS incluirán una cláusula que
permita acceso total a este rol, o en su lugar se usará exclusivamente
`service_role` desde el panel de superadmin (que corre como ruta separada
`/superadmin`).

El superadmin NO es el administrador de una clínica. Son dos roles completamente
distintos.

---

## 8. Canales de mensajería y contexto de clínica

Los flujos de n8n (`01-recordatorio-citas-24h.json`, `02-asistente-inbound.json`,
`03-respuesta-agente-humano.json`) actualmente no identifican a qué clínica
pertenece una conversación. En S3 se añade el campo `clinica_id` al payload de
los webhooks de n8n, de modo que el agente pueda cargar la configuración correcta
(nombre, FAQ, horario, servicios) de la clínica correspondiente.

---

## 9. Resumen de fases y responsabilidades

| Fase | Qué se hace |
|---|---|
| S0 (este doc) | Decisiones de arquitectura, sin cambiar el esquema |
| S1 | Tablas nuevas, columnas de inquilino, RLS, migración de datos, tipos TypeScript |
| S2 | Registro de cuenta, onboarding, selección de plan, integración Mercado Pago |
| S3 | Agente multi-tenant: n8n con clinica_id, configuración de canal por clínica |
| S4 | Dashboard de analítica del agente y saldo de IA (metering) |
| S5 | Panel de superadmin |
| S6 | Add-ons y gestión de límites del plan |
| S7 | Selección de clínica activa cuando un usuario pertenece a varias |
| S8 | WhatsApp como canal adicional (add-on) |
| S9 | Facturación y comprobantes |
| S10 | Hardening de seguridad, pruebas de aislamiento automatizadas, monitoreo |
