SET lock_timeout = '3s';

-- The weekly review of the guesses (punch list #234, PR 1c). A typed line on a project takes the company's
-- split, assumed, until the owner tunes it (v2.6300). Once a week the owner's Needs you card lists the assumed
-- lines on the projects awarded that week; *Looks right* stamps them reviewed with his name and leaves them
-- assumed, so they still follow the company split and stop asking. Two nullable columns on the line row and the
-- one function that writes them.
--
--   jobs_ledger_fixtures.budget_reviewed_at / budget_reviewed_by — the stamp; null until the owner looks.
--   stamp_line_budgets_reviewed(p_fixture_ids uuid[]) — stamps the rows named that are still assumed (no
--     budget_source) and not yet reviewed; the owner only (is_master_or_dev()). Answers the count it stamped.
--
-- Additive, idempotent. The fixtures autosave upserts its own columns and never these, so a stamp survives
-- every later save of the line. docs/migrations/20261107180000_fixture_budget_reviewed.md.

ALTER TABLE public.jobs_ledger_fixtures
  ADD COLUMN IF NOT EXISTS budget_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS budget_reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.jobs_ledger_fixtures.budget_reviewed_at IS 'Punch list #234 PR 1c: when the owner stamped this assumed line Looks right. Null until then; a tune makes it moot (the line reads tuned).';

CREATE OR REPLACE FUNCTION public.stamp_line_budgets_reviewed(p_fixture_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  IF NOT public.is_master_or_dev() THEN
    RAISE EXCEPTION 'Only the owner reviews the line budgets' USING ERRCODE = '42501';
  END IF;
  UPDATE public.jobs_ledger_fixtures f
     SET budget_reviewed_at = now(),
         budget_reviewed_by = (SELECT auth.uid())
   WHERE f.id = ANY(COALESCE(p_fixture_ids, '{}'::uuid[]))
     AND f.budget_source IS NULL
     AND f.budget_reviewed_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.stamp_line_budgets_reviewed(uuid[]) IS
  'Punch list #234 PR 1c: the owner''s Looks right on the week''s assumed lines — stamps budget_reviewed_at/by on the rows named that are still assumed and unreviewed, answers how many. SECURITY INVOKER over is_master_or_dev().';

REVOKE ALL ON FUNCTION public.stamp_line_budgets_reviewed(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stamp_line_budgets_reviewed(uuid[]) TO authenticated;
