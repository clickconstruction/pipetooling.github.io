SET lock_timeout = '3s';

-- Owner of record, PR 1 — the list that looks itself up.
--
-- The § 53.056 notice goes to the owner of record at a mailing address. The
-- app's parcel lookup (property-lookup, v2.3004) answers that for nearly every
-- Central-Texas address, so the office should never type an owner: the app
-- looks every GC job up and a person presses Use. "Confirmed" is that click —
-- a roll answer saved by Use is confirmed; a value a person typed before this
-- migration is treated as confirmed too (a person looked at it).

-- ---------- 1 · the confirmation stamp on the property record ----------

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS owner_confirmed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS owner_confirmed_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.customer_addresses.owner_confirmed_at IS
  'Owner of record confirmed by a person (the Use click on the Fix-ups list / job form / Bill Customer, or typed by hand before v2.3447). NULL = the owner fields are empty or were written by a machine and never looked at.';
COMMENT ON COLUMN public.customer_addresses.owner_confirmed_by IS
  'Who confirmed the owner of record (users.id); NULL for the backfill of hand-typed owners.';

-- Backfill: rows that already carry an owner were typed by a person.
UPDATE public.customer_addresses
   SET owner_confirmed_at = COALESCE(updated_at, now())
 WHERE owner_confirmed_at IS NULL
   AND (COALESCE(btrim(owner_name), '') <> '' OR COALESCE(btrim(owner_company), '') <> '');

-- ---------- 2 · the count the Fix-ups chip runs on ----------

-- One row per GC job (a GC set, or a builder in the customer row — a customer
-- that is the GC on some other job — with no GC set) in waiting · working ·
-- ready_to_bill · billed, with at least one approved clock session, whose
-- property record does not yet carry a CONFIRMED owner of record.
-- `has_owner` is the Lien desk's expression (list_lien_notice_months), so the
-- chip, the list and the desk's "Needs the owner" pile read one definition.
-- `first_deadline` is the § 53.056 date for the earliest approved work month
-- (lien_notice_deadline) — the list sorts by it. Office-gated; empty otherwise.
DROP FUNCTION IF EXISTS public.list_jobs_owner_to_confirm();
CREATE OR REPLACE FUNCTION public.list_jobs_owner_to_confirm()
RETURNS TABLE (
  job_id uuid,
  hcp_number text,
  click_number text,
  job_address text,
  status text,
  customer_id uuid,
  customer_name text,
  gc_customer_id uuid,
  gc_name text,
  customer_address_id uuid,
  has_owner boolean,
  owner_confirmed boolean,
  property_kind text,
  first_work_month text,
  first_deadline date
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
  builders AS (
    SELECT DISTINCT b.gc_customer_id AS customer_id
    FROM public.jobs_ledger b
    WHERE b.gc_customer_id IS NOT NULL
  ),
  jobs AS (
    SELECT j.id,
           j.hcp_number,
           j.click_number,
           j.job_address,
           j.status,
           j.customer_id,
           j.gc_customer_id,
           j.customer_address_id,
           COALESCE(ca.property_kind, '') AS property_kind,
           (
             COALESCE(btrim(jpo.mailing_address), '') <> ''
             OR (
               COALESCE(btrim(ca.owner_mailing_address), '') <> ''
               AND (COALESCE(btrim(ca.owner_name), '') <> '' OR COALESCE(btrim(ca.owner_company), '') <> '')
             )
           ) AS has_owner,
           (ca.owner_confirmed_at IS NOT NULL) AS owner_confirmed
    FROM public.jobs_ledger j
    LEFT JOIN public.customer_addresses ca ON ca.id = j.customer_address_id
    LEFT JOIN public.job_property_owners jpo ON jpo.job_id = j.id
    WHERE (SELECT ok FROM me)
      AND j.status IN ('waiting', 'working', 'ready_to_bill', 'billed')
      AND (
        j.gc_customer_id IS NOT NULL
        OR (j.customer_id IS NOT NULL AND j.customer_id IN (SELECT customer_id FROM builders))
      )
  ),
  months AS (
    SELECT cs.job_ledger_id AS job_id,
           MIN(to_char(cs.work_date::date, 'YYYY-MM')) AS first_work_month
    FROM public.clock_sessions cs
    JOIN jobs ON jobs.id = cs.job_ledger_id
    WHERE cs.approved_at IS NOT NULL
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND cs.clocked_out_at IS NOT NULL
      AND cs.clocked_out_at > cs.clocked_in_at
    GROUP BY 1
  )
  SELECT jobs.id AS job_id,
         COALESCE(jobs.hcp_number, '') AS hcp_number,
         COALESCE(jobs.click_number, '') AS click_number,
         COALESCE(jobs.job_address, '') AS job_address,
         jobs.status,
         jobs.customer_id,
         c.name AS customer_name,
         jobs.gc_customer_id,
         g.name AS gc_name,
         jobs.customer_address_id,
         jobs.has_owner,
         jobs.owner_confirmed,
         jobs.property_kind,
         m.first_work_month,
         public.lien_notice_deadline(m.first_work_month, jobs.property_kind) AS first_deadline
  FROM jobs
  JOIN months m ON m.job_id = jobs.id
  LEFT JOIN public.customers c ON c.id = jobs.customer_id
  LEFT JOIN public.customers g ON g.id = jobs.gc_customer_id
  WHERE NOT (jobs.has_owner AND jobs.owner_confirmed)
  ORDER BY public.lien_notice_deadline(m.first_work_month, jobs.property_kind) NULLS LAST, jobs.id;
$$;

COMMENT ON FUNCTION public.list_jobs_owner_to_confirm() IS
  'Owner of record (v2.3447): every GC job (GC set, or a builder in the customer row with no GC) in waiting/working/ready_to_bill/billed with approved hours whose property record has no confirmed owner of record — has_owner is the Lien desk''s expression; first_deadline the § 53.056 date for the earliest approved work month. Office roles only; empty otherwise.';

REVOKE EXECUTE ON FUNCTION public.list_jobs_owner_to_confirm() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_jobs_owner_to_confirm() TO authenticated;
