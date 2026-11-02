SET lock_timeout = '3s';

-- Line budgets (punch list #234 PR 1, v2.6300): every line the customer sees carries what the company
-- thinks it costs — labor as a share of the price (hours at a burdened rate), materials as a share, the
-- margin as what is left. Five columns on the line item row itself, written by the same autosave that
-- writes the price, so a rename, a reorder, a delete or a reload carries the budget with the line.
--
--   * budget_labor_pct / budget_materials_pct: the split, 0–100 each, together never past 100. Null on
--     both = the line reads the company's split for its kind (assumed); nothing is stored until the
--     owner tunes a line, so a later change to the company split moves every line still assumed.
--   * budget_source: where the split came from — 'workbench' (the bid's workbench priced the line from
--     these hours and parts), 'assumed' (the company split, recorded when a baseline freezes it), or
--     'tuned' (the owner moved it). Null while nothing is stored.
--   * budget_tuned_at: when the owner last moved it; null otherwise.
--   * budget_rate_usd: the burdened cost rate ($/h) the hours were read at when the split was stored,
--     so a later rate change does not rewrite what the owner saw.
--
-- No table is created, so no fence is owed. Idempotent: each column only when missing, all in one
-- statement so the table's lock is taken once; no default writes a row. No index: the columns are read
-- by the line's own row.
ALTER TABLE public.jobs_ledger_fixtures
  ADD COLUMN IF NOT EXISTS budget_labor_pct numeric,
  ADD COLUMN IF NOT EXISTS budget_materials_pct numeric,
  ADD COLUMN IF NOT EXISTS budget_source text,
  ADD COLUMN IF NOT EXISTS budget_tuned_at timestamptz,
  ADD COLUMN IF NOT EXISTS budget_rate_usd numeric;

ALTER TABLE public.jobs_ledger_fixtures DROP CONSTRAINT IF EXISTS jobs_ledger_fixtures_budget_source_check;
ALTER TABLE public.jobs_ledger_fixtures
  ADD CONSTRAINT jobs_ledger_fixtures_budget_source_check
  CHECK (budget_source IS NULL OR budget_source IN ('workbench', 'assumed', 'tuned'));

ALTER TABLE public.jobs_ledger_fixtures DROP CONSTRAINT IF EXISTS jobs_ledger_fixtures_budget_split_check;
ALTER TABLE public.jobs_ledger_fixtures
  ADD CONSTRAINT jobs_ledger_fixtures_budget_split_check
  CHECK (
    (budget_labor_pct IS NULL AND budget_materials_pct IS NULL)
    OR (
      budget_labor_pct >= 0 AND budget_materials_pct >= 0
      AND budget_labor_pct + budget_materials_pct <= 100
    )
  );

COMMENT ON COLUMN public.jobs_ledger_fixtures.budget_labor_pct IS
  'Line budgets (punch list #234, v2.6300): the share of this line''s price the company expects to spend on labor, 0–100; null = the company''s split for the line''s kind, assumed. Hours = price × this ÷ budget_rate_usd.';
COMMENT ON COLUMN public.jobs_ledger_fixtures.budget_materials_pct IS
  'Line budgets (punch list #234, v2.6300): the share of this line''s price the company expects to spend on materials, 0–100; with budget_labor_pct never past 100. Null = assumed.';
COMMENT ON COLUMN public.jobs_ledger_fixtures.budget_source IS
  'Line budgets (punch list #234, v2.6300): where the split came from — workbench (the bid priced the line from these), assumed (the company split, recorded), tuned (the owner moved it). Null while nothing is stored.';
COMMENT ON COLUMN public.jobs_ledger_fixtures.budget_tuned_at IS
  'Line budgets (punch list #234, v2.6300): when the owner last moved this line''s split; null otherwise.';
COMMENT ON COLUMN public.jobs_ledger_fixtures.budget_rate_usd IS
  'Line budgets (punch list #234, v2.6300): the burdened cost rate ($/h) the hours were read at when the split was stored, so a later rate change leaves what the owner saw.';
