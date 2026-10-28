SET lock_timeout = '3s';

-- Developments on bids (punch list #208, PR 1, v2.6019). A development is
-- already a record on jobs (public.developments, jobs_ledger.development_id,
-- 20260801100000_developments_on_jobs.sql). The owner asked for it on bids
-- too, so a site with many bids and jobs reads as one thing: the real example
-- has 13 bids and 29 jobs at one address, with 9 of the jobs tagged and none
-- of the bids. One nullable column, the same shape as the job's: ON DELETE
-- SET NULL (deleting a development un-groups its bids, never deletes them), a
-- partial index for the board's house filter and the Development page PR 2
-- adds, and the same backstop trigger the job has.
--
-- Purely additive: the old client never reads or writes the column, so this
-- can push before or after the client deploys with no behavior change.

begin;

alter table public.bids
  add column if not exists development_id uuid references public.developments(id) on delete set null;

comment on column public.bids.development_id is
  'Optional development (grouping) for this bid — see public.developments. Display/review only: pricing, the cover letter and the robots are untouched. Backstop trigger bids_development_master_match mirrors the job''s.';

create index if not exists idx_bids_development_id
  on public.bids (development_id)
  where development_id is not null;

-- Backstop, mirroring jobs_ledger_development_master_match_fn as it stands:
-- one company (v2.2984, 20260907010000) made the job's same-master check a
-- no-op, and bids carries no master_user_id to compare against, so this body
-- is the same no-op. The function and trigger keep the job's shape so a
-- multi-company rule, if one ever returns, has one hook on each side.
create or replace function public.bids_development_master_match_fn()
returns trigger
language plpgsql
as $$
begin
  -- One company: a bid may sit in any development.
  return new;
end;
$$;

alter function public.bids_development_master_match_fn() owner to postgres;

comment on function public.bids_development_master_match_fn() is
  'No-op under one company (v2.2984), the mirror of jobs_ledger_development_master_match_fn: a bid may sit in any development. Kept as the hook for a same-master rule on bids.development_id.';

drop trigger if exists bids_development_master_match on public.bids;
create trigger bids_development_master_match
  before insert or update of development_id on public.bids
  for each row
  execute function public.bids_development_master_match_fn();

commit;
