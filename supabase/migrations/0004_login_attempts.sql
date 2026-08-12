create table if not exists public.login_attempts (
  email text primary key,
  intentos int not null default 0,
  bloqueado_hasta timestamptz
);

alter table public.login_attempts enable row level security;
-- Sin políticas de select/insert/update: esta tabla no se lee ni se escribe
-- directamente desde el cliente, solo a través de las funciones de abajo.

create or replace function public.check_login_lock(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.login_attempts;
begin
  select * into v_row from public.login_attempts where email = p_email;

  if v_row.email is null then
    return jsonb_build_object('bloqueado', false, 'bloqueado_hasta', null, 'intentos', 0);
  end if;

  if v_row.bloqueado_hasta is not null and v_row.bloqueado_hasta > now() then
    return jsonb_build_object('bloqueado', true, 'bloqueado_hasta', v_row.bloqueado_hasta, 'intentos', v_row.intentos);
  end if;

  return jsonb_build_object('bloqueado', false, 'bloqueado_hasta', null, 'intentos', v_row.intentos);
end;
$$;

revoke all on function public.check_login_lock(text) from public;
grant execute on function public.check_login_lock(text) to anon, authenticated;

create or replace function public.record_login_attempt(p_email text, p_exitoso boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intentos int;
  v_bloqueado_hasta timestamptz;
begin
  if p_exitoso then
    update public.login_attempts set intentos = 0, bloqueado_hasta = null where email = p_email;
    return jsonb_build_object('bloqueado', false, 'intentos', 0);
  end if;

  insert into public.login_attempts (email, intentos)
  values (p_email, 1)
  on conflict (email) do update set intentos = public.login_attempts.intentos + 1
  returning intentos into v_intentos;

  if v_intentos >= 5 then
    v_bloqueado_hasta := now() + interval '15 minutes';
    update public.login_attempts set bloqueado_hasta = v_bloqueado_hasta where email = p_email;
    return jsonb_build_object('bloqueado', true, 'bloqueado_hasta', v_bloqueado_hasta, 'intentos', v_intentos);
  end if;

  return jsonb_build_object('bloqueado', false, 'intentos', v_intentos);
end;
$$;

revoke all on function public.record_login_attempt(text, boolean) from public;
grant execute on function public.record_login_attempt(text, boolean) to anon, authenticated;