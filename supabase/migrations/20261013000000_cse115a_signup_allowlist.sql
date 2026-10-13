-- Sign-up allow list: a "Before User Created" auth hook that refuses new accounts outside the course allow list.
-- Entries are email domains ("stu.istinye.edu.tr") or full addresses ("admin@example.com"), lowercase.
-- Keep them in sync with CSE115A_ALLOWED_EMAIL_DOMAINS and CSE115A_ADMIN_EMAILS. With no entries, every sign-up is refused.
-- Enable it in the dashboard: Authentication > Hooks > Before User Created > Postgres > public.cse_before_user_created.

create table if not exists public.cse_signup_allowlist (
  entry text primary key check (entry = lower(entry) and entry <> '')
);

alter table public.cse_signup_allowlist enable row level security;
revoke all on public.cse_signup_allowlist from anon, authenticated;

create or replace function public.cse_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  email text := lower(trim(coalesce(event->'user'->>'email', '')));
  domain text := split_part(email, '@', 2);
begin
  if email ~ '^[^@\s]+@[^@\s]+$' and exists (
    select 1 from public.cse_signup_allowlist a where a.entry = email or a.entry = domain
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Use your university email address to sign in.'
  ));
end;
$$;

revoke execute on function public.cse_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.cse_before_user_created(jsonb) to supabase_auth_admin;
