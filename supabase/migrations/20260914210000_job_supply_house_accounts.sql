SET lock_timeout = '3s';

-- Job accounts at the counter, PR 1 (v2.3423): a supply-house job account
-- becomes a status on the job, per house — requested · open · not needed —
-- instead of a log of emailed packets. Curly opens accounts on the phone;
-- this is where that gets written down.
--
-- Also: which houses expect a job account per property, which contact at
-- the house opens them (and their phone), and the packet send-log learns
-- which house it went to.

-- ---------- 1 · the house: does it expect a job account? ----------

ALTER TABLE public.supply_houses
  ADD COLUMN IF NOT EXISTS job_accounts text NOT NULL DEFAULT 'optional';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supply_houses_job_accounts_check'
  ) THEN
    ALTER TABLE public.supply_houses
      ADD CONSTRAINT supply_houses_job_accounts_check
      CHECK (job_accounts IN ('expects', 'optional', 'none'));
  END IF;
END $$;

COMMENT ON COLUMN public.supply_houses.job_accounts IS
  'Job accounts (v2.3423): expects = the house opens a job account per property and the app signals when a job has none; optional = it can, no signal; none = never (insurers, online orders).';

-- The three counters the office named on 2026-09-14. Only rows still at the
-- default move, so a later hand change is never undone by a re-run.
UPDATE public.supply_houses
   SET job_accounts = 'expects'
 WHERE job_accounts = 'optional'
   AND vendor_kind = 'supply_house'
   AND (name ILIKE 'ferguson%' OR name ILIKE 'reece%' OR name ILIKE 'moore supply%');

UPDATE public.supply_houses
   SET job_accounts = 'none'
 WHERE job_accounts = 'optional'
   AND vendor_kind <> 'supply_house';

-- ---------- 2 · the contact: a role and a phone ----------

ALTER TABLE public.supply_house_contacts
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'price_requests',
  ADD COLUMN IF NOT EXISTS phone text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supply_house_contacts_role_check'
  ) THEN
    ALTER TABLE public.supply_house_contacts
      ADD CONSTRAINT supply_house_contacts_role_check
      CHECK (role IN ('price_requests', 'job_accounts', 'billing'));
  END IF;
END $$;

COMMENT ON COLUMN public.supply_house_contacts.role IS
  'v2.3423: price_requests (the RFQ desk''s To/CC, the default) · job_accounts (who opens job accounts — the field''s Call button dials this one) · billing.';

-- "REP FOR JOB ACCTS" typed into a label becomes the role.
UPDATE public.supply_house_contacts
   SET role = 'job_accounts'
 WHERE role = 'price_requests'
   AND label ILIKE '%job acc%';

-- The field reads the job-accounts rep (name + phone) for the strip on the
-- job; everything else about contacts stays office + estimator.
DROP POLICY IF EXISTS supply_house_contacts_select_job_accounts_rep ON public.supply_house_contacts;
CREATE POLICY supply_house_contacts_select_job_accounts_rep ON public.supply_house_contacts
  FOR SELECT TO authenticated
  USING (role = 'job_accounts' AND archived_at IS NULL);

-- ---------- 3 · the record: one row per job × house ----------

CREATE TABLE IF NOT EXISTS public.job_supply_house_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  supply_house_id uuid NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'requested'
    CONSTRAINT job_supply_house_accounts_status_check CHECK (status IN ('requested', 'open', 'not_needed')),
  -- The house's own job / account number, when they give one.
  account_ref text NOT NULL DEFAULT '',
  opened_via text
    CONSTRAINT job_supply_house_accounts_opened_via_check
    CHECK (opened_via IS NULL OR opened_via IN ('phone', 'packet', 'counter')),
  rep_contact_id uuid REFERENCES public.supply_house_contacts(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  requested_at timestamptz,
  -- true when the ask came from the field standing at the counter.
  requested_from_counter boolean NOT NULL DEFAULT false,
  opened_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  opened_at timestamptz,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_supply_house_accounts_job_house_uniq UNIQUE (job_id, supply_house_id)
);

COMMENT ON TABLE public.job_supply_house_accounts IS
  'Job accounts at the counter (v2.3423): one row per (job, supply house) once anyone has asked for or opened the house''s job account for the property. status requested (an open errand) · open (Curly opened it; account_ref / opened_via / rep say how) · not_needed (an office decision with its reason in note). No row = none yet.';

CREATE INDEX IF NOT EXISTS job_supply_house_accounts_job_idx ON public.job_supply_house_accounts (job_id);
CREATE INDEX IF NOT EXISTS job_supply_house_accounts_house_idx ON public.job_supply_house_accounts (supply_house_id);

ALTER TABLE public.job_supply_house_accounts ENABLE ROW LEVEL SECURITY;

-- Read: anyone who can read the job's operational activity — the office set,
-- the job's master, adopted / shared assistants, primaries, and the crew on
-- the job's team (can_read_job_activity, non-financial). The field needs
-- the strip at the counter.
DROP POLICY IF EXISTS job_supply_house_accounts_select_job_readers ON public.job_supply_house_accounts;
CREATE POLICY job_supply_house_accounts_select_job_readers
  ON public.job_supply_house_accounts FOR SELECT TO authenticated
  USING (public.can_read_job_activity(job_id, false));

-- Insert: the office writes any status; anyone who can read the job may
-- ask (a `requested` row attributed to themselves).
DROP POLICY IF EXISTS job_supply_house_accounts_insert ON public.job_supply_house_accounts;
CREATE POLICY job_supply_house_accounts_insert
  ON public.job_supply_house_accounts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_office_staff()
    OR (
      status = 'requested'
      AND requested_by = (SELECT auth.uid())
      AND public.can_read_job_activity(job_id, false)
    )
  );

-- Update / delete: office only (marking opened or not needed is the office's call).
DROP POLICY IF EXISTS job_supply_house_accounts_update_office ON public.job_supply_house_accounts;
CREATE POLICY job_supply_house_accounts_update_office
  ON public.job_supply_house_accounts FOR UPDATE TO authenticated
  USING (public.is_office_staff())
  WITH CHECK (public.is_office_staff());

DROP POLICY IF EXISTS job_supply_house_accounts_delete_office ON public.job_supply_house_accounts;
CREATE POLICY job_supply_house_accounts_delete_office
  ON public.job_supply_house_accounts FOR DELETE TO authenticated
  USING (public.is_office_staff());

-- Stamps: who asked / who opened, filled server-side so every client writes
-- the same thing. A reopened request (open → requested) clears the opened stamps.
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_supply_house_accounts_stamp ON public.job_supply_house_accounts;
CREATE TRIGGER job_supply_house_accounts_stamp
  BEFORE INSERT OR UPDATE ON public.job_supply_house_accounts
  FOR EACH ROW EXECUTE FUNCTION public.job_supply_house_accounts_stamp();

-- ---------- 4 · the send log points at the house and the account ----------

ALTER TABLE public.supply_house_job_accounts
  ADD COLUMN IF NOT EXISTS supply_house_id uuid REFERENCES public.supply_houses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.job_supply_house_accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.supply_house_job_accounts.supply_house_id IS
  'v2.3423 (deferred from v2.3161): which house the packet went to, from the contact''s house when the contact is linked.';

-- Backfill from the contact the packet was addressed to, where the email is a linked contact.
UPDATE public.supply_house_job_accounts s
   SET supply_house_id = c.supply_house_id
  FROM public.supply_house_contacts c
 WHERE s.supply_house_id IS NULL
   AND c.supply_house_id IS NOT NULL
   AND lower(c.email) = lower(s.contact_email);

CREATE INDEX IF NOT EXISTS supply_house_job_accounts_house_idx ON public.supply_house_job_accounts (supply_house_id);

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
