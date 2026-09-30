-- Minimal stand-in for the prod schema the payment_removed_when_removed migration touches. Test bed only.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE public.jobs_ledger (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.jobs_ledger_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  sequence_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  paid_on date,
  note text,
  invoice_id uuid,
  payment_type text,
  reference_number text,
  mercury_transaction_id uuid,
  sent_on date,
  stripe_credit_note_id text
);
CREATE TABLE public.job_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  actor_user_id uuid,
  summary text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  financial boolean NOT NULL DEFAULT false
);
CREATE TABLE public.deleted_records_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text,
  group_key text,
  row_data jsonb NOT NULL,
  deleted_by uuid,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz,
  restored_by uuid
);

-- Stand-in for archive_deleted_record('job_id'): the row as it was, at the moment it was deleted.
CREATE FUNCTION public.archive_deleted_record_stub() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_by)
  VALUES (TG_TABLE_NAME, OLD.id::text, OLD.job_id::text, to_jsonb(OLD), auth.uid());
  RETURN OLD;
END $$;
CREATE TRIGGER zzz_archive_on_delete BEFORE DELETE ON public.jobs_ledger_payments
  FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_record_stub();

-- The live body before the fix (pg_get_functiondef, read 2026-09-30), so the bed can make
-- the mis-dated removals the one-time correction repairs.
CREATE OR REPLACE FUNCTION public.jobs_ledger_payments_to_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.jobs_ledger_payments%rowtype;
  v_type text;
  v_qual text;
  v_summary text;
begin
  if tg_op = 'DELETE' then r := old; v_type := 'payment_removed'; else r := new; v_type := 'payment_added'; end if;
  v_qual := nullif(
    concat_ws(' · ', nullif(trim(coalesce(r.payment_type, '')), ''), nullif(trim(coalesce(r.reference_number, '')), '')),
    ''
  );
  v_summary := (case when v_type = 'payment_removed' then 'Payment removed ' else 'Payment ' end)
    || '$' || to_char(coalesce(r.amount, 0), 'FM999,999,990.00')
    || coalesce(' (' || v_qual || ')', '');
  insert into public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  select r.job_id, v_type, coalesce(r.created_at, now()), auth.uid(), v_summary,
         jsonb_build_object('amount', r.amount, 'payment_type', r.payment_type, 'source_id', r.id::text),
         true
  where not exists (
    select 1 from public.job_activity_events e
    where e.event_type = v_type and e.detail ->> 'source_id' = r.id::text
  )
    and exists (select 1 from public.jobs_ledger jl where jl.id = r.job_id);
  return r;
end;
$function$;
CREATE TRIGGER jobs_ledger_payments_to_activity_del AFTER DELETE ON public.jobs_ledger_payments
  FOR EACH ROW EXECUTE FUNCTION public.jobs_ledger_payments_to_activity();
CREATE TRIGGER jobs_ledger_payments_to_activity_ins AFTER INSERT ON public.jobs_ledger_payments
  FOR EACH ROW EXECUTE FUNCTION public.jobs_ledger_payments_to_activity();
