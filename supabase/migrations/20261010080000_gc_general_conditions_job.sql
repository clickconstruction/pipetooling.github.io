SET lock_timeout = '3s';

-- GC mode, Owner Billing's O11b (v2.5151): general conditions at actual cost. Our number names the Pipeline job
-- where a GC project's general conditions are spent (the superintendent's time, the trailer, temporary power), and
-- Money's margin reads that job's spend the Costs tab's own way. The money team names it, through
-- gc_project_money's own policy and fences; deleting the job lets go of it. Additive and idempotent; no table is
-- created, so the three fence calls are not needed.

ALTER TABLE public.gc_project_money
  ADD COLUMN IF NOT EXISTS general_conditions_job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.gc_project_money.general_conditions_job_id IS
  'GC mode (v2.5151, Owner Billing O11b): the Pipeline job our general conditions are spent on. Money''s margin and Closeout read its spend (labor, materials, other charges) as their actual cost. The money team names it (gc_project_money_team); null: they count at their budget.';
