begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.n8n_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_connection text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_config text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.n8n_connections enable row level security;
alter table public.ai_settings enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.n8n_connections from anon, authenticated;
revoke all on table public.ai_settings from anon, authenticated;

grant usage on schema public to authenticated;
grant select, update (name) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.n8n_connections to authenticated;
grant select, insert, update, delete on table public.ai_settings to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "n8n_connections_select_own" on public.n8n_connections;
create policy "n8n_connections_select_own" on public.n8n_connections for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "n8n_connections_insert_own" on public.n8n_connections;
create policy "n8n_connections_insert_own" on public.n8n_connections for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "n8n_connections_update_own" on public.n8n_connections;
create policy "n8n_connections_update_own" on public.n8n_connections for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "n8n_connections_delete_own" on public.n8n_connections;
create policy "n8n_connections_delete_own" on public.n8n_connections for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "ai_settings_select_own" on public.ai_settings;
create policy "ai_settings_select_own" on public.ai_settings for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "ai_settings_insert_own" on public.ai_settings;
create policy "ai_settings_insert_own" on public.ai_settings for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "ai_settings_update_own" on public.ai_settings;
create policy "ai_settings_update_own" on public.ai_settings for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "ai_settings_delete_own" on public.ai_settings;
create policy "ai_settings_delete_own" on public.ai_settings for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := trim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  if char_length(requested_name) < 2 or char_length(requested_name) > 80 then
    requested_name := split_part(coalesce(new.email, 'Nexus user'), '@', 1);
  end if;
  if char_length(requested_name) < 2 then
    requested_name := 'Nexus user';
  end if;
  insert into public.profiles (id, name) values (new.id, left(requested_name, 80));
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

commit;
