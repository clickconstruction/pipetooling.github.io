-- What a sub answers from their page is kept on the thing itself (migration *_sub_paper_ack_targets, punch list #371):
-- an answer names its person and its sheet, sending or payment, with no paper in the register; a payment is marked
-- received once; a note that something is wrong can be sent again; an answer outlives the row it was about; only the
-- service key writes, the office reads, and nobody else reads. Fixtures are written as postgres; everything rolls
-- back. Raises on the first failed assertion; ends with "sub_paper_ack_targets PASSED". See
-- scripts/pgtest-sub-papers.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Devon is a dev, the office. Priya estimates and is not office staff. Pat Sub is the sheet's one person. Every name
-- and figure is made up.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000371a0a1', 'devon@subacks.test'),
  ('00000000-0000-0000-0000-00000371a0a2', 'priya@subacks.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at) VALUES
  ('00000000-0000-0000-0000-00000371a0a1', 'devon@subacks.test', 'Devon Dev', 'dev', false, false, false, NULL),
  ('00000000-0000-0000-0000-00000371a0a2', 'priya@subacks.test', 'Priya Estimator', 'estimator', false, false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at;
INSERT INTO public.people (id, master_user_id, kind, name) VALUES
  ('00000000-0000-0000-0000-00000371a0e1', '00000000-0000-0000-0000-00000371a0a1', 'sub', 'Pat Sub Ackbed');
INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name, job_number) VALUES
  ('00000000-0000-0000-0000-00000371a0b1', '00000000-0000-0000-0000-00000371a0a1', 'Pat Sub Ackbed', '2041');
-- One sending with a payment on it, and a payment recorded before sendings.
INSERT INTO public.sub_payment_sendings (id, person_id) VALUES
  ('00000000-0000-0000-0000-00000371a0d1', '00000000-0000-0000-0000-00000371a0e1');
INSERT INTO public.people_labor_job_payments (id, job_id, amount, sequence_order, payment_date, method, sending_id) VALUES
  ('00000000-0000-0000-0000-00000371a0c1', '00000000-0000-0000-0000-00000371a0b1', 100, 0, '2026-10-01', 'check', '00000000-0000-0000-0000-00000371a0d1'),
  ('00000000-0000-0000-0000-00000371a0c2', '00000000-0000-0000-0000-00000371a0b1', 40, 1, '2026-09-01', 'check', NULL);

CREATE SCHEMA sab;
CREATE FUNCTION sab.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sab.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION sab.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
GRANT USAGE ON SCHEMA sab TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sab TO authenticated, anon;

-- 1 · The columns are there, and an answer needs no paper.
SELECT sab.same('an answer names its person, sheet, sending or payment',
  (SELECT string_agg(column_name || ':' || is_nullable, ',' ORDER BY column_name) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'sub_paper_acks' AND column_name IN ('paper_id', 'revision', 'person_id', 'labor_job_id', 'sending_id', 'payment_id')),
  'labor_job_id:YES,paper_id:YES,payment_id:YES,person_id:YES,revision:YES,sending_id:YES');

-- 2 · The sub-portal function writes with the service key. Got it on a sending the office has not papered.
SET LOCAL ROLE service_role;
INSERT INTO public.sub_paper_acks (kind, person_id, sending_id, amount, said_by_name)
  VALUES ('received', '00000000-0000-0000-0000-00000371a0e1', '00000000-0000-0000-0000-00000371a0d1', 100, 'Pat Sub Ackbed');
SELECT sab.refused('a second Got it on the same sending',
  $q$INSERT INTO public.sub_paper_acks (kind, person_id, sending_id, amount) VALUES ('received', '00000000-0000-0000-0000-00000371a0e1', '00000000-0000-0000-0000-00000371a0d1', 100)$q$,
  'sub_paper_acks_received_sending_key');
-- A payment from before sendings is marked by its own row, once.
INSERT INTO public.sub_paper_acks (kind, person_id, payment_id, amount)
  VALUES ('received', '00000000-0000-0000-0000-00000371a0e1', '00000000-0000-0000-0000-00000371a0c2', 40);
SELECT sab.refused('a second Got it on the same lone payment',
  $q$INSERT INTO public.sub_paper_acks (kind, person_id, payment_id, amount) VALUES ('received', '00000000-0000-0000-0000-00000371a0e1', '00000000-0000-0000-0000-00000371a0c2', 40)$q$,
  'sub_paper_acks_received_payment_key');
-- A note that something is wrong can be sent again, on the same sheet and on a payment already marked received.
INSERT INTO public.sub_paper_acks (kind, person_id, labor_job_id, amount, note) VALUES
  ('something_wrong', '00000000-0000-0000-0000-00000371a0e1', '00000000-0000-0000-0000-00000371a0b1', 60, 'The back-charge was never talked about with me.'),
  ('something_wrong', '00000000-0000-0000-0000-00000371a0e1', '00000000-0000-0000-0000-00000371a0b1', 60, 'Still waiting on an answer.');
INSERT INTO public.sub_paper_acks (kind, person_id, sending_id, amount, note)
  VALUES ('something_wrong', '00000000-0000-0000-0000-00000371a0e1', '00000000-0000-0000-0000-00000371a0d1', 100, 'The check was short.');
RESET ROLE;
SELECT sab.same('five answers are kept, none on a paper',
  (SELECT concat_ws('|', count(*), count(paper_id), count(*) FILTER (WHERE kind = 'received')) FROM public.sub_paper_acks WHERE person_id = '00000000-0000-0000-0000-00000371a0e1'), '5|0|2');

-- 3 · An answer outlives the row it was about: the payment goes, the answer stays and still names its person.
DELETE FROM public.people_labor_job_payments WHERE id = '00000000-0000-0000-0000-00000371a0c2';
SELECT sab.same('the lone payment''s answer stays, with no payment',
  (SELECT concat_ws('|', count(*), count(payment_id)) FROM public.sub_paper_acks WHERE person_id = '00000000-0000-0000-0000-00000371a0e1' AND kind = 'received' AND sending_id IS NULL), '1|0');

-- 4 · Who reads and who writes. The office reads. Nobody signed in types an answer. An estimator reads nothing.
SELECT sab.as_user('00000000-0000-0000-0000-00000371a0a1');
SET LOCAL ROLE authenticated;
SELECT sab.same('Devon reads the answers', (SELECT count(*)::text FROM public.sub_paper_acks WHERE person_id = '00000000-0000-0000-0000-00000371a0e1'), '5');
SELECT sab.refused('Devon typing what a sub said back',
  $q$INSERT INTO public.sub_paper_acks (kind, person_id, sending_id) VALUES ('received', '00000000-0000-0000-0000-00000371a0e1', '00000000-0000-0000-0000-00000371a0d1')$q$, 'permission denied');
SELECT sab.refused('Devon changing what a sub said back', $q$UPDATE public.sub_paper_acks SET note = 'changed'$q$, 'permission denied');
RESET ROLE;
SELECT sab.as_user('00000000-0000-0000-0000-00000371a0a2');
SET LOCAL ROLE authenticated;
SELECT sab.same('Priya reads nothing', (SELECT count(*)::text FROM public.sub_paper_acks), '0');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'sub_paper_ack_targets PASSED'; END $$;
ROLLBACK;
