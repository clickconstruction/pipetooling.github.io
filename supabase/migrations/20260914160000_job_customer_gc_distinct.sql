SET lock_timeout = '3s';

-- v2.3404 — A job's customer and GC are never the same party (owner rule,
-- 2026-09-14). The client (v2.3403) moves a builder between the two rows as
-- it is picked; this migration makes the database say the same thing for
-- every writer (RPCs, edge functions, merges, older clients) and sweeps the
-- rows already carrying one customers row in both slots — "for people that
-- are listed as both we should clean up by moving them to GC".
--
-- A job with a GC and no customer is a GC job: the builder is the only
-- party, and its bills go to the GC (bill_to_party = 'gc';
-- effectiveInvoiceParty in the client and job_bill_payer_customer_id here
-- both read an empty customer link that way).

-- ---------------------------------------------------------------------------
-- 1. The rule, as a BEFORE trigger that MOVES rather than rejects: a write
--    that would set customer_id = gc_customer_id lands as a GC job.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jobs_ledger_customer_gc_distinct()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL
     AND NEW.gc_customer_id IS NOT NULL
     AND NEW.customer_id = NEW.gc_customer_id THEN
    NEW.customer_id := NULL;
    NEW.customer_name := NULL;
    NEW.customer_email := NULL;
    NEW.customer_phone := NULL;
    NEW.bill_to_party := 'gc';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.jobs_ledger_customer_gc_distinct() IS
  'v2.3404: a job''s customer and GC are never the same party. A write that names one customers row in both slots keeps it as the GC only — the customer link and its copies clear and the bills go to the GC (a GC job).';

DROP TRIGGER IF EXISTS jobs_ledger_customer_gc_distinct ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_customer_gc_distinct
  BEFORE INSERT OR UPDATE OF customer_id, gc_customer_id ON public.jobs_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.jobs_ledger_customer_gc_distinct();

-- ---------------------------------------------------------------------------
-- 2. The payer resolver reads a GC job as the GC paying (mirrors the client's
--    effectiveInvoiceParty, v2.3403). Body from 20260913150812; one clause added.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.job_bill_payer_customer_id(
  p_bill_to_party text,
  p_customer_id uuid,
  p_gc_customer_id uuid
)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_gc_customer_id IS NOT NULL
         AND (p_customer_id IS NULL OR p_gc_customer_id = p_customer_id OR p_bill_to_party = 'gc')
      THEN p_gc_customer_id
    ELSE p_customer_id
  END
$$;

COMMENT ON FUNCTION public.job_bill_payer_customer_id(text, uuid, uuid) IS
  'Who pays (v2.3374, v2.3404): the customers row that pays a job under its bill_to_party rule with no invoice pick in play — the GC when the job has no customer link (a GC job), when it is the job customer, or when the rule says gc; else the job customer. Pure; mirrors jobPromisePayerCustomerId in the client kernel.';

-- ---------------------------------------------------------------------------
-- 3. The sweep: every job carrying one customers row as both customer and GC
--    becomes a GC job (72 rows on 2026-09-14: RMC- Dudley Mason 23, Knight 13,
--    H & I 6, Michael Palmer 6 …; 71 already on the gc rule). Idempotent —
--    the trigger above makes the same change, and a re-run matches no rows.
-- ---------------------------------------------------------------------------

UPDATE public.jobs_ledger
   SET customer_id = NULL,
       customer_name = NULL,
       customer_email = NULL,
       customer_phone = NULL,
       bill_to_party = 'gc'
 WHERE customer_id IS NOT NULL
   AND customer_id = gc_customer_id;
