SET lock_timeout = '3s';

-- Developments: named groups of jobs (a subdivision / builder development like
-- "Sagebrush Phase 2"), so office can review many jobs as one unit. A
-- development is a real row — NOT a free-text tag — because grouping by typed
-- names fragments on typos (the exact name-join fragility PERSON_IDENTITY_PLAN
-- exists to unwind). Jobs point at it via jobs_ledger.development_id
-- (nullable; ON DELETE SET NULL — deleting a development un-groups, never
-- deletes, its jobs).
--
-- Purely additive: nothing reads either side yet (client lands separately, so
-- this can be pushed ahead with zero behavior change).
--
-- Same-master invariants, mirroring the GC-on-jobs pattern (20260731205835):
--   * a job's development must belong to the job's master;
--   * a development's optional default GC (gc_customer_id — enables a future
--     "Use development's GC" chip) must belong to the development's master.
-- Both are backstop BEFORE triggers that fire only on INSERT or when the
-- relevant columns change, so legacy rows stay editable.

begin;

create table if not exists public.developments (
    id uuid primary key default gen_random_uuid(),
    master_user_id uuid not null references public.users(id) on delete cascade,
    name text not null,
    gc_customer_id uuid references public.customers(id) on delete set null,
    city text,
    notes text,
    archived_at timestamp with time zone,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);

comment on table public.developments is
  'Named groups of jobs (a subdivision/builder development). Jobs link via jobs_ledger.development_id for grouped review; display/management only — nothing billing-related reads it.';
comment on column public.developments.gc_customer_id is
  'Optional default GC/Builder for the development — a customers row, like jobs_ledger.gc_customer_id. Must belong to the development''s master (developments_gc_customer_master_match).';
comment on column public.developments.archived_at is
  'Soft archive: archived developments stay on their jobs but drop out of pickers. The active-name unique index ignores archived rows.';

-- One active development per name per master; archiving frees the name.
create unique index if not exists developments_master_active_name_unique
  on public.developments (master_user_id, lower(name))
  where archived_at is null;

create index if not exists idx_developments_gc_customer_id
  on public.developments (gc_customer_id)
  where gc_customer_id is not null;

drop trigger if exists update_developments_updated_at on public.developments;
create trigger update_developments_updated_at
  before update on public.developments
  for each row
  execute function public.update_updated_at_column();

-- Backstop: a development's default GC must belong to the development's master.
create or replace function public.developments_gc_customer_master_match_fn()
returns trigger
language plpgsql
as $$
begin
  if new.gc_customer_id is not null and (
       tg_op = 'INSERT'
       or new.gc_customer_id is distinct from old.gc_customer_id
       or new.master_user_id is distinct from old.master_user_id
     ) then
    if not exists (
      select 1 from public.customers c
      where c.id = new.gc_customer_id and c.master_user_id = new.master_user_id
    ) then
      raise exception 'Development GC must belong to the development master (gc_customer_id=%, master_user_id=%)',
        new.gc_customer_id, new.master_user_id;
    end if;
  end if;
  return new;
end;
$$;

alter function public.developments_gc_customer_master_match_fn() owner to postgres;

comment on function public.developments_gc_customer_master_match_fn() is
  'Backstop: developments.gc_customer_id must reference a customer owned by the development''s master. Fires only on INSERT or when gc_customer_id/master_user_id change.';

drop trigger if exists developments_gc_customer_master_match on public.developments;
create trigger developments_gc_customer_master_match
  before insert or update on public.developments
  for each row
  execute function public.developments_gc_customer_master_match_fn();

-- ------------------------------------------------------------- RLS

alter table public.developments enable row level security;

-- Read mirrors the customers-table read (the name renders on the Stages board
-- wherever customer names already do): owner, dev, adopted assistant-likes
-- (master_assistants is role-agnostic — covers controller), viewing masters
-- via shares, plus the same blanket estimator/primary/superintendent branch
-- customers grants.
drop policy if exists developments_select on public.developments;
create policy developments_select on public.developments for select to authenticated using (
  master_user_id = (select auth.uid())
  or public.is_dev()
  or exists (
    select 1 from public.master_assistants ma
    where ma.master_id = developments.master_user_id
      and ma.assistant_id = (select auth.uid())
  )
  or exists (
    select 1 from public.master_shares ms
    where ms.sharing_master_id = developments.master_user_id
      and ms.viewing_master_id = (select auth.uid())
  )
  or exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and u.role = any (array['estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role])
  )
);

-- Writes: owner, dev, or an adopted assistant-like of the row's master —
-- the same shape as customers' assistant insert/update policies. WITH CHECK
-- uses the same expression so a row can never be created for (or moved to)
-- a master who hasn't adopted the writer.
drop policy if exists developments_insert on public.developments;
create policy developments_insert on public.developments for insert to authenticated with check (
  master_user_id = (select auth.uid())
  or public.is_dev()
  or exists (
    select 1 from public.master_assistants ma
    where ma.master_id = developments.master_user_id
      and ma.assistant_id = (select auth.uid())
  )
);

drop policy if exists developments_update on public.developments;
create policy developments_update on public.developments for update to authenticated using (
  master_user_id = (select auth.uid())
  or public.is_dev()
  or exists (
    select 1 from public.master_assistants ma
    where ma.master_id = developments.master_user_id
      and ma.assistant_id = (select auth.uid())
  )
) with check (
  master_user_id = (select auth.uid())
  or public.is_dev()
  or exists (
    select 1 from public.master_assistants ma
    where ma.master_id = developments.master_user_id
      and ma.assistant_id = (select auth.uid())
  )
);

-- Delete stays master/dev-only, like customers.
drop policy if exists developments_delete on public.developments;
create policy developments_delete on public.developments for delete to authenticated using (
  master_user_id = (select auth.uid())
  or public.is_dev()
);

grant all on table public.developments to anon, authenticated, service_role;

-- ------------------------------------------- jobs_ledger.development_id

alter table public.jobs_ledger
  add column if not exists development_id uuid references public.developments(id) on delete set null;

comment on column public.jobs_ledger.development_id is
  'Optional development (grouping) for this job — see public.developments. Display/review only: billing is untouched. Must belong to the job master (jobs_ledger_development_master_match).';

create index if not exists idx_jobs_ledger_development_id
  on public.jobs_ledger (development_id)
  where development_id is not null;

-- Backstop: the development must belong to the job's master. Mirrors
-- jobs_ledger_gc_customer_master_match_fn; separate function so the
-- invariants stay independently evolvable.
create or replace function public.jobs_ledger_development_master_match_fn()
returns trigger
language plpgsql
as $$
begin
  if new.development_id is not null and (
       tg_op = 'INSERT'
       or new.development_id is distinct from old.development_id
       or new.master_user_id is distinct from old.master_user_id
     ) then
    if not exists (
      select 1 from public.developments d
      where d.id = new.development_id and d.master_user_id = new.master_user_id
    ) then
      raise exception 'Job development must belong to the job master (development_id=%, master_user_id=%)',
        new.development_id, new.master_user_id;
    end if;
  end if;
  return new;
end;
$$;

alter function public.jobs_ledger_development_master_match_fn() owner to postgres;

comment on function public.jobs_ledger_development_master_match_fn() is
  'Backstop for the development-on-jobs invariant: jobs_ledger.development_id must reference a development owned by the job''s master. Fires only on INSERT or when development_id/master_user_id change.';

drop trigger if exists jobs_ledger_development_master_match on public.jobs_ledger;
create trigger jobs_ledger_development_master_match
  before insert or update on public.jobs_ledger
  for each row
  execute function public.jobs_ledger_development_master_match_fn();

-- Training-mode (users.read_only) write blocks. BOTH are required per CLAUDE.md:
-- the first (re)creates the restrictive RLS policies, the second attaches the
-- statement trigger that also stops SECURITY DEFINER RPCs.
select public.apply_read_only_write_blocks();
select public.apply_read_only_stmt_blocks();

commit;
