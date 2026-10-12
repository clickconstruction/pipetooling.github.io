-- Messages, cut 4, the flow suite (migration *_messages_flows): the four flows read back step by step as SEED_FLOWS
-- draws them (src/lib/flows/seed.ts); a second seed adds nothing and brings back no step the office removed; a fold of
-- two contacts moves a person's notes, skips, holds and sends onto the one that stays; the presses write as the
-- caller and flow_rows reads days and marks for the office only; the
-- CHECKs refuse an unknown fact or paper, a loop that does not say when it ends, half a nudge and an unknown lane; only
-- the office team reads and writes; who undid a skip, let go of a hold, put a step back or sent a nudge is the table's
-- to stamp; training mode and a digital twin change nothing; and the four new facts' columns are there. Presses run as
-- each user through RLS; the fixture is made as postgres; everything rolls back. Raises on the first failed assertion;
-- ends with "messages_flows PASSED". See scripts/pgtest-messages-flows.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (a dev, an estimator), a superintendent outside it, an estimator in training mode and a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000006d1', 'dev@flows.test'),
  ('00000000-0000-0000-0000-0000000006d2', 'estimator@flows.test'),
  ('00000000-0000-0000-0000-0000000006d4', 'super@flows.test'),
  ('00000000-0000-0000-0000-0000000006d6', 'training@flows.test'),
  ('00000000-0000-0000-0000-0000000006d7', 'twin@flows.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000006d1', 'dev@flows.test', 'Flows Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000006d2', 'estimator@flows.test', 'Flows Estimator', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000006d4', 'super@flows.test', 'Flows Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000006d6', 'training@flows.test', 'Flows Training', 'estimator', true, false),
  ('00000000-0000-0000-0000-0000000006d7', 'twin@flows.test', 'Flows Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- A GC project and a number nobody has named, to hang a person's skip, hold, note and nudge on.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000000006c1', 'Flows Helotes Dental', '00000000-0000-0000-0000-0000000006d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000006f1', 'Flows Clinic', '00000000-0000-0000-0000-0000000006c1');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-0000000006f1', 'buyout');
INSERT INTO public.contacts (id, kind) VALUES
  ('00000000-0000-0000-0000-000000006001', 'unknown'),
  ('00000000-0000-0000-0000-000000006002', 'unknown'),
  ('00000000-0000-0000-0000-000000006003', 'unknown'),
  ('00000000-0000-0000-0000-000000006004', 'unknown');
INSERT INTO public.gc_companies (id, name, contact_name, phone, email, portal_opened_on, trades) VALUES
  ('00000000-0000-0000-0000-0000000006a1', 'Flows Hillside', 'Greg Paulk', '(210) 555-0113', 'greg@hillside.example', '2026-09-09', ARRAY['Sitework']);
INSERT INTO public.gc_trade_portal_links (company_id, token, first_opened_at) VALUES
  ('00000000-0000-0000-0000-0000000006a1', 'flows-link-token', '2026-09-08T23:30:00Z');
INSERT INTO public.contacts (id, kind, gc_company_id) VALUES ('00000000-0000-0000-0000-000000006005', 'trade', '00000000-0000-0000-0000-0000000006a1');
INSERT INTO public.contact_jobs (contact_id, project_id, is_default) VALUES ('00000000-0000-0000-0000-000000006005', '00000000-0000-0000-0000-0000000006f1', true);

CREATE SCHEMA mfl;
CREATE FUNCTION mfl.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION mfl.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION mfl.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- A flow's steps in the order the panel draws them: lane by lane, then by position.
CREATE FUNCTION mfl.order(p_kind text) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(s.lane || '.' || s.step_key, ' ' ORDER BY array_position(ARRAY['once', 'per_job', 'any_time'], s.lane), s.position)
  FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = p_kind
$$;
-- One step in one line: where it sits, whose it is, what finishes it, how it repeats, its nudge, its usual, its words.
CREATE FUNCTION mfl.step(p_kind text, p_key text) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', s.lane, s.position, s.phase, s.who, array_to_string(s.facts, ','), s.join_word, array_to_string(s.papers, ','),
    coalesce(s.loop_words, '-'), coalesce(s.loop_ends, '-'), s.fork::text, s.aside::text, s.skip_one_job::text,
    coalesce(s.nudge_days::text, '-'), coalesce(s.nudge_how, '-'), coalesce(s.nudge_send, '-'), coalesce(s.nudge_day_fact, '-'),
    s.usual, coalesce(s.owed_words, '-'), s.name, s.name_es, coalesce(s.later_en, '-'))
  FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = p_kind AND s.step_key = p_key
$$;
GRANT USAGE ON SCHEMA mfl TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mfl TO anon, authenticated;

-- 1 · The four flows, read back as SEED_FLOWS draws them (the migration ran the seed, and ran again in the bed).
SELECT mfl.same('four flows, one per kind',
  (SELECT string_agg(kind || ':' || name, ', ' ORDER BY kind COLLATE "C") FROM public.flows),
  'arch:Architect flow, customer:Customer flow, trade:Trade partner flow, unknown:The flow');
SELECT mfl.same('the customer flow: the master agreement alone in Once, change orders last and apart',
  mfl.order('customer'),
  'once.agreement per_job.asked per_job.bid per_job.yes per_job.contract per_job.start per_job.onsite per_job.payapp per_job.close per_job.warranty per_job.co');
SELECT mfl.same('the trade partner flow', mfl.order('trade'),
  'once.invited once.portal once.papers once.msa per_job.ask per_job.compare per_job.sow per_job.draws per_job.closeout');
SELECT mfl.same('the architect flow', mfl.order('arch'), 'per_job.plans per_job.questions per_job.addenda per_job.submittals per_job.certify');
SELECT mfl.same('the unknown number''s flow', mfl.order('unknown'), 'once.who');
SELECT mfl.same('an ask: a quote or their no, a loop that ends with its rounds, nudged at their promised day',
  mfl.step('trade', 'ask'),
  'per_job|0|pricing|them|quote_in,quote_declined|or|quote|each ask|rounds|false|false|false|7|text|ask|promised|6|-|Asked to quote|Cotización pedida|When a job of yours comes up.');
SELECT mfl.same('comparing: our fork, two ways out, our words when we owe it',
  mfl.step('trade', 'compare'),
  'per_job|1|pricing|us|carried,not_carried|or||-|-|true|false|false|-|-|-|-|2|our decision on their quote|Compared|Comparado|After your quote is in.');
SELECT mfl.same('papers: both facts, a call after five quiet days',
  mfl.step('trade', 'papers'),
  'once|2|setup|them|w9_signed,coi_current|and|w9,coi|-|-|false|false|false|5|call|ask|-|3|-|Papers in|Documentos recibidos|-');
SELECT mfl.same('the master agreement: skipped on one job',
  mfl.step('customer', 'agreement'),
  'once|0|setup|them|msa_signed|and|msa|-|-|false|false|true|5|call|ask|-|10|-|Master agreement|Acuerdo marco|Repeat customers only.');
SELECT mfl.same('pay applications: a loop that holds the chain until what follows, nudged at pay by',
  mfl.step('customer', 'payapp'),
  'per_job|6|building|both|payapp_paid|and|payapp|each month|next|false|false|false|5|text|ask|pay_by|21|-|Pay application|Solicitud de pago|Once a month, from the first month on site.');
SELECT mfl.same('change orders: aside, any time in the job',
  mfl.step('customer', 'co'),
  'per_job|9|building|them|co_answered|and|co|each change|rounds|false|true|false|3|text|ask|-|4|-|Change orders|Órdenes de cambio|Only when something changes.');
SELECT mfl.same('the warranty: our move, a year',
  mfl.step('customer', 'warranty'),
  'per_job|8|building|us|warranty_over|and||-|-|false|false|false|-|-|-|-|365|the warranty papers|Warranty|Garantía|A year from closeout.');
SELECT mfl.same('Who is this?', mfl.step('unknown', 'who'),
  'once|0|setup|us|named|and||-|-|false|false|false|-|-|-|-|0|-|Who is this?|¿Quién es?|-');
SELECT mfl.same('the seats are the office''s to set', (SELECT count(*) FROM public.flow_steps WHERE seat_user_id IS NOT NULL)::text, '0');

-- 2 · A second seed adds nothing, and a step the office removed stays removed.
SELECT mfl.same('a second seed adds nothing', public.flows_seed()::text, '0');
DELETE FROM public.flow_steps WHERE step_key = 'papers' AND flow_id = (SELECT id FROM public.flows WHERE kind = 'trade');
SELECT mfl.same('and brings back no removed step', concat_ws('|', public.flows_seed(), mfl.order('trade')),
  '0|once.invited once.portal once.msa per_job.ask per_job.compare per_job.sow per_job.draws per_job.closeout');

-- 3 · Who reads.
SET LOCAL ROLE anon;
SELECT mfl.refused('no sign-in reads no flow', $q$SELECT count(*) FROM public.flows$q$, 'permission denied for table flows');
SELECT mfl.refused('no sign-in reads no skip', $q$SELECT count(*) FROM public.contact_step_skips$q$, 'permission denied for table contact_step_skips');
RESET ROLE;
SELECT mfl.as_user('00000000-0000-0000-0000-0000000006d4');
SET LOCAL ROLE authenticated;
SELECT mfl.same('a superintendent outside the office reads nothing',
  concat_ws('|', (SELECT count(*) FROM public.flows), (SELECT count(*) FROM public.flow_steps)), '0|0');
RESET ROLE;

-- 4 · The office edits a step; the CHECKs hold the code lists and the shapes.
CREATE TEMP TABLE was AS SELECT updated_at FROM public.flow_steps WHERE step_key = 'portal';
GRANT SELECT ON was TO authenticated;
-- What the presses returned, to read back.
CREATE TEMP TABLE pressed (what text, id uuid);
GRANT ALL ON pressed TO authenticated;
SELECT mfl.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT mfl.same('the office reads every flow and step',
  concat_ws('|', (SELECT count(*) FROM public.flows), (SELECT count(*) FROM public.flow_steps)), '4|25');
UPDATE public.flow_steps SET nudge_days = 4 WHERE step_key = 'portal';
SELECT mfl.same('an edit lands and its clock moves',
  (SELECT concat_ws('|', s.nudge_days, (s.updated_at > w.updated_at)::text) FROM public.flow_steps s, was w WHERE s.step_key = 'portal'), '4|true');
SELECT mfl.refused('a fact that is not in the code list', $q$UPDATE public.flow_steps SET facts = ARRAY['typed_done'] WHERE step_key = 'portal'$q$, 'flow_steps_facts_known');
SELECT mfl.refused('a paper that is not in the code list', $q$UPDATE public.flow_steps SET papers = ARRAY['napkin'] WHERE step_key = 'portal'$q$, 'flow_steps_papers_known');
SELECT mfl.refused('a loop that does not say when it ends', $q$UPDATE public.flow_steps SET loop_words = 'each visit' WHERE step_key = 'portal'$q$, 'flow_steps_loop_ends_with_loop');
SELECT mfl.refused('half a nudge', $q$UPDATE public.flow_steps SET nudge_how = NULL WHERE step_key = 'portal'$q$, 'flow_steps_nudge_whole');
SELECT mfl.refused('a lane the flows do not have', $q$UPDATE public.flow_steps SET lane = 'sometimes' WHERE step_key = 'portal'$q$, 'flow_steps_lane_known');
SELECT mfl.refused('a step key reused in a flow',
  $q$INSERT INTO public.flow_steps (flow_id, step_key, lane, position, name, phase, who) SELECT id, 'portal', 'once', 9, 'Portal again', 'setup', 'them' FROM public.flows WHERE kind = 'trade'$q$,
  'flow_steps_key_once');
INSERT INTO public.flow_steps (flow_id, step_key, lane, position, name, phase, who)
  SELECT id, 'safety', 'once', 2, 'Safety orientation', 'setup', 'them' FROM public.flows WHERE kind = 'trade';
SELECT mfl.same('a new step starts with nothing that finishes it', mfl.step('trade', 'safety'),
  'once|2|setup|them||and||-|-|false|false|false|-|-|-|-|0|-|Safety orientation||-');
UPDATE public.flow_steps SET papers = ARRAY['doc:0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'], facts = ARRAY['doc:0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d:signed']
  WHERE step_key = 'safety';
SELECT mfl.same('a paper made in the New paper window, and a fact on it', (SELECT concat_ws('|', array_to_string(papers, ','), array_to_string(facts, ','))
  FROM public.flow_steps WHERE step_key = 'safety'),
  'doc:0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d|doc:0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d:signed');
SELECT mfl.refused('a doc paper that is not a library id', $q$UPDATE public.flow_steps SET papers = ARRAY['doc:napkin'] WHERE step_key = 'safety'$q$, 'flow_steps_papers_known');
SELECT mfl.refused('a doc fact that reads nothing the library keeps', $q$UPDATE public.flow_steps SET facts = ARRAY['doc:0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d:eaten'] WHERE step_key = 'safety'$q$, 'flow_steps_facts_known');
SELECT mfl.refused('the flows themselves are the seed''s', $q$UPDATE public.flows SET name = 'Mine' WHERE kind = 'trade'$q$, 'permission denied for table flows');

-- 5 · The editor's history, the removed steps and a wish: who and when are the table's.
INSERT INTO public.flow_step_history (flow_id, step_key, what, by_name)
  SELECT id, 'portal', 'Portal opened: the nudge from 3 days to 4', 'Flows Estimator' FROM public.flows WHERE kind = 'trade';
SELECT mfl.refused('nobody writes history in another''s name',
  $q$INSERT INTO public.flow_step_history (flow_id, what, by_user_id) SELECT id, 'x', '00000000-0000-0000-0000-0000000006d1' FROM public.flows WHERE kind = 'trade'$q$,
  'permission denied for table flow_step_history');
SELECT mfl.refused('history is never changed', $q$UPDATE public.flow_step_history SET what = 'y'$q$, 'permission denied for table flow_step_history');
INSERT INTO public.flow_removed_steps (flow_id, step_key, lane, step, removed_by_name)
  SELECT id, 'papers', 'once', '{"name": "Papers in"}'::jsonb, 'Flows Estimator' FROM public.flows WHERE kind = 'trade';
UPDATE public.flow_removed_steps SET put_back_at = now() WHERE step_key = 'papers';
INSERT INTO public.flow_fact_wishes (flow_id, step_key, text) SELECT id, 'papers', 'their license is current' FROM public.flows WHERE kind = 'trade';
SELECT mfl.same('history, removal, put back and the wish carry the estimator',
  concat_ws('|',
    (SELECT by_user_id FROM public.flow_step_history WHERE step_key = 'portal'),
    (SELECT concat_ws(',', removed_by_user_id, put_back_by_user_id) FROM public.flow_removed_steps WHERE step_key = 'papers'),
    (SELECT by_user_id FROM public.flow_fact_wishes WHERE step_key = 'papers')),
  '00000000-0000-0000-0000-0000000006d2|00000000-0000-0000-0000-0000000006d2,00000000-0000-0000-0000-0000000006d2|00000000-0000-0000-0000-0000000006d2');

-- 6 · One person's place: a skip, a hold, a note and a sent nudge, on a job or on the Once lane.
INSERT INTO public.contact_step_skips (contact_id, step_key, why) VALUES ('00000000-0000-0000-0000-000000006001', 'who', 'A wrong number.');
SELECT mfl.refused('one standing skip per person, step and job',
  $q$INSERT INTO public.contact_step_skips (contact_id, step_key, why) VALUES ('00000000-0000-0000-0000-000000006001', 'who', 'Again.')$q$,
  'contact_step_skips_standing');
SELECT mfl.refused('a skip names one job at most',
  $q$INSERT INTO public.contact_step_skips (contact_id, step_key, why, project_id, jobs_ledger_id) VALUES ('00000000-0000-0000-0000-000000006001', 'start', 'x', '00000000-0000-0000-0000-0000000006f1', gen_random_uuid())$q$,
  'contact_step_skips_one_job');
INSERT INTO public.contact_step_skips (contact_id, step_key, why, project_id) VALUES ('00000000-0000-0000-0000-000000006001', 'start', 'Started before we met.', '00000000-0000-0000-0000-0000000006f1');
UPDATE public.contact_step_skips SET undone_at = now() WHERE step_key = 'who';
INSERT INTO public.contact_step_skips (contact_id, step_key, why) VALUES ('00000000-0000-0000-0000-000000006001', 'who', 'Skipped again after the undo.');
SELECT mfl.same('an undone skip is stamped with who undid it, and the step can be skipped again',
  (SELECT string_agg(concat_ws(',', step_key, coalesce(project_id::text, 'once'), by_user_id, coalesce(undone_by_user_id::text, 'standing')), ' / ' ORDER BY created_at)
   FROM public.contact_step_skips),
  'who,once,00000000-0000-0000-0000-0000000006d2,00000000-0000-0000-0000-0000000006d2 / start,00000000-0000-0000-0000-0000000006f1,00000000-0000-0000-0000-0000000006d2,standing / who,once,00000000-0000-0000-0000-0000000006d2,standing');
INSERT INTO public.nudge_holds (contact_id, step_key, project_id, until_on) VALUES ('00000000-0000-0000-0000-000000006001', 'start', '00000000-0000-0000-0000-0000000006f1', '2026-10-05');
SELECT mfl.refused('one standing hold per person, step and job',
  $q$INSERT INTO public.nudge_holds (contact_id, step_key, project_id, until_on) VALUES ('00000000-0000-0000-0000-000000006001', 'start', '00000000-0000-0000-0000-0000000006f1', '2026-10-09')$q$,
  'nudge_holds_standing');
UPDATE public.nudge_holds SET released_at = now();
SELECT mfl.same('a hold let go is stamped with who let it go',
  (SELECT concat_ws(',', until_on, released_by_user_id) FROM public.nudge_holds), '2026-10-05,00000000-0000-0000-0000-0000000006d2');
INSERT INTO public.nudge_sent (contact_id, step_key, project_id, how, sent_by) VALUES ('00000000-0000-0000-0000-000000006001', 'start', '00000000-0000-0000-0000-0000000006f1', 'text', 'person');
SELECT mfl.refused('a person cannot say the app sent it',
  $q$INSERT INTO public.nudge_sent (contact_id, step_key, how, sent_by) VALUES ('00000000-0000-0000-0000-000000006001', 'who', 'call', 'app')$q$,
  'nudge_sent_app_has_no_person');
SELECT mfl.refused('a sent nudge is never changed', $q$UPDATE public.nudge_sent SET how = 'call'$q$, 'permission denied for table nudge_sent');
SELECT mfl.same('the send carries the estimator',
  (SELECT concat_ws(',', sent_by, by_user_id) FROM public.nudge_sent), 'person,00000000-0000-0000-0000-0000000006d2');
UPDATE public.contacts SET off_since = '2026-10-02', off_why = 'A wrong number.', off_by = '00000000-0000-0000-0000-0000000006d2'
  WHERE id = '00000000-0000-0000-0000-000000006001';
-- 6b · Two contacts become one: the notes, skips, holds and sends follow to the contact that stays.
SELECT public.flow_add_note('00000000-0000-0000-0000-000000006002', 'who', NULL, NULL, 'Folded note.');
INSERT INTO public.nudge_holds (contact_id, step_key, until_on) VALUES ('00000000-0000-0000-0000-000000006002', 'who', '2026-10-09');
INSERT INTO public.contact_step_skips (contact_id, step_key, why) VALUES
  ('00000000-0000-0000-0000-000000006002', 'who', 'The folded one''s skip.'),
  ('00000000-0000-0000-0000-000000006003', 'who', 'The survivor''s skip.');
INSERT INTO public.nudge_sent (contact_id, step_key, how, sent_by) VALUES ('00000000-0000-0000-0000-000000006002', 'who', 'text', 'person');
SELECT public.contacts_fold('00000000-0000-0000-0000-000000006002', '00000000-0000-0000-0000-000000006003');
SELECT mfl.same('a fold moves the note, the hold, the skips and the send; a skip both had keeps the survivor''s', (
  SELECT concat_ws('|',
    (SELECT count(*) FROM public.contacts WHERE id = '00000000-0000-0000-0000-000000006002'),
    (SELECT string_agg(body || '@' || step_key, ',') FROM public.messages WHERE contact_id = '00000000-0000-0000-0000-000000006003'),
    (SELECT concat_ws(',', until_on, (released_at IS NULL)::text) FROM public.nudge_holds WHERE contact_id = '00000000-0000-0000-0000-000000006003'),
    (SELECT string_agg(why || ':' || (undone_at IS NULL)::text, ',' ORDER BY why COLLATE "C") FROM public.contact_step_skips WHERE contact_id = '00000000-0000-0000-0000-000000006003'),
    (SELECT count(*) FROM public.nudge_sent WHERE contact_id = '00000000-0000-0000-0000-000000006003'))),
  '0|Folded note.@who|2026-10-09,true|The folded one''s skip.:false,The survivor''s skip.:true|1');

-- 6c · The presses, as the caller: a note, a skip and its undo, a hold and its let go, a reminder sent, off and back on.
INSERT INTO pressed SELECT 'note', public.flow_add_note('00000000-0000-0000-0000-000000006004', 'who', 'project', '00000000-0000-0000-0000-0000000006f1', 'Sounds like the broker.');
SELECT mfl.same('a note is a team line on the step, in the writer''s name',
  (SELECT concat_ws('|', m.channel, m.direction, m.step_key, m.who_user_id, m.body, coalesce(m.project_id::text, 'on the person'))
   FROM public.messages m JOIN pressed p ON p.id = m.id AND p.what = 'note'),
  'note|team|who|00000000-0000-0000-0000-0000000006d2|Sounds like the broker.|00000000-0000-0000-0000-0000000006f1');
SELECT mfl.refused('a note with nothing in it', $q$SELECT public.flow_add_note('00000000-0000-0000-0000-000000006004', 'who', NULL, NULL, '  ')$q$, 'noteEmpty');
SELECT mfl.refused('a note on a step not on their flow', $q$SELECT public.flow_add_note('00000000-0000-0000-0000-000000006004', 'papers', NULL, NULL, 'x')$q$, 'stepUnknown');
SELECT mfl.refused('a note on a job that is not there', $q$SELECT public.flow_add_note('00000000-0000-0000-0000-000000006004', 'who', 'project', gen_random_uuid(), 'x')$q$, 'job');
SELECT mfl.refused('a client writes no line but a team line of its own',
  $q$INSERT INTO public.messages (contact_id, channel, direction, who_user_id, body) VALUES ('00000000-0000-0000-0000-000000006004', 'text', 'in', '00000000-0000-0000-0000-0000000006d2', 'A text that never came.')$q$,
  'row-level security');
SELECT mfl.refused('nor a note in another''s name',
  $q$INSERT INTO public.messages (contact_id, channel, direction, who_user_id, body) VALUES ('00000000-0000-0000-0000-000000006004', 'note', 'team', '00000000-0000-0000-0000-0000000006d1', 'Not mine.')$q$,
  'row-level security');
INSERT INTO pressed SELECT 'skip', public.flow_skip_step('00000000-0000-0000-0000-000000006004', 'who', NULL, NULL, 'A wrong number.');
SELECT mfl.refused('a second skip of the same step', $q$SELECT public.flow_skip_step('00000000-0000-0000-0000-000000006004', 'who', NULL, NULL, 'Again.')$q$, 'alreadySkipped');
SELECT mfl.refused('a skip says why', $q$SELECT public.flow_skip_step('00000000-0000-0000-0000-000000006004', 'who', 'project', '00000000-0000-0000-0000-0000000006f1', '')$q$, 'whyEmpty');
SELECT public.flow_unskip_step(id) FROM pressed WHERE what = 'skip';
SELECT mfl.refused('an undone skip is undone once', $q$SELECT public.flow_unskip_step(id) FROM pressed WHERE what = 'skip'$q$, 'notFound');
INSERT INTO pressed SELECT 'hold', public.nudge_hold_until('00000000-0000-0000-0000-000000006004', 'who', NULL, NULL, public.app_today() + 3);
INSERT INTO pressed SELECT 'hold2', public.nudge_hold_until('00000000-0000-0000-0000-000000006004', 'who', NULL, NULL, public.app_today() + 5);
SELECT mfl.refused('a hold ends after today', $q$SELECT public.nudge_hold_until('00000000-0000-0000-0000-000000006004', 'who', NULL, NULL, public.app_today())$q$, 'dayPassed');
SELECT public.nudge_let_go(id) FROM pressed WHERE what = 'hold2';
SELECT mfl.refused('a hold let go is let go once', $q$SELECT public.nudge_let_go(id) FROM pressed WHERE what = 'hold2'$q$, 'notFound');
INSERT INTO pressed SELECT 'sent', public.nudge_record_sent('00000000-0000-0000-0000-000000006004', 'who', NULL, NULL, NULL, 'call', NULL);
SELECT mfl.refused('a reminder goes a known way', $q$SELECT public.nudge_record_sent('00000000-0000-0000-0000-000000006004', 'who', NULL, NULL, NULL, 'fax', NULL)$q$, 'howUnknown');
SELECT mfl.same('the skip undone, the second hold replacing the first and let go, the reminder a person''s', (
  SELECT concat_ws('|',
    (SELECT concat_ws(',', why, by_name, undone_by_user_id) FROM public.contact_step_skips k JOIN pressed p ON p.id = k.id),
    (SELECT string_agg(concat_ws(',', (until_on - public.app_today())::text, (released_at IS NOT NULL)::text, coalesce(released_by_user_id::text, '-')), ' / ' ORDER BY created_at)
     FROM public.nudge_holds WHERE contact_id = '00000000-0000-0000-0000-000000006004'),
    (SELECT concat_ws(',', how, sent_by, by_user_id) FROM public.nudge_sent n JOIN pressed p ON p.id = n.id))),
  'A wrong number.,Flows Estimator,00000000-0000-0000-0000-0000000006d2|3,true,00000000-0000-0000-0000-0000000006d2 / 5,true,00000000-0000-0000-0000-0000000006d2|call,person,00000000-0000-0000-0000-0000000006d2');
SELECT mfl.refused('off the flow says why', $q$SELECT public.contact_set_off('00000000-0000-0000-0000-000000006004', ' ')$q$, 'whyEmpty');
SELECT public.contact_set_off('00000000-0000-0000-0000-000000006004', 'A wrong number.');
SELECT mfl.same('off the flow from today, with who',
  (SELECT concat_ws('|', (off_since = public.app_today())::text, off_why, off_by) FROM public.contacts WHERE id = '00000000-0000-0000-0000-000000006004'),
  'true|A wrong number.|00000000-0000-0000-0000-0000000006d2');
SELECT public.contact_put_back_on('00000000-0000-0000-0000-000000006004');
SELECT mfl.same('and back on', (SELECT concat_ws('|', coalesce(off_since::text, 'on'), coalesce(off_why, '-')) FROM public.contacts WHERE id = '00000000-0000-0000-0000-000000006004'), 'on|-');
SELECT mfl.refused('back on once', $q$SELECT public.contact_put_back_on('00000000-0000-0000-0000-000000006004')$q$, 'notFound');

-- 6d · flow_rows: what the flow reads, for the office, days and marks only.
SELECT mfl.same('a trade partner''s rows: the first visit, the job tied, the office''s preview link, no token outside it and no amount', (
  SELECT concat_ws('|',
    r->'contact'->>'kind',
    r->'company'->>'portal_opened_on',
    r->'portalLinks'->0->>'first_opened_at',
    ((r - 'previewPath')::text LIKE '%flows-link-token%')::text,
    r->>'previewPath',
    r->'projects'->0->>'project_id',
    r->'projects'->0->>'stage',
    r->'contactJobs'->0->>'is_default',
    (r::text ~ '"(token|amount|price|cost|gross|net|budget|due)"')::text)
  FROM (SELECT public.flow_rows('00000000-0000-0000-0000-000000006005') AS r) x),
  'trade|2026-09-09|2026-09-08T23:30:00+00:00|false|/t/flows-link-token?preview=1|00000000-0000-0000-0000-0000000006f1|buyout|true|false');
SELECT mfl.refused('no such contact', $q$SELECT public.flow_rows(gen_random_uuid())$q$, 'notFound');
SELECT mfl.same('the card a board prints, and the job''s name', (
  SELECT concat_ws('|', r->'card'->>'name', r->'card'->>'company', r->'card'->>'trades', coalesce(r->'card'->>'goes_by', '-'), r->'projects'->0->>'name',
    r->'card'->>'gc_company_id', coalesce(r->'card'->>'customer_id', '-'))
  FROM (SELECT public.flow_rows('00000000-0000-0000-0000-000000006005') AS r) x),
  'Flows Hillside|Flows Hillside|["Sitework"]|-|Flows Clinic|00000000-0000-0000-0000-0000000006a1|-');
SELECT mfl.same('everyone of a kind in one read, the same rows as one person''s, and everyone on one job', concat_ws('|',
  (SELECT count(*) FROM jsonb_object_keys(public.flow_rows_kind('trade')))::text,
  (public.flow_rows_kind('trade') -> '00000000-0000-0000-0000-000000006005' = public.flow_rows('00000000-0000-0000-0000-000000006005'))::text,
  (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(public.flow_rows_kind(NULL, '00000000-0000-0000-0000-0000000006f1')) k),
  (SELECT count(*) FROM jsonb_object_keys(public.flow_rows_kind('unknown')))::text),
  '1|true|00000000-0000-0000-0000-000000006005|3');
SELECT mfl.refused('never everyone of every kind', $q$SELECT public.flow_rows_kind(NULL)$q$, 'kindOrJob');
SELECT mfl.refused('a kind the flows do not have', $q$SELECT public.flow_rows_kind('vendor')$q$, 'kindUnknown');
SELECT mfl.same('the office takes a person off the flow',
  (SELECT concat_ws('|', off_since, off_why) FROM public.contacts WHERE id = '00000000-0000-0000-0000-000000006001'), '2026-10-02|A wrong number.');
RESET ROLE;

-- 7 · Training mode and the digital twin change nothing; nobody outside the office reads flow_rows.
SELECT mfl.as_user('00000000-0000-0000-0000-0000000006d4');
SET LOCAL ROLE authenticated;
SELECT mfl.refused('a superintendent outside the office reads no flow rows', $q$SELECT public.flow_rows('00000000-0000-0000-0000-000000006005')$q$, 'notAllowed');
SELECT mfl.refused('nor a board''s', $q$SELECT public.flow_rows_kind('trade')$q$, 'notAllowed');
SELECT mfl.refused('nor the set-wise read under them', $q$SELECT public.flow_rows_for(ARRAY['00000000-0000-0000-0000-000000006005'::uuid])$q$, 'permission denied');
RESET ROLE;
SELECT mfl.as_user('00000000-0000-0000-0000-0000000006d6');
SET LOCAL ROLE authenticated;
SELECT mfl.refused('training mode edits no step', $q$UPDATE public.flow_steps SET usual = 9 WHERE step_key = 'portal'$q$, 'Read-only (training) mode');
SELECT mfl.refused('training mode adds no note', $q$SELECT public.flow_add_note('00000000-0000-0000-0000-000000006004', 'who', NULL, NULL, 'x')$q$, 'Read-only (training) mode');
SELECT mfl.refused('training mode skips nothing',
  $q$INSERT INTO public.contact_step_skips (contact_id, step_key, why) VALUES ('00000000-0000-0000-0000-000000006001', 'start', 'x')$q$, 'Read-only (training) mode');
RESET ROLE;
SELECT mfl.as_user('00000000-0000-0000-0000-0000000006d7');
SET LOCAL ROLE authenticated;
SELECT mfl.refused('a twin adds no note', $q$SELECT public.flow_add_note('00000000-0000-0000-0000-000000006004', 'who', NULL, NULL, 'x')$q$, 'row-level security');
SELECT mfl.refused('a twin skips nothing',
  $q$INSERT INTO public.contact_step_skips (contact_id, step_key, why) VALUES ('00000000-0000-0000-0000-000000006001', 'start', 'x')$q$, 'row-level security');
SELECT mfl.refused('a twin adds no step',
  $q$INSERT INTO public.flow_steps (flow_id, step_key, lane, position, name, phase, who) SELECT id, 'twin_step', 'once', 9, 'Twin', 'setup', 'them' FROM public.flows WHERE kind = 'trade'$q$, 'row-level security');
UPDATE public.flow_steps SET usual = 9 WHERE step_key = 'portal';
RESET ROLE;
SELECT mfl.same('a twin''s edit to a step changes nothing', (SELECT usual FROM public.flow_steps WHERE step_key = 'portal')::text, '1');
SELECT mfl.same('every new table carries the office policy and the read-only and twin blocks', (
  SELECT string_agg(c.relname || ':' || (SELECT string_agg(polname, ',' ORDER BY polname COLLATE "C") FROM pg_policy WHERE polrelid = c.oid)
    || ':' || (SELECT count(*) FROM pg_trigger WHERE tgrelid = c.oid AND tgname = 'read_only_block_stmt'), E'\n' ORDER BY c.relname COLLATE "C")
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('flows', 'flow_steps', 'flow_step_history', 'flow_removed_steps', 'flow_fact_wishes',
    'contact_step_skips', 'nudge_holds', 'nudge_sent')),
  'contact_step_skips:contact_step_skips_team,digital_twin_write_fence_delete,digital_twin_write_fence_insert,digital_twin_write_fence_update,read_only_users_cannot_delete,read_only_users_cannot_insert,read_only_users_cannot_update:1' || E'\n' ||
  'flow_fact_wishes:digital_twin_write_fence_delete,digital_twin_write_fence_insert,digital_twin_write_fence_update,flow_fact_wishes_team,read_only_users_cannot_delete,read_only_users_cannot_insert,read_only_users_cannot_update:1' || E'\n' ||
  'flow_removed_steps:digital_twin_write_fence_delete,digital_twin_write_fence_insert,digital_twin_write_fence_update,flow_removed_steps_team,read_only_users_cannot_delete,read_only_users_cannot_insert,read_only_users_cannot_update:1' || E'\n' ||
  'flow_step_history:digital_twin_write_fence_delete,digital_twin_write_fence_insert,digital_twin_write_fence_update,flow_step_history_team,read_only_users_cannot_delete,read_only_users_cannot_insert,read_only_users_cannot_update:1' || E'\n' ||
  'flow_steps:digital_twin_write_fence_delete,digital_twin_write_fence_insert,digital_twin_write_fence_update,flow_steps_team,read_only_users_cannot_delete,read_only_users_cannot_insert,read_only_users_cannot_update:1' || E'\n' ||
  'flows:digital_twin_write_fence_delete,digital_twin_write_fence_insert,digital_twin_write_fence_update,flows_team,read_only_users_cannot_delete,read_only_users_cannot_insert,read_only_users_cannot_update:1' || E'\n' ||
  'nudge_holds:digital_twin_write_fence_delete,digital_twin_write_fence_insert,digital_twin_write_fence_update,nudge_holds_team,read_only_users_cannot_delete,read_only_users_cannot_insert,read_only_users_cannot_update:1' || E'\n' ||
  'nudge_sent:digital_twin_write_fence_delete,digital_twin_write_fence_insert,digital_twin_write_fence_update,nudge_sent_team,read_only_users_cannot_delete,read_only_users_cannot_insert,read_only_users_cannot_update:1');

-- 8 · The four facts main did not keep have their columns.
SELECT mfl.same('the four new facts'' columns', (
  SELECT string_agg(table_name || '.' || column_name || ' ' || data_type, ', ' ORDER BY table_name COLLATE "C")
  FROM information_schema.columns
  WHERE table_schema = 'public' AND (table_name, column_name) IN (
    ('gc_trade_portal_links', 'first_opened_at'), ('gc_invites', 'lost_on'), ('gc_projects', 'won_on'), ('gc_owner_pay_apps', 'paid_on'))),
  'gc_invites.lost_on date, gc_owner_pay_apps.paid_on date, gc_projects.won_on date, gc_trade_portal_links.first_opened_at timestamp with time zone');

DO $$ BEGIN RAISE NOTICE 'messages_flows PASSED'; END $$;
ROLLBACK;
