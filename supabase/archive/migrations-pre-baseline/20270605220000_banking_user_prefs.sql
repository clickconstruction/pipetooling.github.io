-- Per-user Banking preferences, so the Accounting tab toggles follow the user
-- across devices/browsers instead of living only in that browser's localStorage.
-- localStorage stays as an instant-load cache; this table is the source of truth.
--
-- Columns are NULLABLE booleans: NULL = "never set on any device" → fall back to
-- the app's default (Hide labeled defaults on; Apply/Approve default off). Once a
-- user flips a toggle anywhere, the column is set and every device converges to it.
--
-- RLS: a user can only read/write THEIR OWN row (user_id = auth.uid()).

create table if not exists public.banking_user_prefs (
  user_id uuid primary key references public.users(id) on delete cascade,
  accounting_hide_labeled boolean,
  accounting_apply_rules_by_default boolean,
  accounting_approve_by_default boolean,
  updated_at timestamptz not null default now()
);

alter table public.banking_user_prefs enable row level security;

drop policy if exists "banking_user_prefs own select" on public.banking_user_prefs;
create policy "banking_user_prefs own select" on public.banking_user_prefs
  for select using (user_id = auth.uid());

drop policy if exists "banking_user_prefs own insert" on public.banking_user_prefs;
create policy "banking_user_prefs own insert" on public.banking_user_prefs
  for insert with check (user_id = auth.uid());

drop policy if exists "banking_user_prefs own update" on public.banking_user_prefs;
create policy "banking_user_prefs own update" on public.banking_user_prefs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.banking_user_prefs to authenticated;
