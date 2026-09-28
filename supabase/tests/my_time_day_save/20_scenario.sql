-- Scenario for save_my_time_day (v2.4063). Run after 00_schema.sql and the migration, as a
-- superuser; each step sets the caller with bed.uid and switches to the authenticated role so
-- clock_sessions' RLS applies. Ends with "save_my_time_day PASSED".
\set ON_ERROR_STOP 1
\c bed

-- Ana (…0a) worked 2026-09-21: a1 08–10 approved, a2 10–12 approved, a3 13–14 pending.
-- Ben (…0b) has b1 on the same day. people_hours holds Ana's approved 4 h.
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, clocked_out_at, work_date, approved_at, notes, job_ledger_id) VALUES
 ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', '2026-09-21 13:00Z', '2026-09-21 15:00Z', '2026-09-21', '2026-09-22 00:00Z', 'a1', '20000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', '2026-09-21 15:00Z', '2026-09-21 17:00Z', '2026-09-21', '2026-09-22 00:00Z', 'a2', NULL),
 ('10000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000000a', '2026-09-21 18:00Z', '2026-09-21 19:00Z', '2026-09-21', NULL, 'a3', NULL),
 ('10000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', '2026-09-21 13:00Z', '2026-09-21 21:00Z', '2026-09-21', NULL, 'b1', NULL);
INSERT INTO public.people_hours (person_name, work_date, hours) VALUES ('Ana Worker', '2026-09-21', 4);

-- expect_error(sql, fragment): the call must fail with a message containing fragment.
CREATE FUNCTION public.expect_error(p_sql text, p_fragment text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'expected an error containing "%" but the call succeeded', p_fragment USING ERRCODE = 'P0099';
EXCEPTION
  WHEN SQLSTATE 'P0099' THEN RAISE;
  WHEN others THEN
    IF position(p_fragment IN SQLERRM) = 0 THEN
      RAISE EXCEPTION 'expected an error containing "%", got "%"', p_fragment, SQLERRM;
    END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.expect_error(text, text) TO authenticated, anon;

-- ---------------------------------------------------------------- 1. notes only
SET ROLE authenticated;
SELECT set_config('bed.uid', '00000000-0000-0000-0000-00000000000a', false);
SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', false,
  '[{"op":"update_notes","id":"10000000-0000-0000-0000-0000000000a1","notes":"framing"},
    {"op":"update_notes","id":"10000000-0000-0000-0000-0000000000a2","notes":"trim"}]');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT notes FROM clock_sessions WHERE id = '10000000-0000-0000-0000-0000000000a1') = 'framing', '1: a1 note';
  ASSERT (SELECT notes FROM clock_sessions WHERE id = '10000000-0000-0000-0000-0000000000a2') = 'trim', '1: a2 note';
  ASSERT (SELECT approved_at FROM clock_sessions WHERE id = '10000000-0000-0000-0000-0000000000a1') IS NOT NULL, '1: still approved';
  ASSERT (SELECT hours FROM people_hours WHERE person_name = 'Ana Worker') = 4, '1: notes leave payroll hours alone';
END $$;

-- ---------------------------------------------------------------- 2. an approved row's times move: one resync
SET ROLE authenticated;
SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', false,
  '[{"op":"update_times","id":"10000000-0000-0000-0000-0000000000a1","clocked_in_at":"2026-09-21T13:00:00Z","clocked_out_at":"2026-09-21T14:00:00Z","notes":"framing"}]');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT clocked_out_at FROM clock_sessions WHERE id = '10000000-0000-0000-0000-0000000000a1') = '2026-09-21 14:00Z', '2: a1 out';
  ASSERT (SELECT job_ledger_id FROM clock_sessions WHERE id = '10000000-0000-0000-0000-0000000000a1') = '20000000-0000-0000-0000-000000000001', '2: job kept when not sent';
  ASSERT (SELECT hours FROM people_hours WHERE person_name = 'Ana Worker') = 3, '2: payroll hours resynced to 1 + 2';
END $$;

-- ---------------------------------------------------------------- 3. a pending row's times move: no resync
UPDATE people_hours SET hours = 99 WHERE person_name = 'Ana Worker';
SET ROLE authenticated;
SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', false,
  '[{"op":"update_times","id":"10000000-0000-0000-0000-0000000000a3","clocked_in_at":"2026-09-21T18:00:00Z","clocked_out_at":"2026-09-21T18:30:00Z","notes":"a3"}]');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT hours FROM people_hours WHERE person_name = 'Ana Worker') = 99, '3: pending rows do not resync';
END $$;
UPDATE people_hours SET hours = 3 WHERE person_name = 'Ana Worker';

-- ---------------------------------------------------------------- 4. insert, and the optional columns
SET ROLE authenticated;
SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', false,
  '[{"op":"insert","clocked_in_at":"2026-09-21T20:00:00Z","clocked_out_at":"2026-09-21T21:00:00Z","notes":"new","job_ledger_id":"20000000-0000-0000-0000-000000000002","bid_id":null},
    {"op":"update_times","id":"10000000-0000-0000-0000-0000000000a3","clocked_in_at":"2026-09-21T18:00:00Z","clocked_out_at":"2026-09-21T18:30:00Z","notes":"a3","job_ledger_id":null,"bid_id":"30000000-0000-0000-0000-000000000001","work_date":"2026-09-21"}]');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM clock_sessions WHERE notes = 'new' AND user_id = '00000000-0000-0000-0000-00000000000a'
          AND work_date = '2026-09-21' AND job_ledger_id = '20000000-0000-0000-0000-000000000002' AND approved_at IS NULL) = 1, '4: inserted';
  ASSERT (SELECT bid_id FROM clock_sessions WHERE id = '10000000-0000-0000-0000-0000000000a3') = '30000000-0000-0000-0000-000000000001', '4: bid written when sent';
  ASSERT (SELECT job_ledger_id FROM clock_sessions WHERE id = '10000000-0000-0000-0000-0000000000a3') IS NULL, '4: job cleared when sent as null';
END $$;

-- ---------------------------------------------------------------- 5. all or nothing: a missing row undoes the write before it
SET ROLE authenticated;
SELECT public.expect_error($q$SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', false,
  '[{"op":"update_notes","id":"10000000-0000-0000-0000-0000000000a1","notes":"LOST"},
    {"op":"update_notes","id":"10000000-0000-0000-0000-0000000000ff","notes":"x"}]')$q$, 'was not found');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT notes FROM clock_sessions WHERE id = '10000000-0000-0000-0000-0000000000a1') = 'framing', '5: first write rolled back';
END $$;

-- ---------------------------------------------------------------- 6. all or nothing: an RPC's error_message undoes everything
SET ROLE authenticated;
SELECT set_config('bed.rpc_error', 'Session is outside the editable current week', false);
SELECT public.expect_error($q$SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', false,
  '[{"op":"update_times","id":"10000000-0000-0000-0000-0000000000a1","clocked_in_at":"2026-09-21T13:00:00Z","clocked_out_at":"2026-09-21T16:00:00Z","notes":"LOST"},
    {"op":"split_segments","id":"10000000-0000-0000-0000-0000000000a2","segments":[]}]')$q$, 'Session is outside the editable current week');
SELECT set_config('bed.rpc_error', '', false);
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT notes FROM clock_sessions WHERE id = '10000000-0000-0000-0000-0000000000a1') = 'framing', '6: update rolled back';
  ASSERT (SELECT clocked_out_at FROM clock_sessions WHERE id = '10000000-0000-0000-0000-0000000000a1') = '2026-09-21 14:00Z', '6: times rolled back';
  ASSERT (SELECT count(*) FROM rpc_log) = 0, '6: the RPC''s own write rolled back';
  ASSERT (SELECT notes FROM clock_sessions WHERE id = '10000000-0000-0000-0000-0000000000a2') = 'trim', '6: the RPC''s row untouched';
  ASSERT (SELECT hours FROM people_hours WHERE person_name = 'Ana Worker') = 3, '6: no resync';
END $$;

-- ---------------------------------------------------------------- 7. RPC family and arguments
-- (rpc_log.n is a sequence: step 6's rolled-back call still spent a number, so read by order.)
SET ROLE authenticated;
SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', false,
  '[{"op":"split_segments","id":"10000000-0000-0000-0000-0000000000a3","segments":[{"notes":"p"},{"notes":"q"}]},
    {"op":"split_cluster","ids":["10000000-0000-0000-0000-0000000000a1","10000000-0000-0000-0000-0000000000a2"],"segments":[{"notes":"r"}]},
    {"op":"replace_mixed","ids":["10000000-0000-0000-0000-0000000000a1"],"segments":[]}]');
SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', true,
  '[{"op":"split_segments","id":"10000000-0000-0000-0000-0000000000a3","segments":[]},
    {"op":"split_cluster","ids":["10000000-0000-0000-0000-0000000000a1"],"segments":[]},
    {"op":"replace_mixed","ids":["10000000-0000-0000-0000-0000000000a2"],"segments":[]}]');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT array_agg(fn ORDER BY n) FROM rpc_log) = ARRAY['split_own_segments','split_own_cluster','replace_own_mixed','leader_split_segments','leader_split_cluster','leader_replace_mixed'], '7: families in order';
  ASSERT (SELECT ids FROM rpc_log ORDER BY n OFFSET 1 LIMIT 1) = ARRAY['10000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000a2']::uuid[], '7: cluster ids in order';
  ASSERT (SELECT segments FROM rpc_log ORDER BY n LIMIT 1) = '[{"notes":"p"},{"notes":"q"}]'::jsonb, '7: segments passed through';
END $$;
TRUNCATE rpc_log;

-- ---------------------------------------------------------------- 8. rows that are not the person's, and RLS
SET ROLE authenticated;
-- Ana saving her own day cannot touch Ben's row.
SELECT public.expect_error($q$SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', false,
  '[{"op":"update_notes","id":"10000000-0000-0000-0000-0000000000b1","notes":"x"}]')$q$, 'was not found');
-- Ana naming Ben as the person still cannot: RLS hides his row from her.
SELECT public.expect_error($q$SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000b', '2026-09-21', true,
  '[{"op":"update_notes","id":"10000000-0000-0000-0000-0000000000b1","notes":"x"}]')$q$, 'was not found');
-- Nor insert for him.
SELECT public.expect_error($q$SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000b', '2026-09-21', true,
  '[{"op":"insert","clocked_in_at":"2026-09-21T20:00:00Z","clocked_out_at":"2026-09-21T21:00:00Z","notes":"x"}]')$q$, 'row-level security');
-- A lead (Cal) may update a member's row but — as today — not insert one.
SELECT set_config('bed.uid', '00000000-0000-0000-0000-00000000000c', false);
SELECT set_config('bed.lead', 'on', false);
SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000b', '2026-09-21', true,
  '[{"op":"update_notes","id":"10000000-0000-0000-0000-0000000000b1","notes":"by lead"}]');
SELECT public.expect_error($q$SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000b', '2026-09-21', true,
  '[{"op":"insert","clocked_in_at":"2026-09-21T20:00:00Z","clocked_out_at":"2026-09-21T21:00:00Z","notes":"x"}]')$q$, 'row-level security');
-- A lead naming the wrong person for a row is refused.
SELECT public.expect_error($q$SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', true,
  '[{"op":"update_notes","id":"10000000-0000-0000-0000-0000000000b1","notes":"x"}]')$q$, 'belongs to someone else');
SELECT set_config('bed.lead', '', false);
-- Pay access (Dee) may insert for Ben.
SELECT set_config('bed.uid', '00000000-0000-0000-0000-00000000000d', false);
SELECT set_config('bed.pay', 'on', false);
SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000b', '2026-09-21', true,
  '[{"op":"insert","clocked_in_at":"2026-09-21T22:00:00Z","clocked_out_at":"2026-09-21T23:00:00Z","notes":"by payroll"}]');
SELECT set_config('bed.pay', '', false);
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT notes FROM clock_sessions WHERE id = '10000000-0000-0000-0000-0000000000b1') = 'by lead', '8: lead updated';
  ASSERT (SELECT count(*) FROM clock_sessions WHERE user_id = '00000000-0000-0000-0000-00000000000b' AND notes = 'by payroll') = 1, '8: payroll inserted';
  ASSERT (SELECT count(*) FROM clock_sessions WHERE notes = 'x') = 0, '8: nothing refused was written';
END $$;

-- ---------------------------------------------------------------- 9. two approved rows move: the day is resynced once, to the right sum
SET ROLE authenticated;
SELECT set_config('bed.uid', '00000000-0000-0000-0000-00000000000a', false);
SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', false,
  '[{"op":"update_times","id":"10000000-0000-0000-0000-0000000000a1","clocked_in_at":"2026-09-21T13:00:00Z","clocked_out_at":"2026-09-21T15:30:00Z","notes":"framing"},
    {"op":"update_times","id":"10000000-0000-0000-0000-0000000000a2","clocked_in_at":"2026-09-21T15:30:00Z","clocked_out_at":"2026-09-21T17:00:00Z","notes":"trim"}]');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT hours FROM people_hours WHERE person_name = 'Ana Worker') = 4, '9: 2.5 + 1.5';
END $$;

-- ---------------------------------------------------------------- 10. refusals before any write
SET ROLE authenticated;
SELECT public.expect_error($q$SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', false, '[{"op":"delete","id":"10000000-0000-0000-0000-0000000000a1"}]')$q$, 'unknown write');
SELECT public.expect_error($q$SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', false, '{"op":"insert"}')$q$, 'expected an array');
SELECT public.expect_error($q$SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', NULL, '[]')$q$, 'are required');
SELECT set_config('bed.uid', '', false);
SELECT public.expect_error($q$SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', false, '[]')$q$, 'Not authenticated');
RESET ROLE;
SET ROLE anon;
SELECT public.expect_error($q$SELECT public.save_my_time_day('00000000-0000-0000-0000-00000000000a', '2026-09-21', false, '[]')$q$, 'permission denied');
RESET ROLE;

SELECT 'save_my_time_day PASSED' AS result;
