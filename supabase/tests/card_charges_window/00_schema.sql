-- Minimal stand-in for the prod schema the card-charges window reads (list_card_charges_window and
-- _card_charges_window_rows: 20261005212106, 20261005235207, 20261006061356). Test bed only.
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

-- Stand-ins for the prod role helpers: the office roles, payroll access (dev here), the holder's circle (everyone).
CREATE OR REPLACE FUNCTION public.is_office_staff() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller'))
$$;
CREATE OR REPLACE FUNCTION public.has_payroll_access() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'dev')
$$;
CREATE OR REPLACE FUNCTION public.staff_can_view_user_for_tally_followup(p_viewer uuid, p_target uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_viewer IS NOT NULL
$$;

-- As in the baseline.
CREATE OR REPLACE FUNCTION public.mercury_debit_card_id_from_raw(p_raw jsonb) RETURNS uuid
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $_$
  SELECT CASE
    WHEN p_raw IS NULL THEN NULL
    WHEN v IS NULL OR v = '' OR v !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN NULL
    ELSE v::uuid
  END
  FROM (
    SELECT lower(trim(both FROM COALESCE(
      NULLIF(trim(both FROM p_raw #>> '{details,debitCardInfo,id}'), ''),
      NULLIF(trim(both FROM p_raw #>> '{debitCardInfo,id}'), '')
    ))) AS v
  ) x
$_$;

CREATE OR REPLACE FUNCTION public.reporting_window_calendar_civil_day(p_timezone text, p_civil_day date)
RETURNS TABLE(window_start_utc timestamp with time zone, window_end_utc timestamp with time zone, reporting_date date)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  WITH z AS (
    SELECT COALESCE(NULLIF(trim(p_timezone), ''), 'America/Chicago') AS tznm
  )
  SELECT
    (p_civil_day::timestamp AT TIME ZONE (SELECT tznm FROM z))::timestamptz AS window_start_utc,
    (((p_civil_day + INTERVAL '1 day')::date)::timestamp AT TIME ZONE (SELECT tznm FROM z))::timestamptz AS window_end_utc,
    p_civil_day AS reporting_date
  FROM z;
$$;

CREATE TABLE public.mercury_transactions (
  id uuid PRIMARY KEY,
  posted_at timestamptz,
  amount numeric NOT NULL,
  counterparty_name text,
  kind text NOT NULL,
  status text,
  mercury_category jsonb,
  raw jsonb,
  duplicate_of_transaction_id uuid,
  -- The row's insert time, which the read must never return as the purchase time.
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mercury_transactions_posted_at_desc_idx ON public.mercury_transactions (posted_at DESC);

CREATE TABLE public.mercury_debit_card_user_links (mercury_debit_card_id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.mercury_debit_card_nicknames (mercury_debit_card_id uuid PRIMARY KEY, nickname text, card_role text);
CREATE TABLE public.mercury_transaction_attributions (mercury_transaction_id uuid PRIMARY KEY, user_id uuid, person_id uuid);
CREATE TABLE public.mercury_drag_sort_labels (id uuid PRIMARY KEY, default_key text);
CREATE TABLE public.mercury_transaction_drag_sort_assignments (mercury_transaction_id uuid PRIMARY KEY, label_id uuid);
CREATE TABLE public.mercury_tally_payroll_flags (mercury_transaction_id uuid PRIMARY KEY, is_payroll boolean NOT NULL DEFAULT true);
CREATE TABLE public.jobs_ledger (id uuid PRIMARY KEY, hcp_number text, click_number text, job_name text, service_type_id uuid);
CREATE TABLE public.mercury_transaction_job_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mercury_transaction_id uuid NOT NULL,
  job_id uuid NOT NULL,
  amount numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE TABLE public.supply_houses (id uuid PRIMARY KEY, name text);
CREATE TABLE public.supply_house_invoices (id uuid PRIMARY KEY, invoice_number text, invoice_date date, amount numeric, supply_house_id uuid);
CREATE TABLE public.mercury_transaction_supply_house_invoice_links (
  mercury_transaction_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Postgres 16+ has pg_input_is_valid in pg_catalog (prod runs 17.6), and pg_catalog wins on the
-- search path; a Postgres 15 bed (PGTEST_PGBIN) gets this stand-in, which answers the same.
DO $$
BEGIN
  IF to_regprocedure('pg_catalog.pg_input_is_valid(text, text)') IS NULL THEN
    EXECUTE $f$
      CREATE FUNCTION public.pg_input_is_valid(p_input text, p_type text) RETURNS boolean LANGUAGE plpgsql STABLE AS $b$
      BEGIN
        EXECUTE format('SELECT %L::%s', p_input, p_type);
        RETURN true;
      EXCEPTION WHEN others THEN
        RETURN false;
      END $b$
    $f$;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.t_assert(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', p_msg; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.t_as(p_user uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true)
$$;
