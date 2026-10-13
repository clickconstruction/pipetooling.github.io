-- Running late (Messages, residential R8 · 3 PR 2, migration *_running_late_move): a tech's Move it slides their own
-- day through self_move_schedule_block in one call, the late block last; the late job reads one running_late line with
-- the reason and no thread note of its own; a slid job dispatch made keeps its note; the dispatcher's note is one
-- dispatch_requests row from the tech, pending_action running_late, its id returned; a bid's block moves with the note
-- and no job line. Any refusal moves nothing: another tech's block, another day, past 8:00 PM, a block twice, no
-- reason, a window kept, a refusal inside self_move after a row moved, a window under 30 minutes, training mode and
-- anon. Everything rolls back. Raises on the first failed assertion; ends with "running_late_move PASSED". See
-- scripts/pgtest-running-late-move.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (Rosa, an assistant), a master who owns the jobs, Luis and Nico in the field, and a tech in training mode.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000e1a01', 'rosa@late.test'),
  ('00000000-0000-0000-0000-0000000e1a02', 'luis@late.test'),
  ('00000000-0000-0000-0000-0000000e1a03', 'nico@late.test'),
  ('00000000-0000-0000-0000-0000000e1a04', 'training@late.test'),
  ('00000000-0000-0000-0000-0000000e1a05', 'master@late.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000e1a01', 'rosa@late.test', 'Late Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000e1a02', 'luis@late.test', 'Late Luis', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000e1a03', 'nico@late.test', 'Late Nico', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000e1a04', 'training@late.test', 'Late Training', 'primary', true, false),
  ('00000000-0000-0000-0000-0000000e1a05', 'master@late.test', 'Late Master', 'master_technician', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Three jobs on Luis's Monday, one for the training tech, and a bid walk on Tuesday. Made-up rows.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000e1e01', 'Running Late Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-0000000e1d01', '00000000-0000-0000-0000-0000000e1a05', '00000000-0000-0000-0000-0000000e1e01', 'Late bed sewer line'),
  ('00000000-0000-0000-0000-0000000e1d02', '00000000-0000-0000-0000-0000000e1a05', '00000000-0000-0000-0000-0000000e1e01', 'Late bed water heater'),
  ('00000000-0000-0000-0000-0000000e1d03', '00000000-0000-0000-0000-0000000e1a05', '00000000-0000-0000-0000-0000000e1e01', 'Late bed church'),
  ('00000000-0000-0000-0000-0000000e1d04', '00000000-0000-0000-0000-0000000e1a05', '00000000-0000-0000-0000-0000000e1e01', 'Late bed training job');
INSERT INTO public.bids (id, created_by, service_type_id, project_name) VALUES
  ('00000000-0000-0000-0000-0000000e1f01', '00000000-0000-0000-0000-0000000e1a01', '00000000-0000-0000-0000-0000000e1e01', 'Late bed walk');
-- The sewer line 8:00 to 8:30 and the water heater 9:00 to 10:30 (a crew block with Nico), both made by Rosa; the
-- church at noon, Luis's own; the training tech's block; the bid walk on Tuesday.
INSERT INTO public.job_schedule_blocks (id, job_id, bid_id, assignee_user_id, created_by, work_date, time_start, time_end, shared_block_group_id) VALUES
  ('00000000-0000-0000-0000-0000000e1b01', '00000000-0000-0000-0000-0000000e1d01', NULL, '00000000-0000-0000-0000-0000000e1a02', '00000000-0000-0000-0000-0000000e1a01', '2026-10-12', '08:00', '08:30', NULL),
  ('00000000-0000-0000-0000-0000000e1b02', '00000000-0000-0000-0000-0000000e1d02', NULL, '00000000-0000-0000-0000-0000000e1a02', '00000000-0000-0000-0000-0000000e1a01', '2026-10-12', '09:00', '10:30', '00000000-0000-0000-0000-0000000e1c01'),
  ('00000000-0000-0000-0000-0000000e1b03', '00000000-0000-0000-0000-0000000e1d03', NULL, '00000000-0000-0000-0000-0000000e1a02', '00000000-0000-0000-0000-0000000e1a02', '2026-10-12', '12:00', '13:00', NULL),
  ('00000000-0000-0000-0000-0000000e1b04', '00000000-0000-0000-0000-0000000e1d02', NULL, '00000000-0000-0000-0000-0000000e1a03', '00000000-0000-0000-0000-0000000e1a01', '2026-10-12', '09:00', '10:30', '00000000-0000-0000-0000-0000000e1c01'),
  ('00000000-0000-0000-0000-0000000e1b05', '00000000-0000-0000-0000-0000000e1d04', NULL, '00000000-0000-0000-0000-0000000e1a04', '00000000-0000-0000-0000-0000000e1a01', '2026-10-12', '08:00', '09:00', NULL),
  ('00000000-0000-0000-0000-0000000e1b06', NULL, '00000000-0000-0000-0000-0000000e1f01', '00000000-0000-0000-0000-0000000e1a02', '00000000-0000-0000-0000-0000000e1a01', '2026-10-13', '08:00', '09:00', NULL);

CREATE SCHEMA rlm;
CREATE FUNCTION rlm.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION rlm.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION rlm.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION rlm.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- Luis's day as the board reads it: "b1 08:00-08:30 group" per block, in the day's order.
CREATE FUNCTION rlm.day() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg('b' || right(b.id::text, 1) || ' ' || b.work_date || ' ' || to_char(b.time_start, 'HH24:MI') || '-' || to_char(b.time_end, 'HH24:MI')
    || CASE WHEN b.shared_block_group_id IS NULL THEN '' ELSE ' crew' END, ', ' ORDER BY b.work_date, b.time_start, b.id)
  FROM public.job_schedule_blocks b WHERE b.id::text LIKE '00000000-0000-0000-0000-0000000e1b%'
$$;
-- What a move leaves behind: the job lines, the thread notes and the dispatch rows.
CREATE FUNCTION rlm.trail() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT format('%s events, %s notes, %s requests',
    (SELECT count(*) FROM public.job_activity_events WHERE event_type = 'running_late' AND job_id::text LIKE '00000000-0000-0000-0000-0000000e1d%'),
    (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE job_id::text LIKE '00000000-0000-0000-0000-0000000e1d%' AND body LIKE 'Moved my scheduled visit%'),
    (SELECT count(*) FROM public.dispatch_requests WHERE from_user_id::text LIKE '00000000-0000-0000-0000-0000000e1a%'))
$$;
GRANT USAGE ON SCHEMA rlm TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA rlm TO anon, authenticated, service_role;

-- The words the kernel sends (scheduleDispatch/whatSlides.ts → boardWrite).
CREATE FUNCTION rlm.call(p_moves text, p_reason text DEFAULT 'said to Dana, 9:02 AM') RETURNS text LANGUAGE sql AS $$
  SELECT format('SELECT public.running_late_move(%L::jsonb, %L, %L, %L, %L)', p_moves, p_reason,
    'Running late. Moved from 8:00 AM to 9:30 AM, said to Dana, 9:02 AM.',
    'Late Luis is running late on job 1312',
    'Job 1312 moves from 8:00 AM to 9:30 AM, said to Dana, 9:02 AM. Job 1298 for Marcus Ortiz slides 1 hour. Late Luis leaves the crew block.')
$$;
GRANT EXECUTE ON FUNCTION rlm.call(text, text) TO anon, authenticated, service_role;

SELECT rlm.same('Luis''s Monday before', rlm.day(),
  'b1 2026-10-12 08:00-08:30, b5 2026-10-12 08:00-09:00, b2 2026-10-12 09:00-10:30 crew, b4 2026-10-12 09:00-10:30 crew, b3 2026-10-12 12:00-13:00, b6 2026-10-13 08:00-09:00');

-- The sewer line moves to 9:30 to 10:00; the water heater slides an hour to 10:00 to 11:30; the church holds.
CREATE TEMP TABLE late_moves (k text PRIMARY KEY, v text);
INSERT INTO late_moves VALUES
  ('good', '[{"p_block_id":"00000000-0000-0000-0000-0000000e1b02","p_work_date":"2026-10-12","p_time_start":"10:00:00","p_time_end":"11:30:00"},{"p_block_id":"00000000-0000-0000-0000-0000000e1b01","p_work_date":"2026-10-12","p_time_start":"09:30:00","p_time_end":"10:00:00"}]'),
  ('twice', '[{"p_block_id":"00000000-0000-0000-0000-0000000e1b01","p_work_date":"2026-10-12","p_time_start":"09:30:00","p_time_end":"10:00:00"},{"p_block_id":"00000000-0000-0000-0000-0000000e1b01","p_work_date":"2026-10-12","p_time_start":"09:30:00","p_time_end":"10:00:00"}]'),
  ('nicos', '[{"p_block_id":"00000000-0000-0000-0000-0000000e1b04","p_work_date":"2026-10-12","p_time_start":"10:00:00","p_time_end":"11:30:00"}]'),
  ('nicos_slid', '[{"p_block_id":"00000000-0000-0000-0000-0000000e1b04","p_work_date":"2026-10-12","p_time_start":"10:00:00","p_time_end":"11:30:00"},{"p_block_id":"00000000-0000-0000-0000-0000000e1b01","p_work_date":"2026-10-12","p_time_start":"09:30:00","p_time_end":"10:00:00"}]'),
  ('past_eight', '[{"p_block_id":"00000000-0000-0000-0000-0000000e1b03","p_work_date":"2026-10-12","p_time_start":"19:30:00","p_time_end":"20:30:00"}]'),
  ('other_day', '[{"p_block_id":"00000000-0000-0000-0000-0000000e1b01","p_work_date":"2026-10-13","p_time_start":"09:30:00","p_time_end":"10:00:00"}]'),
  ('kept', '[{"p_block_id":"00000000-0000-0000-0000-0000000e1b02","p_work_date":"2026-10-12","p_time_start":"10:00:00","p_time_end":"11:30:00"},{"p_block_id":"00000000-0000-0000-0000-0000000e1b01","p_work_date":"2026-10-12","p_time_start":"08:00:00","p_time_end":"08:30:00"}]'),
  ('inner_refusal', '[{"p_block_id":"00000000-0000-0000-0000-0000000e1b02","p_work_date":"2026-10-12","p_time_start":"10:00:00","p_time_end":"11:30:00"},{"p_block_id":"00000000-0000-0000-0000-0000000e1b01","p_work_date":"2026-10-12","p_time_start":"09:30:00","p_time_end":"09:15:00"}]'),
  ('short', '[{"p_block_id":"00000000-0000-0000-0000-0000000e1b02","p_work_date":"2026-10-12","p_time_start":"10:00:00","p_time_end":"11:30:00"},{"p_block_id":"00000000-0000-0000-0000-0000000e1b01","p_work_date":"2026-10-12","p_time_start":"09:30:00","p_time_end":"09:45:00"}]'),
  ('training', '[{"p_block_id":"00000000-0000-0000-0000-0000000e1b05","p_work_date":"2026-10-12","p_time_start":"09:00:00","p_time_end":"10:00:00"}]'),
  ('bid', '[{"p_block_id":"00000000-0000-0000-0000-0000000e1b06","p_work_date":"2026-10-13","p_time_start":"09:00:00","p_time_end":"10:00:00"}]');
GRANT SELECT ON late_moves TO anon, authenticated;

-- 1 · Anon cannot call it.
SET LOCAL ROLE anon;
SELECT rlm.as_anon();
SELECT rlm.refused('anon cannot move a block', rlm.call((SELECT v FROM late_moves WHERE k = 'good')), 'permission denied');
RESET ROLE;

-- 2 · Every refusal moves nothing.
SET LOCAL ROLE authenticated;
SELECT rlm.as_user('00000000-0000-0000-0000-0000000e1a02');
SELECT rlm.refused('nothing to move', rlm.call('[]'), 'nothing to move');
SELECT rlm.refused('a move needs its reason', rlm.call((SELECT v FROM late_moves WHERE k = 'good'), '  '), 'needs its reason');
SELECT rlm.refused('a block moves once', rlm.call((SELECT v FROM late_moves WHERE k = 'twice')), 'a block moves once');
SELECT rlm.refused('the late block is the tech''s own', rlm.call((SELECT v FROM late_moves WHERE k = 'nicos')), 'not yours');
SELECT rlm.refused('every slid block is the tech''s own', rlm.call((SELECT v FROM late_moves WHERE k = 'nicos_slid')), 'not yours');
SELECT rlm.refused('nothing past 8:00 PM', rlm.call((SELECT v FROM late_moves WHERE k = 'past_eight')), 'past 8:00 PM');
SELECT rlm.refused('a running late move stays on its day', rlm.call((SELECT v FROM late_moves WHERE k = 'other_day')), 'stays on its day');
SELECT rlm.refused('the late block must move', rlm.call((SELECT v FROM late_moves WHERE k = 'kept')), 'keeps its window');
SELECT rlm.refused('a refusal after a row moved moves nothing', rlm.call((SELECT v FROM late_moves WHERE k = 'inner_refusal')), 'end time must be after start time');
SELECT rlm.refused('a window under 30 minutes moves nothing', rlm.call((SELECT v FROM late_moves WHERE k = 'short')), 'job_schedule_blocks_min_duration_30m');
SELECT rlm.as_user('00000000-0000-0000-0000-0000000e1a04');
SELECT rlm.refused('training mode moves nothing', rlm.call((SELECT v FROM late_moves WHERE k = 'training')), 'Read-only (training) mode');
RESET ROLE;
SELECT rlm.same('after the refusals the board is as it was', rlm.day(),
  'b1 2026-10-12 08:00-08:30, b5 2026-10-12 08:00-09:00, b2 2026-10-12 09:00-10:30 crew, b4 2026-10-12 09:00-10:30 crew, b3 2026-10-12 12:00-13:00, b6 2026-10-13 08:00-09:00');
SELECT rlm.same('after the refusals nothing is written', rlm.trail(), '0 events, 0 notes, 0 requests');

-- 3 · Move it: Luis's morning slides, in one call.
SET LOCAL ROLE authenticated;
SELECT rlm.as_user('00000000-0000-0000-0000-0000000e1a02');
SELECT set_config('rlm.request', (SELECT public.running_late_move((SELECT v FROM late_moves WHERE k = 'good')::jsonb,
  'said to Dana, 9:02 AM', 'Running late. Moved from 8:00 AM to 9:30 AM, said to Dana, 9:02 AM.',
  'Late Luis is running late on job 1312',
  'Job 1312 moves from 8:00 AM to 9:30 AM, said to Dana, 9:02 AM. Job 1298 for Marcus Ortiz slides 1 hour. Late Luis leaves the crew block.'))::text, true);
SELECT rlm.same('the tech reads the dispatcher''s note they filed', (
  SELECT count(*)::text FROM public.dispatch_requests WHERE id = current_setting('rlm.request')::uuid), '1');
RESET ROLE;

SELECT rlm.same('the late block and the slid one moved, the rest held, Luis out of the crew block', rlm.day(),
  'b5 2026-10-12 08:00-09:00, b4 2026-10-12 09:00-10:30 crew, b1 2026-10-12 09:30-10:00, b2 2026-10-12 10:00-11:30, b3 2026-10-12 12:00-13:00, b6 2026-10-13 08:00-09:00');
SELECT rlm.same('the late block keeps where it was first', (
  SELECT (field_moved_at IS NOT NULL)::text || ' ' || (field_moved_from ->> 'time_start') || '-' || (field_moved_from ->> 'time_end')
  FROM public.job_schedule_blocks WHERE id = '00000000-0000-0000-0000-0000000e1b01'), 'true 08:00:00-08:30:00');
SELECT rlm.same('the late job reads one running_late line with the reason', (
  SELECT string_agg(e.summary || ' | ' || (e.detail ->> 'reason') || ' | ' || (e.detail -> 'slid_block_ids')::text
    || ' | ' || (e.detail -> 'from' ->> 'time_start') || '>' || (e.detail -> 'to' ->> 'time_start')
    || ' | ' || e.actor_user_id::text || ' | ' || e.financial::text, '; ')
  FROM public.job_activity_events e WHERE e.job_id = '00000000-0000-0000-0000-0000000e1d01' AND e.event_type = 'running_late'),
  'Running late. Moved from 8:00 AM to 9:30 AM, said to Dana, 9:02 AM. | said to Dana, 9:02 AM | ["00000000-0000-0000-0000-0000000e1b02"] | 08:00:00>09:30:00 | 00000000-0000-0000-0000-0000000e1a02 | false');
SELECT rlm.same('the late job has no thread note of its own', (
  SELECT count(*)::text FROM public.jobs_ledger_thread_notes WHERE job_id = '00000000-0000-0000-0000-0000000e1d01'), '0');
SELECT rlm.same('the slid job dispatch made keeps its note and has no running_late line', (
  SELECT (SELECT count(*) FROM public.jobs_ledger_thread_notes WHERE job_id = '00000000-0000-0000-0000-0000000e1d02' AND body LIKE 'Moved my scheduled visit from 2026-10-12 09:00 AM%')::text
    || ' ' || (SELECT count(*) FROM public.job_activity_events WHERE job_id = '00000000-0000-0000-0000-0000000e1d02' AND event_type = 'running_late')::text), '1 0');
SELECT rlm.same('the dispatcher''s note is one open row from the tech on the late job', (
  SELECT d.from_user_id::text || ' | ' || d.status || ' | ' || d.pending_action || ' | ' || d.job_ledger_id::text || ' | ' || coalesce(d.bid_id::text, 'no bid')
    || ' | ' || d.title || ' | ' || d.reference_summary
  FROM public.dispatch_requests d WHERE d.id = current_setting('rlm.request')::uuid),
  '00000000-0000-0000-0000-0000000e1a02 | open | running_late | 00000000-0000-0000-0000-0000000e1d01 | no bid | Late Luis is running late on job 1312 | Job 1312 moves from 8:00 AM to 9:30 AM, said to Dana, 9:02 AM. Job 1298 for Marcus Ortiz slides 1 hour. Late Luis leaves the crew block.');
SELECT rlm.same('the schedule ledger holds both moves by Luis', (
  SELECT string_agg('b' || right(block_id::text, 1) || ' ' || change || ' ' || actor_user_id::text, ', ' ORDER BY block_id)
  FROM public.schedule_block_events WHERE block_id::text LIKE '00000000-0000-0000-0000-0000000e1b%' AND change = 'moved'),
  'b1 moved 00000000-0000-0000-0000-0000000e1a02, b2 moved 00000000-0000-0000-0000-0000000e1a02');
SELECT rlm.same('the setting is cleared after the call', coalesce(current_setting('app.running_late_block', true), ''), '');

-- 4 · self_move_schedule_block alone still writes its note for a block dispatch made.
SET LOCAL ROLE authenticated;
SELECT rlm.as_user('00000000-0000-0000-0000-0000000e1a02');
SELECT public.self_move_schedule_block('00000000-0000-0000-0000-0000000e1b01', '2026-10-12', '10:00', '10:30');
RESET ROLE;
SELECT rlm.same('a move by hand keeps its note', (
  SELECT count(*)::text FROM public.jobs_ledger_thread_notes WHERE job_id = '00000000-0000-0000-0000-0000000e1d01' AND body LIKE 'Moved my scheduled visit%'), '1');

-- 5 · A bid's block moves with the dispatcher's note and no job line.
SET LOCAL ROLE authenticated;
SELECT rlm.as_user('00000000-0000-0000-0000-0000000e1a02');
SELECT set_config('rlm.bid_request', (SELECT public.running_late_move((SELECT v FROM late_moves WHERE k = 'bid')::jsonb,
  'said to Greg, 7:40 AM', 'Running late. Moved from 8:00 AM to 9:00 AM, said to Greg, 7:40 AM.',
  'Late Luis is running late on the walk', 'The walk moves from 8:00 AM to 9:00 AM, said to Greg, 7:40 AM.'))::text, true);
RESET ROLE;
SELECT rlm.same('the bid walk moved', (
  SELECT to_char(time_start, 'HH24:MI') || '-' || to_char(time_end, 'HH24:MI') FROM public.job_schedule_blocks WHERE id = '00000000-0000-0000-0000-0000000e1b06'), '09:00-10:00');
SELECT rlm.same('the bid walk''s note names the bid and no job', (
  SELECT coalesce(d.job_ledger_id::text, 'no job') || ' | ' || d.bid_id::text || ' | ' || d.pending_action
  FROM public.dispatch_requests d WHERE d.id = current_setting('rlm.bid_request')::uuid),
  'no job | 00000000-0000-0000-0000-0000000e1f01 | running_late');
SELECT rlm.same('the bid walk writes no job line', rlm.trail(), '1 events, 2 notes, 2 requests');

DO $$ BEGIN RAISE NOTICE 'running_late_move PASSED'; END $$;
ROLLBACK;
