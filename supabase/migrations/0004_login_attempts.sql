create table if not exists public.login_attempts (
  email text primary key,
  intentos integer not null default 0,
  bloqueado_hasta timestamptz,
  actualizado_en timestamptz not null default now()
);

alter table public.login_attempts enable row level security;

drop function if exists public.check_login_lock(text);
drop function if exists public.record_login_attempt(text, boolean);

create or replace function public.check_login_lock(p_email text)
returns table (bloqueado boolean, intentos integer, bloqueado_hasta timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  record_attempt public.login_attempts%rowtype;
begin
  select * into record_attempt
  from public.login_attempts
  where email = lower(p_email);

  if not found then
    return query select false, 0, null::timestamptz;
    return;
  end if;

  if record_attempt.bloqueado_hasta is not null and record_attempt.bloqueado_hasta > now() then
    return query select true, record_attempt.intentos, record_attempt.bloqueado_hasta;
    return;
  end if;

  if record_attempt.bloqueado_hasta is not null and record_attempt.bloqueado_hasta <= now() then
    update public.login_attempts
    set intentos = 0, bloqueado_hasta = null, actualizado_en = now()
    where email = lower(p_email);

    return query select false, 0, null::timestamptz;
    return;
  end if;

  return query select false, record_attempt.intentos, null::timestamptz;
end;
$$;

create or replace function public.record_login_attempt(p_email text, p_exitoso boolean)
returns table (bloqueado boolean, intentos integer, bloqueado_hasta timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_attempts integer;
  lock_until timestamptz;
begin
  if p_exitoso then
    delete from public.login_attempts where email = lower(p_email);
    return query select false, 0, null::timestamptz;
    return;
  end if;

  insert into public.login_attempts (email, intentos, actualizado_en)
  values (lower(p_email), 1, now())
  on conflict (email) do update
  set
    intentos = public.login_attempts.intentos + 1,
    actualizado_en = now()
  returning public.login_attempts.intentos into current_attempts;

  if current_attempts >= 5 then
    lock_until := now() + interval '15 minutes';
    update public.login_attempts
    set bloqueado_hasta = lock_until, actualizado_en = now()
    where email = lower(p_email);

    return query select true, current_attempts, lock_until;
    return;
  end if;

  return query select false, current_attempts, null::timestamptz;
end;
$$;
