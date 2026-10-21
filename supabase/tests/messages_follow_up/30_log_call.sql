-- Punch list #140 PR 7 (migration *_log_call): the reply box's Call kind. `log_call` refuses no sign-in, a training
-- account, a digital twin and anyone off the office team in words, empty words, and a day given twice; for the office it
-- writes the call as our line named by first name (a title skipped, a bare number kept whole), which moves the
-- conversation to done and lets go of whoever had it; the day they gave lands as a written promise of kind 'said', as a
-- date or as words; their open calls to make close on the call's line; the line takes its job. The fixture is made as
-- postgres; each press runs as its user through RLS; everything rolls back. Raises on the first failed assertion; ends
-- with "messages_log_call PASSED". See scripts/pgtest-messages-follow-up.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Rosa (assistant) and Robert (estimator) are the office; Wendi is a superintendent outside it; a trainee and a twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@logcall.test'),
  ('00000000-0000-0000-0000-0000000009d3', 'rosa@logcall.test'),
  ('00000000-0000-0000-0000-0000000009d2', 'robert@logcall.test'),
  ('00000000-0000-0000-0000-0000000009d4', 'wendi@logcall.test'),
  ('00000000-0000-0000-0000-0000000009d6', 'training@logcall.test'),
  ('00000000-0000-0000-0000-0000000009d7', 'twin@logcall.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@logcall.test', 'Log Dev', 'dev', false, false, NULL),
  ('00000000-0000-0000-0000-0000000009d3', 'rosa@logcall.test', 'Rosa', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-0000000009d2', 'robert@logcall.test', 'Robert', 'estimator', false, false, NULL),
  ('00000000-0000-0000-0000-0000000009d4', 'wendi@logcall.test', 'Wendi', 'superintendent', false, false, NULL),
  ('00000000-0000-0000-0000-0000000009d6', 'training@logcall.test', 'Trainee', 'estimator', true, false, NULL),
  ('00000000-0000-0000-0000-0000000009d7', 'twin@logcall.test', 'Twin', 'assistant', false, true, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at;

-- A customer and the person at it (a title before her name), a GC project, and a number nobody has named.
INSERT INTO public.customers (id, name, master_user_id, contact_info) VALUES
  ('00000000-0000-0000-0000-0000000009c1', 'Log Call Dental', '00000000-0000-0000-0000-0000000009d1', NULL);
INSERT INTO public.customer_contact_persons (id, customer_id, name, phone, email) VALUES
  ('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009c1', 'Dr. Priya Raman', '(210) 555-0144', 'priya@logcall.example');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000009f1', 'Log Call Clinic', '00000000-0000-0000-0000-0000000009c1');
INSERT INTO public.gc_projects (project_id, stage) VALUES
  ('00000000-0000-0000-0000-0000000009f1', 'buyout');
INSERT INTO public.contacts (id, kind, customer_contact_person_id) VALUES
  ('00000000-0000-0000-0000-000000009101', 'customer', '00000000-0000-0000-0000-0000000009e1');
INSERT INTO public.contacts (id, kind) VALUES ('00000000-0000-0000-0000-000000009102', 'unknown');
INSERT INTO public.contact_channels (contact_id, kind, value) VALUES
  ('00000000-0000-0000-0000-000000009101', 'phone', '(210) 555-0144'),
  ('00000000-0000-0000-0000-000000009102', 'phone', '(830) 555-0172');

CREATE SCHEMA mlc;
CREATE FUNCTION mlc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION mlc.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION mlc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION mlc.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- A conversation as Follow up reads it: the state, who has it.
CREATE FUNCTION mlc.state(p_contact uuid) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', state, CASE WHEN has_user_id IS NULL THEN '-' ELSE public.follow_up_user_name(has_user_id) END, coalesce(has_how, '-'))
  FROM public.contacts WHERE id = p_contact
$$;
-- A call line as the thread keeps it.
CREATE FUNCTION mlc.line(p_id uuid) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', channel, direction, who_text, body, coalesce(project_id::text, '-')) FROM public.messages WHERE id = p_id
$$;
-- The promise on a line.
CREATE FUNCTION mlc.promise(p_id uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((SELECT concat_ws('|', kind, state, coalesce(day::text, '-'), coalesce(day_words, '-'), public.follow_up_user_name(decided_by))
    FROM public.message_promises WHERE message_id = p_id), 'none')
$$;

GRANT USAGE ON SCHEMA mlc TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mlc TO authenticated, service_role;

CREATE TEMP TABLE ids AS SELECT
  '00000000-0000-0000-0000-000000009101'::uuid AS priya,
  '00000000-0000-0000-0000-000000009102'::uuid AS dee,
  '00000000-0000-0000-0000-0000000009d3'::uuid AS rosa,
  '00000000-0000-0000-0000-0000000009f1'::uuid AS clinic;
GRANT SELECT ON ids TO authenticated, service_role;

-- Priya texted and Rosa took it; a call to make stands for her.
INSERT INTO public.messages (contact_id, channel, direction, at, body)
  SELECT priya, 'text', 'in', now() - interval '2 hours', 'Can you do it Thursday?' FROM ids;
INSERT INTO public.call_tasks (contact_id, due_on, what, made_by) SELECT priya, current_date, 'about the estimate', rosa FROM ids;
SET ROLE authenticated;
SELECT mlc.as_user('00000000-0000-0000-0000-0000000009d3');
SELECT public.take_it(priya) FROM ids;
SELECT mlc.same('Priya waits on us and Rosa has it', (SELECT mlc.state(priya) FROM ids), 'waiting|Rosa|took');

-- 1 · Who may log a call, in words.
SELECT mlc.signed_out();
SELECT mlc.refused('no sign-in', $q$SELECT public.log_call(priya, 'Thursday works') FROM ids$q$, 'Sign in to log a call.');
SELECT mlc.as_user('00000000-0000-0000-0000-0000000009d6');
SELECT mlc.refused('a training account', $q$SELECT public.log_call(priya, 'Thursday works') FROM ids$q$, 'A training account cannot log a call.');
SELECT mlc.as_user('00000000-0000-0000-0000-0000000009d7');
SELECT mlc.refused('a digital twin', $q$SELECT public.log_call(priya, 'Thursday works') FROM ids$q$, 'A digital twin cannot log a call.');
SELECT mlc.as_user('00000000-0000-0000-0000-0000000009d4');
SELECT mlc.refused('a superintendent', $q$SELECT public.log_call(priya, 'Thursday works') FROM ids$q$, 'Only the office team can log a call.');
SELECT mlc.as_user('00000000-0000-0000-0000-0000000009d3');
SELECT mlc.refused('the call has words', $q$SELECT public.log_call(priya, '   ') FROM ids$q$, 'Write what they said first.');
SELECT mlc.refused('a day is a date or words, once', $q$SELECT public.log_call(priya, 'x', current_date, 'Friday') FROM ids$q$, 'A day is a date or the words typed, not both.');
SELECT mlc.refused('a conversation that is not there', $q$SELECT public.log_call('00000000-0000-0000-0000-000000009999', 'x')$q$, 'That conversation is not there.');
SELECT mlc.same('nothing was written by a refusal', (SELECT count(*)::text FROM public.messages m JOIN ids ON m.contact_id = ids.priya WHERE m.channel = 'call'), '0');

-- 2 · Rosa logs the call with the day Priya gave: our call line, named by first name, on the project; the conversation
-- is done and nobody has it; the day is a written promise; the call to make closed on the line.
-- Temp tables are postgres's; as a signed-in user the ids ride session settings.
SELECT set_config('mlc.made', (SELECT public.log_call(priya, 'Thursday works', current_date + 2, NULL, 'project', clinic) FROM ids)::text, true);
SELECT mlc.same('the call is our line, by first name, on the job', mlc.line(current_setting('mlc.made')::uuid),
  (SELECT concat_ws('|', 'call', 'out', 'Rosa', 'Called Priya. They said: Thursday works', clinic::text) FROM ids));
SELECT mlc.same('the conversation is done and nobody has it', (SELECT mlc.state(priya) FROM ids), 'done|-|-');
SELECT mlc.same('the day they gave is a written promise', mlc.promise(current_setting('mlc.made')::uuid), concat_ws('|', 'said', 'written', (current_date + 2)::text, '-', 'Rosa'));
SELECT mlc.same('the call to make closed on the line',
  (SELECT concat_ws('|', done_how, public.follow_up_user_name(done_by), (done_message_id = current_setting('mlc.made')::uuid)::text) FROM public.call_tasks ct JOIN ids ON ct.contact_id = ids.priya),
  'call|Rosa|true');
RESET ROLE;
SELECT mlc.same('the promise is a written one the move line reads', (SELECT count(*)::text FROM public.message_promises WHERE state = 'written' AND kind = 'said' AND day >= current_date), '1');
SET ROLE authenticated;
SELECT mlc.as_user('00000000-0000-0000-0000-0000000009d3');

-- 3 · A day in words stays as words, with no date; a number nobody has named is kept whole; no day, no promise.
SELECT set_config('mlc.made2', (SELECT public.log_call(dee, 'call me next week', NULL, 'next week') FROM ids)::text, true);
SELECT mlc.same('words for a day, a bare number kept whole', concat_ws('|', mlc.line(current_setting('mlc.made2')::uuid), mlc.promise(current_setting('mlc.made2')::uuid)),
  'call|out|Rosa|Called (830) 555-0172. They said: call me next week|-|said|written|-|next week|Rosa');
SELECT set_config('mlc.made3', (SELECT public.log_call(dee, 'no answer, left a message') FROM ids)::text, true);
SELECT mlc.same('no day, no promise', mlc.promise(current_setting('mlc.made3')::uuid), 'none');

-- 4 · An estimator is office team too, and reads the line back through RLS.
SELECT mlc.as_user('00000000-0000-0000-0000-0000000009d2');
SELECT set_config('mlc.made4', (SELECT public.log_call(priya, 'She will send the deposit Friday', NULL, 'Friday') FROM ids)::text, true);
SELECT mlc.same('an estimator logs a call and reads it', (SELECT count(*)::text FROM public.messages m WHERE m.id = current_setting('mlc.made4')::uuid), '1');

RESET ROLE;
DO $$ BEGIN RAISE NOTICE 'messages_log_call PASSED'; END $$;
ROLLBACK;
