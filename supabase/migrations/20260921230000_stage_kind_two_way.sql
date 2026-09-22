-- v2.3696 — the stage chooser goes two-way (In order / Any time).
--
-- The Bill tab's third "—" (not a stage) button leaves the selector and the
-- Multiple Segment Generator: in two weeks live it was picked by hand once (a
-- $50 tip line), and everything else it did, Any time does. A null stage_kind
-- now means exactly one thing — a discount row (syncDiscountRows forces it) —
-- so the hand-picked nulls become Any, the column default. Data only; the
-- kernel keeps reading null rows as "not a stage" for the discounts.
SET lock_timeout = '3s';

UPDATE public.jobs_ledger_fixtures
   SET stage_kind = 'any'
 WHERE stage_kind IS NULL
   AND line_kind IS DISTINCT FROM 'discount';

COMMENT ON COLUMN public.jobs_ledger_fixtures.stage_kind IS
  'Stage Plan: order = a numbered stage that waits for the one above it; any (default) = its own dates, bills when done; NULL = a discount row (not a stage — set by code, no selector door since v2.3696).';
