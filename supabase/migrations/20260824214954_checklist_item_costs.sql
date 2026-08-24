SET lock_timeout = '3s';

-- Dev-only checklist cost estimates: one row per costed task, keyed by the
-- task's cost key — the roadmap task id for bridged roadmap tasks (so Review
-- and the roadmap Plan view share one estimate per task), otherwise the
-- checklist_items id. Deliberately no FK on cost_key: it references either of
-- two tables, and an orphaned estimate is harmless (it simply stops rendering).
-- Rate is a snapshot of people_pay_config.hourly_wage at entry time so later
-- pay changes don't rewrite history.
CREATE TABLE IF NOT EXISTS public.checklist_item_costs (
  cost_key uuid PRIMARY KEY,
  person_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  person_name text NOT NULL DEFAULT '',
  hours numeric NOT NULL CHECK (hours > 0),
  rate numeric NOT NULL CHECK (rate >= 0),
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_item_costs ENABLE ROW LEVEL SECURITY;

-- Dev-only in both directions: estimates derive from payroll wages, which no
-- other role may see.
DROP POLICY IF EXISTS checklist_item_costs_dev_all ON public.checklist_item_costs;
CREATE POLICY checklist_item_costs_dev_all ON public.checklist_item_costs
  FOR ALL
  USING (public.is_dev())
  WITH CHECK (public.is_dev());

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
