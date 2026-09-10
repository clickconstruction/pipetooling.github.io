SET lock_timeout = '3s';

-- Discount line items (v2.3252, PR 1 of the discount train).
--
-- A discount is a typed row in jobs_ledger_fixtures, not a sign trick:
--   line_kind = 'discount'      the row reduces the work it applies to
--   line_unit_price             the SIGNED amount, stored NEGATIVE (count 1), so every
--                               reader that sums count × price — the Job Total, the
--                               revenue resync, the money rollups — needs no new branch
--   discount_pct                when set the dollars are DERIVED from the basis at save
--                               time (a percent stays live as prices change); NULL = a
--                               fixed dollar amount
--   discount_basis_positions    sequence_order positions of the work rows it applies
--                               to; NULL = every work row on the job. Positions, not
--                               ids: the save engine reinserts rows with fresh ids and
--                               keys invoice links on positions the same way.
--   discount_reason             the preset chip picked when the row was made
--                               (Negotiated · Referral · Repeat customer · Goodwill ·
--                               Price match), or NULL for a typed-in name.
--
-- Additive and idempotent. Existing rows read as line_kind = 'work'. The old
-- client keeps working after this push (it never selects these columns).

ALTER TABLE public.jobs_ledger_fixtures
  ADD COLUMN IF NOT EXISTS line_kind text NOT NULL DEFAULT 'work',
  ADD COLUMN IF NOT EXISTS discount_pct numeric(7,4),
  ADD COLUMN IF NOT EXISTS discount_basis_positions integer[],
  ADD COLUMN IF NOT EXISTS discount_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_ledger_fixtures_line_kind_check'
      AND conrelid = 'public.jobs_ledger_fixtures'::regclass
  ) THEN
    ALTER TABLE public.jobs_ledger_fixtures
      ADD CONSTRAINT jobs_ledger_fixtures_line_kind_check
      CHECK (line_kind IN ('work', 'discount'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_ledger_fixtures_discount_pct_check'
      AND conrelid = 'public.jobs_ledger_fixtures'::regclass
  ) THEN
    ALTER TABLE public.jobs_ledger_fixtures
      ADD CONSTRAINT jobs_ledger_fixtures_discount_pct_check
      CHECK (discount_pct IS NULL OR (discount_pct >= 0 AND discount_pct <= 100));
  END IF;
END $$;

COMMENT ON COLUMN public.jobs_ledger_fixtures.line_kind IS
  'work (default) | discount — a discount row reduces the work rows it applies to; its line_unit_price is stored negative with count 1.';
COMMENT ON COLUMN public.jobs_ledger_fixtures.discount_pct IS
  'Discount rows only: percent of the basis; the negative line_unit_price is derived from it on save. NULL = a fixed dollar discount.';
COMMENT ON COLUMN public.jobs_ledger_fixtures.discount_basis_positions IS
  'Discount rows only: sequence_order positions of the work rows the discount applies to. NULL = every work row on the job.';
COMMENT ON COLUMN public.jobs_ledger_fixtures.discount_reason IS
  'Discount rows only: the reason preset chosen when the row was made (Negotiated, Referral, Repeat customer, Goodwill, Price match) or NULL.';
