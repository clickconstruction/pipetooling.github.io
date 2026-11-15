SET lock_timeout = '3s';

-- Job accounts: who said "not needed", and when.
--
-- A job's account at a supply house (job_supply_house_accounts, 20260914210000) stamps who asked
-- (requested_by / requested_at) and who opened it (opened_by / opened_at). A row marked NOT NEEDED
-- stamped nobody: the sheet on the job could say "the office decided" and not who or when, and on
-- 2026-11-13 Taunya found three such rows on a job two days old with nothing in its history to
-- say where they came from. This gives the third status its own pair of stamps, filled by the
-- trigger the other two use, and hands them to the job's strip.
--
-- No table is made, so no fence call is owed. Two nullable columns, one backfill, the stamp
-- trigger's function restated with one more branch, and list_job_account_strip() dropped and
-- remade with two more columns at the end of its row (a RETURNS TABLE cannot grow in place).

-- ---------- 1 · the columns ----------

ALTER TABLE public.job_supply_house_accounts
  ADD COLUMN IF NOT EXISTS not_needed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS not_needed_at timestamptz;

COMMENT ON COLUMN public.job_supply_house_accounts.not_needed_by IS
  'Who marked the account not needed, or last changed its reason. Filled by job_supply_house_accounts_stamp() from auth.uid(), never by the client; null on a row marked before 20261115230000, and whenever the status is not not_needed.';
COMMENT ON COLUMN public.job_supply_house_accounts.not_needed_at IS
  'When the account was marked not needed, or its reason last changed. Filled by job_supply_house_accounts_stamp(); rows marked before 20261115230000 carry their last write (updated_at). Null whenever the status is not not_needed.';

-- ---------- 2 · the rows already marked ----------

-- When: the row's last write, which for a not-needed row is the mark or a later change to its
-- reason. Who: nobody recorded it, so it stays null and the sheet says only the day. The stamp
-- trigger is set aside for this one statement so updated_at keeps the time it is being read
-- from; a DO block is one statement, so a failure inside it leaves the trigger as it was.
DO $$
BEGIN
  ALTER TABLE public.job_supply_house_accounts DISABLE TRIGGER job_supply_house_accounts_stamp;
  UPDATE public.job_supply_house_accounts
     SET not_needed_at = updated_at
   WHERE status = 'not_needed'
     AND not_needed_at IS NULL;
  ALTER TABLE public.job_supply_house_accounts ENABLE TRIGGER job_supply_house_accounts_stamp;
END $$;

-- ---------- 3 · the stamp ----------

-- As 20260914210000 wrote it, with the not-needed pair added. The pair is the server's: a row
-- that becomes not needed, or whose reason changes while it is, takes now() and auth.uid(); a
-- not-needed row written with neither change keeps the pair it had, whatever the client sent;
-- any other status carries none.
CREATE OR REPLACE FUNCTION public.job_supply_house_accounts_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'requested' THEN
    IF NEW.requested_at IS NULL THEN NEW.requested_at := now(); END IF;
    IF NEW.requested_by IS NULL THEN NEW.requested_by := auth.uid(); END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'open' THEN
      NEW.opened_at := NULL;
      NEW.opened_by := NULL;
    END IF;
  ELSIF NEW.status = 'open' THEN
    IF NEW.opened_at IS NULL THEN NEW.opened_at := now(); END IF;
    IF NEW.opened_by IS NULL THEN NEW.opened_by := auth.uid(); END IF;
  END IF;

  IF NEW.status = 'not_needed' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.not_needed_at := now();
      NEW.not_needed_by := auth.uid();
    ELSIF OLD.status IS DISTINCT FROM 'not_needed' OR OLD.note IS DISTINCT FROM NEW.note THEN
      NEW.not_needed_at := now();
      NEW.not_needed_by := auth.uid();
    ELSE
      NEW.not_needed_at := OLD.not_needed_at;
      NEW.not_needed_by := OLD.not_needed_by;
    END IF;
  ELSE
    NEW.not_needed_at := NULL;
    NEW.not_needed_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------- 4 · the strip reads it ----------

-- As 20260914280000 wrote it, with not_needed_at and the marker's name at the end of the row.
-- The name comes through here because the crew reads the strip and cannot read public.users.
DROP FUNCTION IF EXISTS public.list_job_account_strip(uuid[]);

CREATE FUNCTION public.list_job_account_strip(p_job_ids uuid[])
RETURNS TABLE (
  job_id uuid,
  supply_house_id uuid,
  house_name text,
  policy text,
  account_id uuid,
  status text,
  account_ref text,
  opened_via text,
  opened_at timestamptz,
  requested_at timestamptz,
  requested_from_counter boolean,
  account_note text,
  rep_contact_id uuid,
  rep_name text,
  rep_phone text,
  not_needed_at timestamptz,
  not_needed_by_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jobs AS (
    SELECT j.id
    FROM public.jobs_ledger j
    WHERE j.id = ANY (COALESCE(p_job_ids, '{}'::uuid[]))
      AND (public.can_read_job_activity(j.id, false) OR public.estimator_can_reach_job_account(j.id))
  ),
  expecting AS (
    SELECT h.id
    FROM public.supply_houses h
    WHERE h.job_accounts = 'expects'
  ),
  pairs AS (
    SELECT jobs.id AS job_id, e.id AS house_id
    FROM jobs CROSS JOIN expecting e
    UNION
    SELECT a.job_id, a.supply_house_id
    FROM public.job_supply_house_accounts a
    JOIN jobs ON jobs.id = a.job_id
  ),
  rep AS (
    SELECT DISTINCT ON (c.supply_house_id)
      c.supply_house_id,
      c.id,
      COALESCE(NULLIF(btrim(c.name), ''), NULLIF(btrim(c.label), ''), c.email) AS name,
      c.phone
    FROM public.supply_house_contacts c
    WHERE c.role = 'job_accounts'
      AND c.archived_at IS NULL
      AND c.supply_house_id IS NOT NULL
    ORDER BY c.supply_house_id, c.is_default DESC, c.name
  )
  SELECT
    p.job_id,
    p.house_id,
    h.name,
    h.job_accounts,
    a.id,
    a.status,
    a.account_ref,
    a.opened_via,
    a.opened_at,
    a.requested_at,
    a.requested_from_counter,
    a.note,
    rep.id,
    rep.name,
    rep.phone,
    a.not_needed_at,
    NULLIF(btrim(nb.name), '')
  FROM pairs p
  JOIN public.supply_houses h ON h.id = p.house_id
  LEFT JOIN public.job_supply_house_accounts a
    ON a.job_id = p.job_id AND a.supply_house_id = p.house_id
  LEFT JOIN rep ON rep.supply_house_id = p.house_id
  LEFT JOIN public.users nb ON nb.id = a.not_needed_by
  ORDER BY p.job_id, h.name;
$$;

COMMENT ON FUNCTION public.list_job_account_strip(uuid[]) IS
  'Job accounts at the counter (v2.3424, v2.3451): per readable job, one row per house that expects a job account (status NULL = none yet) plus every account the job has elsewhere, with the house''s job-accounts rep and, on a not-needed row, when it was marked and by whom (20261115230000). Gate: can_read_job_activity(job, false) or estimator_can_reach_job_account(job).';

REVOKE EXECUTE ON FUNCTION public.list_job_account_strip(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_job_account_strip(uuid[]) TO authenticated, service_role;
