SET lock_timeout = '3s';

-- Demand letter, itemized — PR 2 (v2.3429): the letter goes out with its
-- exhibits (the invoice as sent, the signed agreement when one exists, the
-- delivery record) and is demanded of the party the bill was addressed to.
-- The record keeps both so the Legal desk and the firm's portal see what was
-- presented and to whom. Additive; idempotent; no table created.

ALTER TABLE public.job_demand_letters
  ADD COLUMN IF NOT EXISTS exhibits jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS debtor_party text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_demand_letters_debtor_party_check'
  ) THEN
    ALTER TABLE public.job_demand_letters
      ADD CONSTRAINT job_demand_letters_debtor_party_check
      CHECK (debtor_party IN ('', 'customer', 'gc', 'other'));
  END IF;
END $$;

COMMENT ON COLUMN public.job_demand_letters.exhibits IS
  'What went out behind the letter (v2.3429): [{label: A|B|C, title, pages}] — A the invoice as sent, B the signed agreement, C the delivery record.';
COMMENT ON COLUMN public.job_demand_letters.debtor_party IS
  'Who the letter was demanded of, by the covered invoice''s own who-pays rule (v2.3429): customer · gc · other (a typed payer). Empty on rows recorded before it.';
