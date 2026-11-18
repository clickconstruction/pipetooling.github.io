SET lock_timeout = '3s';

-- Put a trip on a bill (punch list #391, PR 2): the ground. An Extra trip becomes one line among a job's lines.
--
-- A trip marked Extra is work past the job's price, and nothing took it to a bill. The owner picked a line on the
-- job over a bill of its own: every dollar asked of a customer stays a line, and the Bill tab's Bill the N picked
-- already bills one line by itself. This file is the whole of the ground, and no client names any of it yet:
--
--   1. jobs_ledger_fixtures.trip_id: the trip a line came from. The mark lives on the line, never on the trip.
--      ON DELETE SET NULL, so a deleted trip leaves the line with its words, and a deleted line leaves nothing
--      behind: the trip reads not billed again by itself. A unique index where it is set: one trip, one line.
--   2. trip_put_on_job_line: the one checked function that writes the line, shaped like apply_job_discount.
--
-- The locks. jobs_ledger_fixtures is read by every Job window and written by every billing save, so:
--   * the column is nullable with no default, a catalog change that rewrites no row;
--   * the foreign key is added NOT VALID and validated after, as 20261117113000 did on message_attachments, so the
--     wait for the table is the column's own and the check of the rows asks for the lighter lock. Every row's value
--     is null today, so the check reads the column and finds nothing to look up;
--   * the unique index is partial and no row is in it yet.
-- lock_timeout makes the push fail fast and be tried again in a quieter moment instead of queueing the crews.
--
-- What it does not do: a trip still changes no clock row, bill or cost. The function writes one line, the job's
-- total and one History row. Nothing is billed until a bill takes the line.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, a constraint added only when it is missing, CREATE INDEX IF NOT EXISTS,
-- CREATE OR REPLACE. No table is created, so no fence is owed; the function refuses a training account, a digital
-- twin and an archived caller itself, because a definer stands behind the tables' fences.

-- 1. The mark on the line.
ALTER TABLE public.jobs_ledger_fixtures ADD COLUMN IF NOT EXISTS trip_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_ledger_fixtures_trip_id_fkey' AND conrelid = 'public.jobs_ledger_fixtures'::regclass
  ) THEN
    ALTER TABLE public.jobs_ledger_fixtures
      ADD CONSTRAINT jobs_ledger_fixtures_trip_id_fkey
      FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE SET NULL NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.jobs_ledger_fixtures VALIDATE CONSTRAINT jobs_ledger_fixtures_trip_id_fkey;

COMMENT ON COLUMN public.jobs_ledger_fixtures.trip_id IS
  'The trip this line came from (punch list #391): written by trip_put_on_job_line when an Extra trip is put on a bill, and by nothing else. One trip, one line. The mark lives here and not on the trip: delete the line and the trip reads not billed again, delete the trip and the line stays with its words. Null on every other line.';

-- One trip, one line. It is also the index the foreign key reads when a trip is deleted.
CREATE UNIQUE INDEX IF NOT EXISTS jobs_ledger_fixtures_one_line_a_trip
  ON public.jobs_ledger_fixtures (trip_id) WHERE trip_id IS NOT NULL;

-- 2. The press. Modelled on apply_job_discount (its newest body is in 20261010023000): the office roles, the caller
-- reads the job, the next position, one line, the total written again from the lines and the riders, one History row.
CREATE OR REPLACE FUNCTION public.trip_put_on_job_line(
  p_trip_id uuid,
  p_job_id uuid,
  p_amount numeric,
  p_name text,
  p_words text,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_amount numeric := round(COALESCE(p_amount, 0)::numeric, 2);
  v_name text := left(btrim(COALESCE(p_name, '')), 200);
  v_words text := NULLIF(left(btrim(COALESCE(p_words, '')), 2000), '');
  v_trip_found boolean := false;
  v_billing text;
  v_trip_dev uuid;
  v_trip_job uuid;
  v_trip_number integer;
  v_job_found boolean := false;
  v_job_dev uuid;
  v_line uuid;
  v_line_job uuid;
  v_line_total numeric;
  v_linked boolean;
  v_seq integer;
  v_before numeric;
  v_after numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  -- A definer stands behind the tables' fences, so it holds them itself, as trip_phone does.
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'Training mode is read-only. No line was added.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin puts no trip on a bill.' USING ERRCODE = '42501';
  END IF;
  -- The roles that may add a discount to a job (apply_job_discount).
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_uid
      AND u.role = ANY (ARRAY['dev', 'master_technician', 'assistant', 'controller']::user_role[])
  ) THEN
    RAISE EXCEPTION 'Putting a trip on a bill is for the office.' USING ERRCODE = '42501';
  END IF;
  IF p_trip_id IS NULL OR p_job_id IS NULL THEN
    RAISE EXCEPTION 'A trip''s line needs the trip and the job.' USING ERRCODE = '22023';
  END IF;
  -- The caller reads the trip, and reads the job as apply_job_discount asks.
  IF NOT (public.trips_office() OR public.trip_is_mine(p_trip_id)) THEN
    RAISE EXCEPTION 'That trip is not one you can read.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_read_job_activity(p_job_id, false) THEN
    RAISE EXCEPTION 'That job is not one you can read.' USING ERRCODE = '42501';
  END IF;

  -- The trip row first, then the job row: two presses on one trip wait for each other here.
  SELECT true, t.billing, t.development_id, t.job_id, t.trip_number
    INTO v_trip_found, v_billing, v_trip_dev, v_trip_job, v_trip_number
  FROM public.trips t WHERE t.id = p_trip_id FOR UPDATE;
  IF NOT COALESCE(v_trip_found, false) THEN
    RAISE EXCEPTION 'That trip is not here any more.' USING ERRCODE = 'P0002';
  END IF;

  -- One trip, one line. A second press is answered with the line it already holds, and writes nothing.
  SELECT f.id, f.job_id INTO v_line, v_line_job FROM public.jobs_ledger_fixtures f WHERE f.trip_id = p_trip_id;
  IF v_line IS NOT NULL THEN
    SELECT COALESCE(j.revenue, 0) INTO v_line_total FROM public.jobs_ledger j WHERE j.id = v_line_job;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'dry_run', p_dry_run, 'fixture_id', v_line,
      'job_id', v_line_job, 'revenue_before', v_line_total, 'revenue_after', v_line_total);
  END IF;

  IF v_billing IS DISTINCT FROM 'extra' THEN
    RAISE EXCEPTION 'Only a trip marked Extra goes on a bill. Change the trip''s billing to Extra first.' USING ERRCODE = '22023';
  END IF;

  SELECT true, j.development_id, COALESCE(j.revenue, 0) INTO v_job_found, v_job_dev, v_before
  FROM public.jobs_ledger j WHERE j.id = p_job_id FOR UPDATE;
  IF NOT COALESCE(v_job_found, false) THEN
    RAISE EXCEPTION 'That job is not here any more.' USING ERRCODE = 'P0002';
  END IF;

  -- The job is one of the trip's jobs, the job that holds the trip, or a job of the trip's site.
  v_linked := EXISTS (SELECT 1 FROM public.trip_jobs tj WHERE tj.trip_id = p_trip_id AND tj.job_id = p_job_id);
  IF NOT (v_linked OR COALESCE(v_trip_job = p_job_id, false) OR COALESCE(v_job_dev = v_trip_dev, false)) THEN
    RAISE EXCEPTION 'That job is not one of the trip''s jobs or a job of its site.' USING ERRCODE = '22023';
  END IF;

  -- A job whose total is not its lines: the GC desk's billing job is kept at the contract and the interest billed
  -- (gc_owner_billing_revenue). apply_job_discount has no answer for it, so this refuses instead of writing that
  -- total from the lines.
  IF EXISTS (SELECT 1 FROM public.gc_projects g WHERE g.billing_job_id = p_job_id) THEN
    RAISE EXCEPTION 'This job is billed from Owner Billing on the GC desk. A trip''s line cannot go on its lines.' USING ERRCODE = '22023';
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'A trip''s line needs an amount.' USING ERRCODE = '22023';
  END IF;
  IF v_amount > 1000000 THEN
    RAISE EXCEPTION 'That amount is over $1,000,000. Check it.' USING ERRCODE = '22023';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'A trip''s line needs a name.' USING ERRCODE = '22023';
  END IF;

  -- The total after: named rows' count x price (discount rows are negative) plus the riders (job_rider_fees), the
  -- same sum apply_job_discount writes, with the new line in it. Written whole, never raised by a delta.
  SELECT round(
           COALESCE((
             SELECT sum((CASE WHEN COALESCE(f.count, 0) > 0 THEN f.count ELSE 1 END) * COALESCE(f.line_unit_price, 0))
             FROM public.jobs_ledger_fixtures f
             WHERE f.job_id = p_job_id AND COALESCE(btrim(f.name), '') <> ''
           ), 0)
           + v_amount
           + public.job_rider_fees(p_job_id)
         , 2)
  INTO v_after;

  IF p_dry_run THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', false, 'dry_run', true, 'fixture_id', NULL,
      'job_id', p_job_id, 'revenue_before', v_before, 'revenue_after', v_after);
  END IF;

  -- The highest position plus one: no discount's basis names it and no line moves.
  SELECT COALESCE(max(sequence_order), -1) + 1 INTO v_seq
  FROM public.jobs_ledger_fixtures WHERE job_id = p_job_id;

  INSERT INTO public.jobs_ledger_fixtures
    (job_id, name, count, sequence_order, line_unit_price, line_description, invoice_id, line_kind, trip_id)
  VALUES
    (p_job_id, v_name, 1, v_seq, v_amount, v_words, NULL, 'work', p_trip_id)
  RETURNING id INTO v_line;

  UPDATE public.jobs_ledger SET revenue = v_after, updated_at = now() WHERE id = p_job_id;

  -- The picked job joins the trip's jobs when it was not one.
  INSERT INTO public.trip_jobs (trip_id, job_id) VALUES (p_trip_id, p_job_id) ON CONFLICT DO NOTHING;

  INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  VALUES (
    p_job_id, 'trip_line_added', now(), v_uid,
    left('Trip' || COALESCE(' ' || v_trip_number::text, '') || ' put on the job''s lines: ' || v_name, 500),
    jsonb_build_object('trip_id', p_trip_id, 'trip_number', v_trip_number, 'fixture_id', v_line, 'dollars', v_amount, 'source', 'trip'),
    true
  );

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'dry_run', false, 'fixture_id', v_line,
    'job_id', p_job_id, 'revenue_before', v_before, 'revenue_after', v_after);
END
$fn$;

COMMENT ON FUNCTION public.trip_put_on_job_line(uuid, uuid, numeric, text, text, boolean) IS
  'Put a trip on a bill (punch list #391): an Extra trip becomes one work line on a job, with trip_id set, at the next position. For the roles that may add a discount to a job (dev, master_technician, assistant, controller) who read the trip and the job. The job is one of the trip''s jobs, the job that holds the trip, or a job of its site, and it joins the trip''s jobs. Writes the job''s total again from its lines and riders, and one History row. A trip that already holds a line is answered with that line and duplicate true, and nothing is written. A dry run writes nothing and answers the same total before and after. It bills nothing: a bill takes the line later. Refuses a training account, a digital twin and an archived caller itself.';

REVOKE EXECUTE ON FUNCTION public.trip_put_on_job_line(uuid, uuid, numeric, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_put_on_job_line(uuid, uuid, numeric, text, text, boolean) TO authenticated, service_role;
