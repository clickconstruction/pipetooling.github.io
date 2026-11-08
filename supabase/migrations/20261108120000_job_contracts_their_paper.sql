SET lock_timeout = '3s';

-- Their paper (punch list #173, v2.6698): a contract on the other side's own form — a GC's
-- subcontract — that we signed and they never countersigned. The app could file an existing
-- contract only as signed by the customer, which on such a paper is false, so on job 891 the
-- PDF went onto Evidence and the Legal desk kept reading *No signed agreement*. The record now
-- says what is true: who signed for us and when, that they did not countersign, that they rely
-- on it (the owner's call of 2026-11-08: the flag, with the day and what the reliance was, is
-- what makes the paper count as signed for *Can we sue?*), the file, and the key terms the
-- office types with their clause references.
--
-- The row is a `job_contracts` row with kind = 'their_paper' and status = 'signed' (the paper
-- is as executed as it will be), `signed_at` and the signer frames left empty: no reader that
-- knows only the frames mistakes it for a contract the customer signed, and the activity bridge
-- (which fires on signed_at) writes nothing for it. Additive and idempotent; no table is
-- created, so no fence call. The eight ADD COLUMNs and the constraint swap take a short lock
-- on job_contracts, which lock_timeout keeps short.

BEGIN;

ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS paper_title text;
ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS our_signer_name text;
ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS our_signed_on date;
ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS our_signed_how text;
ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS their_signed_on date;
ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS relied_on_on date;
ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS relied_on_what text;
ALTER TABLE public.job_contracts ADD COLUMN IF NOT EXISTS key_terms jsonb;

-- The kind gains its third value. The constraint is dropped and re-added under the same name,
-- so a re-run finds the new one and leaves it.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_contracts_kind_known' AND conrelid = 'public.job_contracts'::regclass
      AND pg_get_constraintdef(oid) NOT LIKE '%their_paper%'
  ) THEN
    ALTER TABLE public.job_contracts DROP CONSTRAINT job_contracts_kind_known;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_contracts_kind_known' AND conrelid = 'public.job_contracts'::regclass) THEN
    ALTER TABLE public.job_contracts ADD CONSTRAINT job_contracts_kind_known CHECK (kind IN ('contract', 'warranty', 'their_paper'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_contracts_key_terms_list' AND conrelid = 'public.job_contracts'::regclass) THEN
    ALTER TABLE public.job_contracts ADD CONSTRAINT job_contracts_key_terms_list CHECK (key_terms IS NULL OR jsonb_typeof(key_terms) = 'array');
  END IF;
  -- Their paper names who signed for us; the relied-on flag carries its words (the owner's call).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_contracts_their_paper_shape' AND conrelid = 'public.job_contracts'::regclass) THEN
    ALTER TABLE public.job_contracts ADD CONSTRAINT job_contracts_their_paper_shape CHECK (
      kind <> 'their_paper'
      OR (nullif(trim(our_signer_name), '') IS NOT NULL AND (relied_on_on IS NULL OR nullif(trim(relied_on_what), '') IS NOT NULL))
    );
  END IF;
END $$;

COMMENT ON COLUMN public.job_contracts.kind IS
  'contract (ours) · warranty (the warranty sent in place of a contract, each line initialled) · their_paper (the other side''s own form, signed by us; v2.6698).';
COMMENT ON COLUMN public.job_contracts.paper_title IS 'their_paper: what the paper is, as the office named it (their subcontract, their form).';
COMMENT ON COLUMN public.job_contracts.our_signer_name IS 'their_paper: who signed it for us.';
COMMENT ON COLUMN public.job_contracts.our_signed_on IS 'their_paper: the day we signed, company calendar.';
COMMENT ON COLUMN public.job_contracts.our_signed_how IS 'their_paper: how we signed (their e-sign, on paper).';
COMMENT ON COLUMN public.job_contracts.their_signed_on IS 'their_paper: the day they countersigned; NULL = not countersigned.';
COMMENT ON COLUMN public.job_contracts.relied_on_on IS 'their_paper: the day the other side relied on the paper (their notice, their pay application). With relied_on_what, the paper counts as signed for the Legal desk.';
COMMENT ON COLUMN public.job_contracts.relied_on_what IS 'their_paper: what the reliance was, in the office''s words.';
COMMENT ON COLUMN public.job_contracts.key_terms IS 'their_paper: [{ key, clause, words }] — termination, notice_to_proceed, default_cure, retainage_release, payment_contingency, change_orders, venue, fees_arbitration; typed by the office.';

COMMIT;
