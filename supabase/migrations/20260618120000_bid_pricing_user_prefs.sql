-- Per-user, per-service-type "last selected price book" preference.
-- Lets each user's most recently chosen price-book TEMPLATE become the default
-- fallback for bids that have not set up their own pricing (replacing the global
-- "Default" template fallback). Cross-device because it lives in the DB, not localStorage.
create table if not exists public.bid_pricing_user_prefs (
  user_id uuid not null references public.users(id) on delete cascade,
  service_type_id uuid not null references public.service_types(id) on delete cascade,
  -- The remembered template (a price_book_versions row with bid_id IS NULL).
  -- ON DELETE SET NULL so removing a template clears the stored preference.
  last_price_book_version_id uuid references public.price_book_versions(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, service_type_id)
);

alter table public.bid_pricing_user_prefs enable row level security;

-- Users see/manage only their own row; devs may read any (mirrors existing conventions).
create policy "bid_pricing_user_prefs own select"
  on public.bid_pricing_user_prefs for select
  using (user_id = auth.uid());

create policy "bid_pricing_user_prefs own insert"
  on public.bid_pricing_user_prefs for insert
  with check (user_id = auth.uid());

create policy "bid_pricing_user_prefs own update"
  on public.bid_pricing_user_prefs for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "bid_pricing_user_prefs dev select"
  on public.bid_pricing_user_prefs for select
  using (public.is_dev());
