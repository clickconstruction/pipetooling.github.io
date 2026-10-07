-- The call-again date on a bid (v2.4419): said in the contact log, rolled up onto the bid. Runs as
-- an estimator through RLS, inside one transaction that rolls back. Raises on the first failed
-- assertion; ends with "bid_next_followup PASSED". See scripts/pgtest-bid-next-followup.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000f0e1', 'est@followup.test'), ('00000000-0000-0000-0000-00000000f0e2', 'primary@followup.test'),
  ('00000000-0000-0000-0000-00000000f0e3', 'master@followup.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-00000000f0e1', 'est@followup.test', 'Followup Estimator', 'estimator'),
  ('00000000-0000-0000-0000-00000000f0e2', 'primary@followup.test', 'Followup Primary', 'primary'),
  ('00000000-0000-0000-0000-00000000f0e3', 'master@followup.test', 'Followup Master', 'master_technician')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000000f0a1', 'Followup Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-00000000f0c1', '00000000-0000-0000-0000-00000000f0e3', 'City of Riverton');
INSERT INTO public.customer_contact_persons (id, customer_id, name, phone) VALUES
  ('00000000-0000-0000-0000-00000000f0b1', '00000000-0000-0000-0000-00000000f0c1', 'J. Rayburn', '(830) 555-0142');
INSERT INTO public.bids (id, created_by, service_type_id, project_name, customer_id, bid_date_sent) VALUES
  ('00000000-0000-0000-0000-00000000f0d1', '00000000-0000-0000-0000-00000000f0e1', '00000000-0000-0000-0000-00000000f0a1', 'Followup: city re-pipe', '00000000-0000-0000-0000-00000000f0c1', '2026-02-11'),
  ('00000000-0000-0000-0000-00000000f0d2', '00000000-0000-0000-0000-00000000f0e1', '00000000-0000-0000-0000-00000000f0a1', 'Followup: another bid', '00000000-0000-0000-0000-00000000f0c1', '2026-03-01');

CREATE SCHEMA fut;
-- A bid's roll-up as text: the date, who, why, and the note of the entry it came from.
CREATE FUNCTION fut.state(p_bid uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(b.next_followup_on::text, 'no date') || ' | ' || COALESCE(p.name, 'no person') || ' | ' || COALESCE(b.next_followup_reason, 'no reason') || ' | ' || COALESCE(e.notes, 'no entry')
    FROM public.bids b
    LEFT JOIN public.customer_contact_persons p ON p.id = b.next_followup_contact_person_id
    LEFT JOIN public.bids_submission_entries e ON e.id = b.next_followup_entry_id
   WHERE b.id = p_bid $$;
CREATE FUNCTION fut.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement that must be refused; `want` is a piece of the error.
CREATE FUNCTION fut.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
GRANT USAGE ON SCHEMA fut TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA fut TO authenticated;

SELECT fut.same('the trigger function is nobody''s RPC',
  has_function_privilege('anon', 'public.sync_next_followup_from_entries()', 'EXECUTE')::text || ' ' || has_function_privilege('authenticated', 'public.sync_next_followup_from_entries()', 'EXECUTE')::text,
  'false false');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f0e1","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f0e1', true);
SET LOCAL ROLE authenticated;

SELECT fut.same('a bid starts with no date', fut.state('00000000-0000-0000-0000-00000000f0d1'), 'no date | no person | no reason | no entry');

INSERT INTO public.bids_submission_entries (id, bid_id, contact_method, notes, occurred_at) VALUES
  ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f0d1', 'Phone', 'Left a message', '2026-09-29 15:00+00');
SELECT fut.same('a contact with no date leaves the bid with none', fut.state('00000000-0000-0000-0000-00000000f0d1'), 'no date | no person | no reason | no entry');
SELECT fut.same('and still counts as the last contact', (SELECT last_contact::text FROM public.bids WHERE id = '00000000-0000-0000-0000-00000000f0d1'), '2026-09-29 15:00:00+00');

INSERT INTO public.bids_submission_entries (id, bid_id, contact_method, notes, occurred_at, next_followup_on, next_followup_contact_person_id, next_followup_reason) VALUES
  ('00000000-0000-0000-0000-00000000f102', '00000000-0000-0000-0000-00000000f0d1', 'Phone', 'Holding for the next budget year', '2026-09-30 15:00+00', '2027-01-05', '00000000-0000-0000-0000-00000000f0b1', 'budget');
SELECT fut.same('a contact that names a day sets it, with who and why', fut.state('00000000-0000-0000-0000-00000000f0d1'), '2027-01-05 | J. Rayburn | budget | Holding for the next budget year');

INSERT INTO public.bids_submission_entries (id, bid_id, contact_method, notes, occurred_at) VALUES
  ('00000000-0000-0000-0000-00000000f103', '00000000-0000-0000-0000-00000000f0d1', 'Email', 'Sent them the revised letter', '2026-10-01 15:00+00');
SELECT fut.same('a later contact that says nothing about a day keeps January', fut.state('00000000-0000-0000-0000-00000000f0d1'), '2027-01-05 | J. Rayburn | budget | Holding for the next budget year');
SELECT fut.same('while the last contact moves on', (SELECT last_contact::text FROM public.bids WHERE id = '00000000-0000-0000-0000-00000000f0d1'), '2026-10-01 15:00:00+00');

INSERT INTO public.bids_submission_entries (id, bid_id, contact_method, notes, occurred_at, next_followup_on) VALUES
  ('00000000-0000-0000-0000-00000000f104', '00000000-0000-0000-0000-00000000f0d1', 'Phone', 'An older call, typed in late', '2026-09-20 15:00+00', '2026-11-01');
SELECT fut.same('an older entry typed in late does not win', fut.state('00000000-0000-0000-0000-00000000f0d1'), '2027-01-05 | J. Rayburn | budget | Holding for the next budget year');

INSERT INTO public.bids_submission_entries (id, bid_id, contact_method, notes, occurred_at, next_followup_on) VALUES
  ('00000000-0000-0000-0000-00000000f105', '00000000-0000-0000-0000-00000000f0d1', NULL, 'Date moved: council meets in February', '2026-10-02 15:00+00', '2027-02-01');
SELECT fut.same('a note with no contact can move the day', fut.state('00000000-0000-0000-0000-00000000f0d1'), '2027-02-01 | no person | no reason | Date moved: council meets in February');
SELECT fut.same('and is not a contact', (SELECT last_contact::text FROM public.bids WHERE id = '00000000-0000-0000-0000-00000000f0d1'), '2026-10-01 15:00:00+00');

INSERT INTO public.bids_submission_entries (id, bid_id, contact_method, notes, occurred_at, next_followup_cleared) VALUES
  ('00000000-0000-0000-0000-00000000f106', '00000000-0000-0000-0000-00000000f0d1', NULL, 'Date removed', '2026-10-02 16:00+00', true);
SELECT fut.same('an entry can remove the day', fut.state('00000000-0000-0000-0000-00000000f0d1'), 'no date | no person | no reason | no entry');

DELETE FROM public.bids_submission_entries WHERE id = '00000000-0000-0000-0000-00000000f106';
SELECT fut.same('deleting that entry brings February back', fut.state('00000000-0000-0000-0000-00000000f0d1'), '2027-02-01 | no person | no reason | Date moved: council meets in February');
DELETE FROM public.bids_submission_entries WHERE id = '00000000-0000-0000-0000-00000000f105';
SELECT fut.same('deleting February falls back to January, with who and why', fut.state('00000000-0000-0000-0000-00000000f0d1'), '2027-01-05 | J. Rayburn | budget | Holding for the next budget year');

UPDATE public.bids_submission_entries SET next_followup_on = '2027-01-12' WHERE id = '00000000-0000-0000-0000-00000000f102';
SELECT fut.same('editing the entry''s day moves the bid''s', fut.state('00000000-0000-0000-0000-00000000f0d1'), '2027-01-12 | J. Rayburn | budget | Holding for the next budget year');

UPDATE public.bids_submission_entries SET bid_id = '00000000-0000-0000-0000-00000000f0d2' WHERE id = '00000000-0000-0000-0000-00000000f102';
SELECT fut.same('an entry moved to another bid takes its day along', fut.state('00000000-0000-0000-0000-00000000f0d2'), '2027-01-12 | J. Rayburn | budget | Holding for the next budget year');
SELECT fut.same('and the bid it left falls back to its next newest', fut.state('00000000-0000-0000-0000-00000000f0d1'), '2026-11-01 | no person | no reason | An older call, typed in late');

SELECT fut.refused('a made-up reason', $q$INSERT INTO public.bids_submission_entries (bid_id, notes, next_followup_on, next_followup_reason) VALUES ('00000000-0000-0000-0000-00000000f0d1', 'x', '2027-03-01', 'vacation')$q$, 'next_followup_reason_check');
SELECT fut.refused('a day and a removal in one entry', $q$INSERT INTO public.bids_submission_entries (bid_id, notes, next_followup_on, next_followup_cleared) VALUES ('00000000-0000-0000-0000-00000000f0d1', 'x', '2027-03-01', true)$q$, 'next_followup_shape_check');
SELECT fut.refused('who to ask for with no day', $q$INSERT INTO public.bids_submission_entries (bid_id, notes, next_followup_contact_person_id) VALUES ('00000000-0000-0000-0000-00000000f0d1', 'x', '00000000-0000-0000-0000-00000000f0b1')$q$, 'next_followup_shape_check');

DELETE FROM public.customer_contact_persons WHERE id = '00000000-0000-0000-0000-00000000f0b1';
SELECT fut.same('removing the person keeps the day and drops the name', fut.state('00000000-0000-0000-0000-00000000f0d2'), '2027-01-12 | no person | budget | Holding for the next budget year');

-- The reminder ledger (v2.4427): the office reads it; only the service role writes it.
SELECT fut.refused('an estimator writing the reminder ledger', $q$INSERT INTO public.bid_followup_reminders (bid_id, due_on) VALUES ('00000000-0000-0000-0000-00000000f0d2', '2027-01-12')$q$, 'permission denied');

-- A primary may not write this log at all, so cannot set a day.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000f0e2","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f0e2', true);
SELECT fut.refused('a primary setting a day', $q$INSERT INTO public.bids_submission_entries (bid_id, notes, next_followup_on) VALUES ('00000000-0000-0000-0000-00000000f0d1', 'x', '2027-03-01')$q$, 'row-level security');

RESET ROLE;
SELECT fut.same('the hourly reminder job is scheduled once', (SELECT count(*)::text || ' ' || min(schedule) FROM cron.job WHERE jobname = 'bid-followup-reminders'), '1 8 * * * *');
INSERT INTO public.bid_followup_reminders (bid_id, due_on, recipient_user_id) VALUES ('00000000-0000-0000-0000-00000000f0d2', '2027-01-12', '00000000-0000-0000-0000-00000000f0e1');
SELECT fut.refused('a second reminder for the same bid and day', $q$INSERT INTO public.bid_followup_reminders (bid_id, due_on) VALUES ('00000000-0000-0000-0000-00000000f0d2', '2027-01-12')$q$, 'bid_followup_reminders_bid_day_uniq');
INSERT INTO public.bid_followup_reminders (bid_id, due_on) VALUES ('00000000-0000-0000-0000-00000000f0d2', '2027-02-01');
SELECT fut.same('a day moved later may remind again', (SELECT count(*)::text FROM public.bid_followup_reminders WHERE bid_id = '00000000-0000-0000-0000-00000000f0d2'), '2');

-- The bid points at its entry and the entry at its bid. Deleting the bid must still go through.
DELETE FROM public.bids WHERE id = '00000000-0000-0000-0000-00000000f0d2';
SELECT fut.same('a bid with a day deletes cleanly: entries, reminders and all',
  (SELECT count(*)::text FROM public.bids WHERE id = '00000000-0000-0000-0000-00000000f0d2') || ' ' || (SELECT count(*)::text FROM public.bids_submission_entries WHERE bid_id = '00000000-0000-0000-0000-00000000f0d2') || ' ' || (SELECT count(*)::text FROM public.bid_followup_reminders WHERE bid_id = '00000000-0000-0000-0000-00000000f0d2'),
  '0 0 0');
SELECT 'bid_next_followup PASSED' AS result;
ROLLBACK;
