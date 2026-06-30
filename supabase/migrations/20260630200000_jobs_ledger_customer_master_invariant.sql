-- Invariant: a job's linked customer must be owned by the job's master.
--
-- Billing rejects any jobs_ledger row whose customer.master_user_id <> jobs_ledger.master_user_id
-- with "Customer does not belong to this job master" (preview-stripe-invoice,
-- create-stripe-invoice, update-collect-payment-stripe-customer-email). Nothing kept the two in
-- sync, so they drifted:
--   * the customer-master cascade updated `projects` only, never `jobs_ledger`, so jobs linked
--     directly to a reassigned customer kept the stale master;
--   * the Job form returned an explicitly-picked customer_id unchanged even after a project link
--     forced the job's master to the project owner.
--
-- This migration (1) backfills existing divergent rows, (2) cascades future customer-master changes
-- to directly-linked (non-project) jobs — mirroring cascade_customer_master_to_projects — and
-- (3) adds a backstop trigger modeled on jobs_ledger_project_master_match. Chosen heal direction:
-- "job follows the customer" (non-project jobs are re-owned to their customer's master).

begin;

-- (1a) Non-project jobs: job follows the customer.
do $$
declare v_n integer;
begin
  update public.jobs_ledger j
  set master_user_id = c.master_user_id,
      updated_at = now()
  from public.customers c
  where c.id = j.customer_id
    and j.project_id is null
    and c.master_user_id <> j.master_user_id;
  get diagnostics v_n = row_count;
  raise notice 'customer-master backfill: % non-project job(s) re-owned to their customer master', v_n;
end $$;

-- (1b) Project-linked jobs: master is locked to the project owner (jobs_ledger_project_master_match),
-- so the *customer link* is the wrong side. Re-point to the same-name customer under the job master
-- when exactly one exists; otherwise clear the link so it can be re-picked.
do $$
declare v_repointed integer; v_cleared integer;
begin
  with cand as (
    select j.id as job_id,
           (select c2.id from public.customers c2
             where c2.master_user_id = j.master_user_id
               and lower(trim(c2.name)) = lower(trim(c.name))) as new_customer_id,
           (select count(*) from public.customers c2
             where c2.master_user_id = j.master_user_id
               and lower(trim(c2.name)) = lower(trim(c.name))) as match_count
    from public.jobs_ledger j
    join public.customers c on c.id = j.customer_id
    where j.project_id is not null
      and c.master_user_id <> j.master_user_id
  )
  update public.jobs_ledger j
  set customer_id = cand.new_customer_id,
      updated_at = now()
  from cand
  where j.id = cand.job_id and cand.match_count = 1;
  get diagnostics v_repointed = row_count;

  update public.jobs_ledger j
  set customer_id = null,
      updated_at = now()
  from public.customers c
  where c.id = j.customer_id
    and j.project_id is not null
    and c.master_user_id <> j.master_user_id;
  get diagnostics v_cleared = row_count;

  raise notice 'customer-master backfill: % project-linked job(s) re-pointed, % cleared (re-pick needed)',
    v_repointed, v_cleared;
end $$;

-- (2) Cascade future customer-master changes to directly-linked (non-project) jobs. Project-linked
-- jobs are excluded: their master is governed by the project, which the existing projects cascade
-- already moves with the customer.
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
  end if;
  return new;
end;
$$;

alter function public.cascade_customer_master_to_jobs_ledger() owner to postgres;

comment on function public.cascade_customer_master_to_jobs_ledger() is
  'When a customer''s master_user_id changes, re-owns directly-linked (non-project) jobs_ledger rows to keep jobs_ledger.master_user_id aligned with the linked customer (required by Stripe billing).';

drop trigger if exists cascade_customer_master_to_jobs_ledger on public.customers;
create trigger cascade_customer_master_to_jobs_ledger
  after update on public.customers
  for each row
  when (old.master_user_id is distinct from new.master_user_id)
  execute function public.cascade_customer_master_to_jobs_ledger();

-- (3) Backstop: a job's linked customer must belong to the job's master. Fires only on INSERT or
-- when the ownership-relevant columns change, so editing unrelated fields on a legacy row is never
-- blocked; the cascade above keeps rows aligned, this guarantees divergence can't be (re)introduced.
create or replace function public.jobs_ledger_customer_master_match_fn()
returns trigger
language plpgsql
as $$
begin
  if new.customer_id is not null and (
       tg_op = 'INSERT'
       or new.customer_id is distinct from old.customer_id
       or new.master_user_id is distinct from old.master_user_id
     ) then
    if not exists (
      select 1 from public.customers c
      where c.id = new.customer_id and c.master_user_id = new.master_user_id
    ) then
      raise exception 'Job linked customer must belong to the job master (customer_id=%, master_user_id=%)',
        new.customer_id, new.master_user_id;
    end if;
  end if;
  return new;
end;
$$;

alter function public.jobs_ledger_customer_master_match_fn() owner to postgres;

drop trigger if exists jobs_ledger_customer_master_match on public.jobs_ledger;
create trigger jobs_ledger_customer_master_match
  before insert or update on public.jobs_ledger
  for each row
  execute function public.jobs_ledger_customer_master_match_fn();

commit;
