create extension if not exists pgcrypto;

create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  apellido text not null,
  telefono text,
  rol text not null default 'PACIENTE' check (rol in ('PACIENTE', 'ADMIN')),
  created_at timestamptz not null default now()
);

alter table public.perfiles enable row level security;

create policy "los usuarios ven su propio perfil"
  on public.perfiles for select
  to authenticated
  using (id = auth.uid());

create policy "los usuarios actualizan su propio perfil"
  on public.perfiles for update
  to authenticated
  using (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, apellido, telefono, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'apellido', ''),
    new.raw_user_meta_data ->> 'telefono',
    'PACIENTE'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();