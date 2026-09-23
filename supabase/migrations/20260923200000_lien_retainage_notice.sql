SET lock_timeout = '3s';

-- The § 53.057 retainage notice (v2.3753, punch list #33 PR 1): the Code's
-- second instrument for a sub — a notice of claim for unpaid retainage, due by
-- the EARLIER of 30 days after the claimant's contract is completed, terminated
-- or abandoned, or 30 days after the original contract is terminated or
-- abandoned (§ 53.057(b)). The app has never known when our contract on a job
-- ended, nor how much retainage the GC holds back under the subcontract; this
-- migration teaches it both, widens the two kind lists, and adds the reader
-- the Lien desk's Retainage tab runs on. Counsel's memo of 2026-09-22
-- (to-dos/gc-failure-playbook/counsel-memo-2026-09-22.md): put unpaid retainage
-- inside the § 53.056 claim while the job is open, and send § 53.057 within the
-- 30 days as belt and suspenders.

-- ---------- 1 · the job's lien facts ----------

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS lien_contract_ended_on date,
  ADD COLUMN IF NOT EXISTS lien_contract_ended_how text,
  ADD COLUMN IF NOT EXISTS lien_contract_ended_set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lien_contract_ended_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS lien_retainage_held numeric(12,2),
  ADD COLUMN IF NOT EXISTS lien_payment_bond text NOT NULL DEFAULT 'unknown';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ledger_lien_contract_ended_how_check') THEN
    ALTER TABLE public.jobs_ledger ADD CONSTRAINT jobs_ledger_lien_contract_ended_how_check
      CHECK (lien_contract_ended_how IS NULL OR lien_contract_ended_how IN ('complete', 'terminated', 'abandoned'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ledger_lien_contract_ended_pair_check') THEN
    ALTER TABLE public.jobs_ledger ADD CONSTRAINT jobs_ledger_lien_contract_ended_pair_check
      CHECK ((lien_contract_ended_on IS NULL) = (lien_contract_ended_how IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ledger_lien_retainage_held_check') THEN
    ALTER TABLE public.jobs_ledger ADD CONSTRAINT jobs_ledger_lien_retainage_held_check
      CHECK (lien_retainage_held IS NULL OR lien_retainage_held >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ledger_lien_payment_bond_check') THEN
    ALTER TABLE public.jobs_ledger ADD CONSTRAINT jobs_ledger_lien_payment_bond_check
      CHECK (lien_payment_bond IN ('yes', 'no', 'unknown'));
  END IF;
END $$;

COMMENT ON COLUMN public.jobs_ledger.lien_contract_ended_on IS
  'Lien clock (v2.3753): the day OUR contract on this job was completed, terminated or abandoned — starts the 30-day § 53.057 retainage-notice window (lien_retainage_deadline). Typed by the office (Edit Job → Our contract on this job), suggested from last_work_date; never inferred.';
COMMENT ON COLUMN public.jobs_ledger.lien_contract_ended_how IS
  'complete | terminated | abandoned — § 53.057(b)''s three triggers; NULL while the contract is open (paired with lien_contract_ended_on).';
COMMENT ON COLUMN public.jobs_ledger.lien_retainage_held IS
  'Dollars the GC holds back from us under the subcontract and has not paid (§ 53.025 retainage) — what the § 53.057 form claims, and named inside the § 53.056 claim while the job is open. NULL = not recorded; 0 = the subcontract holds none.';
COMMENT ON COLUMN public.jobs_ledger.lien_payment_bond IS
  'yes | no | unknown — whether a payment bond is on the project (counsel: check each job for a bond before telling an owner to hold 10%). The affidavit piles read it (PR 3).';

-- ---------- 2 · the third kind ----------

ALTER TABLE public.job_lien_desk_items DROP CONSTRAINT IF EXISTS job_lien_desk_items_kind_check;
ALTER TABLE public.job_lien_desk_items ADD CONSTRAINT job_lien_desk_items_kind_check
  CHECK (kind IN ('notice_53_056', 'affidavit', 'retainage_53_057'));

ALTER TABLE public.job_lien_filings DROP CONSTRAINT IF EXISTS job_lien_filings_kind_check;
ALTER TABLE public.job_lien_filings ADD CONSTRAINT job_lien_filings_kind_check
  CHECK (kind IN ('notice_53_056', 'affidavit', 'release_of_record', 'retainage_53_057'));

-- ---------- 3 · the 30-day clock ----------

-- 30 days after the contract ended, weekend-rolled (§ 53.057(b), § 53.003) —
-- the same rule as src/lib/jobs/lienDeadlines.ts retainageDeadlineFor.
CREATE OR REPLACE FUNCTION public.lien_retainage_deadline(p_ended_on date)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d date;
BEGIN
  IF p_ended_on IS NULL THEN RETURN NULL; END IF;
  d := p_ended_on + 30;
  IF extract(dow FROM d) = 6 THEN d := d + 2;
  ELSIF extract(dow FROM d) = 0 THEN d := d + 1;
  END IF;
  RETURN d;
END;
$$;

COMMENT ON FUNCTION public.lien_retainage_deadline(date) IS
  'The § 53.057 retainage-notice deadline (v2.3753): 30 days after our contract on the job was completed, terminated or abandoned, rolled off a weekend per § 53.003. NULL while the contract is open.';

-- ---------- 4 · the reader the Retainage tab runs on ----------

-- Every sub job whose subcontract holds retainage we have not been paid
-- (lien_retainage_held > 0): the ones whose clock has not started (no
-- contract-ended date), and the ones whose 30-day deadline is within
-- p_within_days ahead or a week behind, with the gate facts and the live
-- desk item. Office roles only; empty otherwise.
DROP FUNCTION IF EXISTS public.list_lien_retainage_windows(integer);

CREATE FUNCTION public.list_lien_retainage_windows(p_within_days integer DEFAULT 30)
RETURNS TABLE (
  job_id uuid,
  retainage_held numeric,
  contract_ended_on date,
  contract_ended_how text,
  deadline date,
  noticed boolean,
  in_claim boolean,
  open_balance numeric,
  customer_id uuid,
  gc_customer_id uuid,
  property_kind text,
  has_owner boolean,
  payment_bond text,
  desk_item_id uuid,
  desk_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT public.is_dev()
        OR public.is_assistant()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician') AS ok
  ),
  jobs AS (
    SELECT j.id,
           j.customer_id,
           j.gc_customer_id,
           j.lien_retainage_held,
           j.lien_contract_ended_on,
           j.lien_contract_ended_how,
           j.lien_payment_bond,
           public.lien_retainage_deadline(j.lien_contract_ended_on) AS deadline,
           GREATEST(0, COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0))::numeric AS open_balance,
           COALESCE(ca.property_kind, '') AS property_kind,
           (
             COALESCE(btrim(jpo.mailing_address), '') <> ''
             OR (
               COALESCE(btrim(ca.owner_mailing_address), '') <> ''
               AND (COALESCE(btrim(ca.owner_name), '') <> '' OR COALESCE(btrim(ca.owner_company), '') <> '')
             )
           ) AS has_owner
    FROM public.jobs_ledger j
    LEFT JOIN public.customer_addresses ca ON ca.id = j.customer_address_id
    LEFT JOIN public.job_property_owners jpo ON jpo.job_id = j.id
    WHERE (SELECT ok FROM me)
      AND j.gc_customer_id IS NOT NULL
      AND COALESCE(j.lien_retainage_held, 0) > 0
  )
  SELECT d.id AS job_id,
         d.lien_retainage_held AS retainage_held,
         d.lien_contract_ended_on AS contract_ended_on,
         d.lien_contract_ended_how AS contract_ended_how,
         d.deadline,
         EXISTS (SELECT 1 FROM public.job_lien_filings f WHERE f.job_id = d.id AND f.kind = 'retainage_53_057' AND f.voided_at IS NULL) AS noticed,
         EXISTS (
           SELECT 1 FROM public.job_lien_filings f
           WHERE f.job_id = d.id AND f.kind = 'notice_53_056' AND f.voided_at IS NULL
             AND COALESCE(f.fields->>'retainageIncluded', '') <> ''
         ) AS in_claim,
         d.open_balance,
         d.customer_id,
         d.gc_customer_id,
         d.property_kind,
         d.has_owner,
         d.lien_payment_bond AS payment_bond,
         i.id AS desk_item_id,
         i.status AS desk_status
  FROM jobs d
  LEFT JOIN LATERAL (
    SELECT x.id, x.status
    FROM public.job_lien_desk_items x
    WHERE x.job_id = d.id AND x.kind = 'retainage_53_057' AND x.voided_at IS NULL AND x.status NOT IN ('sent', 'missed')
    ORDER BY x.created_at DESC
    LIMIT 1
  ) i ON true
  WHERE d.deadline IS NULL
     OR (d.deadline <= public.app_today() + GREATEST(0, p_within_days) AND d.deadline >= public.app_today() - 7)
     OR i.id IS NOT NULL
  ORDER BY d.deadline NULLS LAST, d.id;
$$;

REVOKE EXECUTE ON FUNCTION public.list_lien_retainage_windows(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_lien_retainage_windows(integer) TO authenticated;

COMMENT ON FUNCTION public.list_lien_retainage_windows(integer) IS
  'Lien desk Retainage tab (v2.3753): every sub job with unpaid subcontract retainage recorded (jobs_ledger.lien_retainage_held > 0) — the ones whose 30-day § 53.057 clock has not started (no contract-ended date), and the ones whose deadline is within p_within_days ahead or a week behind, or that carry a live desk item — with the gate facts (owner of record, property kind, payment bond), whether a § 53.057 notice is recorded, whether a recorded § 53.056 notice already named the retainage, and the live desk item. Office roles only; empty otherwise.';
