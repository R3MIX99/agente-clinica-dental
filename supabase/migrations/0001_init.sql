-- Esquema inicial: agente IA para clínica dental
-- Canal abstraído (telegram ahora, whatsapp preparado). Cero emojis.

-- Tipos enum
create type channel_type as enum ('telegram', 'whatsapp');
create type appointment_status as enum ('programada', 'confirmada', 'cancelada', 'completada', 'no_asistio');
create type conversation_mode as enum ('bot', 'humano');
create type conversation_status as enum ('abierta', 'pendiente', 'cerrada');
create type message_direction as enum ('entrante', 'saliente');
create type message_sender as enum ('paciente', 'bot', 'agente');
create type agent_role as enum ('admin', 'recepcion', 'odontologo');

-- Configuración de la clínica (fila única)
create table clinic_info (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  direccion text,
  telefono text,
  email text,
  sitio_web text,
  horario text,
  formas_pago text,
  facturacion text,
  mapa_url text,
  faq jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Servicios
create table services (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  precio numeric(10,2) not null,
  duracion_min int,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Pacientes
create table patients (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  email text,
  channel channel_type not null default 'telegram',
  channel_user_id text,
  notas text,
  created_at timestamptz not null default now(),
  unique (channel, channel_user_id)
);

-- Agentes humanos
create table agents (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text unique,
  role agent_role not null default 'recepcion',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Citas
create table appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  service_id uuid references services(id),
  fecha_hora timestamptz not null,
  status appointment_status not null default 'programada',
  costo numeric(10,2),
  recordatorio_enviado_at timestamptz,
  notas text,
  created_at timestamptz not null default now()
);

-- Conversaciones
create table conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  channel channel_type not null,
  mode conversation_mode not null default 'bot',
  status conversation_status not null default 'abierta',
  assigned_agent_id uuid references agents(id),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Mensajes
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  direction message_direction not null,
  sender message_sender not null,
  contenido text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Índices
create index idx_appointments_fecha_hora on appointments (fecha_hora);
create index idx_appointments_status on appointments (status);
create index idx_messages_conversation on messages (conversation_id, created_at);
create index idx_conversations_mode on conversations (mode);
create index idx_conversations_status on conversations (status);
create index idx_patients_channel_user on patients (channel, channel_user_id);

-- Trigger: actualizar last_message_at de la conversación al insertar un mensaje
create or replace function touch_conversation_last_message()
returns trigger
language plpgsql
as $$
begin
  update conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

create trigger trg_touch_conversation
  after insert on messages
  for each row
  execute function touch_conversation_last_message();

-- RLS habilitado en todas las tablas.
-- Nota: para la demo, n8n y el backend del dashboard usan la service_role key,
-- que omite RLS por diseño. Se agregan policies de SELECT para usuarios autenticados.
-- En producción se debe restringir por clínica/rol.
alter table clinic_info enable row level security;
alter table services enable row level security;
alter table patients enable row level security;
alter table agents enable row level security;
alter table appointments enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

create policy "auth_select_clinic_info" on clinic_info for select to authenticated using (true);
create policy "auth_select_services" on services for select to authenticated using (true);
create policy "auth_select_patients" on patients for select to authenticated using (true);
create policy "auth_select_agents" on agents for select to authenticated using (true);
create policy "auth_select_appointments" on appointments for select to authenticated using (true);
create policy "auth_select_conversations" on conversations for select to authenticated using (true);
create policy "auth_select_messages" on messages for select to authenticated using (true);
