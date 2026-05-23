-- Migración 0003: perfiles de usuario y roles para autenticación

-- Enum de roles
create type user_role as enum ('administrador', 'supervisor', 'doctor');

-- Tabla de perfiles vinculada a auth.users
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  rol        user_role not null default 'supervisor',
  doctor_id  uuid references doctors(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table profiles enable row level security;

create policy "perfiles_select_autenticado" on profiles
  for select to authenticated using (true);

create policy "perfiles_update_propio" on profiles
  for update to authenticated using (auth.uid() = id);

create policy "perfiles_insert_cualquier_autenticado" on profiles
  for insert with check (true);

-- Trigger: actualizar updated_at
create or replace function update_profiles_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function update_profiles_updated_at();

-- Trigger: crear perfil al registrar un usuario en auth.users
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'rol')::user_role, 'supervisor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
