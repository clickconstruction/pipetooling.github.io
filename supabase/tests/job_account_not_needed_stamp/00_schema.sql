-- Minimal stand-in for the prod schema 20261115230000_job_account_not_needed_stamp.sql changes:
-- the job-account record with the stamp trigger as 20260914210000 wrote it, the strip function in
-- its fifteen-column shape, and the tables and gates the strip reads. Test bed only.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
-- The signed-in person is a transaction-local setting, as PostgREST sets it on prod.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  name text,
  role text NOT NULL
);
CREATE TABLE public.jobs_ledger (id uuid PRIMARY KEY, hcp_number text, job_name text, bid_id uuid);
CREATE TABLE public.supply_houses (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  job_accounts text NOT NULL DEFAULT 'optional',
  vendor_kind text NOT NULL DEFAULT 'supply_house'
);
CREATE TABLE public.supply_house_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_house_id uuid REFERENCES public.supply_houses(id),
  name text,
  label text,
  email text NOT NULL DEFAULT '',
  phone text,
  role text NOT NULL DEFAULT 'price_requests',
  is_default boolean NOT NULL DEFAULT false,
  archived_at timestamptz
);

-- Stand-ins for the two gates the strip asks: anyone signed in but an estimator reads a job's
-- activity; an estimator reaches a job that carries a bid.
CREATE OR REPLACE FUNCTION public.can_read_job_activity(p_job_id uuid, p_financial boolean) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role <> 'estimator')
$$;
CREATE OR REPLACE FUNCTION public.estimator_can_reach_job_account(p_job_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'estimator')
     AND EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id AND j.bid_id IS NOT NULL)
$$;

-- The record and its stamp, as 20260914210000_job_supply_house_accounts.sql made them, without RLS.
CREATE TABLE public.job_supply_house_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  supply_house_id uuid NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'requested'
    CONSTRAINT job_supply_house_accounts_status_check CHECK (status IN ('requested', 'open', 'not_needed')),
  account_ref text NOT NULL DEFAULT '',
  opened_via text
    CONSTRAINT job_supply_house_accounts_opened_via_check
    CHECK (opened_via IS NULL OR opened_via IN ('phone', 'packet', 'counter')),
  rep_contact_id uuid REFERENCES public.supply_house_contacts(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  requested_at timestamptz,
  requested_from_counter boolean NOT NULL DEFAULT false,
  opened_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  opened_at timestamptz,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_supply_house_accounts_job_house_uniq UNIQUE (job_id, supply_house_id)
);

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

CREATE TRIGGER job_supply_house_accounts_stamp
  BEFORE INSERT OR UPDATE ON public.job_supply_house_accounts
  FOR EACH ROW EXECUTE FUNCTION public.job_supply_house_accounts_stamp();

-- The strip in the fifteen-column shape prod carries before the migration (20260914280000). The
-- body is a stub: the bed proves the migration drops this shape and makes its own.
CREATE FUNCTION public.list_job_account_strip(p_job_ids uuid[])
RETURNS TABLE (
  job_id uuid, supply_house_id uuid, house_name text, policy text, account_id uuid, status text,
  account_ref text, opened_via text, opened_at timestamptz, requested_at timestamptz,
  requested_from_counter boolean, account_note text, rep_contact_id uuid, rep_name text, rep_phone text
)
LANGUAGE sql STABLE AS $$
  SELECT NULL::uuid, NULL::uuid, NULL::text, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::text,
         NULL::timestamptz, NULL::timestamptz, NULL::boolean, NULL::text, NULL::uuid, NULL::text, NULL::text
  WHERE false
$$;

-- The people, a job, three houses, and two rows marked before the migration: one not needed
-- with the old one-press note, one open. Their times are set to a known past day.
INSERT INTO public.users (id, name, role) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Owner Dev',      'dev'),
  ('00000000-0000-4000-8000-000000000002', 'Office Tess',    'assistant'),
  ('00000000-0000-4000-8000-000000000003', 'Estimator Mike', 'estimator'),
  ('00000000-0000-4000-8000-000000000004', 'Crew Cal',       'subcontractor'),
  ('00000000-0000-4000-8000-000000000005', '   ',            'assistant');
INSERT INTO public.jobs_ledger (id, hcp_number, job_name, bid_id) VALUES
  ('11111111-0000-4000-8000-000000000001', 'J1', 'ZZ Test job one', NULL),
  ('11111111-0000-4000-8000-000000000002', 'J2', 'ZZ Test job two', NULL);
INSERT INTO public.supply_houses (id, name, job_accounts) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Bluebonnet Supply', 'expects'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Cedar Pipe',        'expects'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Mesquite Supply',   'expects');
INSERT INTO public.job_supply_house_accounts (job_id, supply_house_id, status, note) VALUES
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'not_needed', 'New job — no job account needed');
INSERT INTO public.job_supply_house_accounts (job_id, supply_house_id, status, opened_via) VALUES
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002', 'open', 'phone');
ALTER TABLE public.job_supply_house_accounts DISABLE TRIGGER job_supply_house_accounts_stamp;
UPDATE public.job_supply_house_accounts SET created_at = '2026-10-07 22:13:03+00', updated_at = '2026-10-07 22:13:03+00';
ALTER TABLE public.job_supply_house_accounts ENABLE TRIGGER job_supply_house_accounts_stamp;
