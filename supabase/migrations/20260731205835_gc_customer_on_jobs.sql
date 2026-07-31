SET lock_timeout = '3s';

-- GC (General Contractor) on jobs: a SECOND customer link on jobs_ledger, for
-- managing work by GC alongside the primary customer. A GC is a customers row
-- (same entity Bids uses for GC/Builder). NULL = no GC; nothing reads the
-- column server-side — billing stays keyed to customer_id, and paying-as-GC is
-- already covered by the per-invoice bill-to override (v2.1084).
--
-- Same-master invariant: like customer_id (20260630200000), a job's GC must
-- belong to the job's master. Two guards:
--   * a backstop BEFORE trigger that fires only on INSERT or when
--     gc_customer_id / master_user_id change (legacy rows stay editable);
--   * the existing customer-master cascade additionally CLEARS gc links that
--     a customer-master change just made cross-master (the GC link is
--     secondary — the job never follows the GC's master).

begin;

alter table public.jobs_ledger
  add column if not exists gc_customer_id uuid references public.customers(id) on delete set null;

comment on column public.jobs_ledger.gc_customer_id is
  'Optional General Contractor for this job — a customers row, like bids.customer_id (GC/Builder). Display/management only: billing stays keyed to customer_id. Must belong to the job master (jobs_ledger_gc_customer_master_match).';

create index if not exists idx_jobs_ledger_gc_customer_id
  on public.jobs_ledger (gc_customer_id)
  where gc_customer_id is not null;

-- Backstop: the GC must belong to the job's master. Mirrors
-- jobs_ledger_customer_master_match_fn; separate function so the two invariants
-- stay independently evolvable.
create or replace function public.jobs_ledger_gc_customer_master_match_fn()
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
      raise exception 'Job GC must belong to the job master (gc_customer_id=%, master_user_id=%)',
        new.gc_customer_id, new.master_user_id;
    end if;
  end if;
  return new;
end;
$$;

alter function public.jobs_ledger_gc_customer_master_match_fn() owner to postgres;

comment on function public.jobs_ledger_gc_customer_master_match_fn() is
  'Backstop for the GC-on-jobs invariant: jobs_ledger.gc_customer_id must reference a customer owned by the job''s master. Fires only on INSERT or when gc_customer_id/master_user_id change.';

drop trigger if exists jobs_ledger_gc_customer_master_match on public.jobs_ledger;
create trigger jobs_ledger_gc_customer_master_match
  before insert or update on public.jobs_ledger
  for each row
  execute function public.jobs_ledger_gc_customer_master_match_fn();

-- Extend the customer-master cascade (20260630200000): when a customer moves to
-- a different master, GC links pointing at it from other masters' jobs become
-- cross-master — clear them (re-pick needed), AFTER the customer_id re-owning
-- so a job that just followed this customer keeps a now-valid GC link.
create or replace function public.cascade_customer_master_to_jobs_ledger()
returns trigger
language plpgsql
as $$
begin
  if old.master_user_id is distinct from new.master_user_id then
    update public.jobs_ledger
    set master_user_id = new.master_user_id,
        updated_at = now()
    where customer_id = new.id
      and project_id is null
      and master_user_id is distinct from new.master_user_id;

    update public.jobs_ledger
    set gc_customer_id = null,
        updated_at = now()
    where gc_customer_id = new.id
      and master_user_id is distinct from new.master_user_id;
  end if;
  return new;
end;
$$;

alter function public.cascade_customer_master_to_jobs_ledger() owner to postgres;

comment on function public.cascade_customer_master_to_jobs_ledger() is
  'When a customer''s master_user_id changes: re-owns directly-linked (non-project) jobs_ledger rows to the new master (required by Stripe billing), and clears gc_customer_id links that the move made cross-master (GC links never move a job''s master).';

commit;
