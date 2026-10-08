-- Scenario for reject_clock_session (v2.4964). Run after 00_schema.sql and the migration, as a
-- superuser; it uses its own day, so 20_scenario.sql may run before it or not at all. Each step
-- sets the caller with bed.uid and switches to the authenticated role so clock_sessions' RLS
-- applies. Ends with "reject_clock_session PASSED".
\set ON_ERROR_STOP 1
\c bed

-- Ana (…0a) worked 2026-09-28: r1 08–10, r2 10–11 and r4 14–15 approved, r3 12–13 pending.
-- people_hours holds Ana's approved 4 h.
INSERT INTO public.clock_sessions (id, user_id, clocked_in_at, clocked_out_at, work_date, approved_at, notes) VALUES
 ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '2026-09-28 13:00Z', '2026-09-28 15:00Z', '2026-09-28', '2026-09-29 00:00Z', 'r1'),
 ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', '2026-09-28 15:00Z', '2026-09-28 16:00Z', '2026-09-28', '2026-09-29 00:00Z', 'r2'),
 ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', '2026-09-28 17:00Z', '2026-09-28 18:00Z', '2026-09-28', NULL, 'r3'),
 ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', '2026-09-28 19:00Z', '2026-09-28 20:00Z', '2026-09-28', '2026-09-29 00:00Z', 'r4');
INSERT INTO public.people_hours (person_name, work_date, hours) VALUES ('Ana Worker', '2026-09-28', 4);

-- expect_error(sql, fragment): the call must fail with a message containing fragment (as in 20_scenario.sql).
CREATE OR REPLACE FUNCTION public.expect_error(p_sql text, p_fragment text) RETURNS void LANGUAGE plpgsql AS $$
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

-- ---------------------------------------------------------------- 1. a refused resync undoes the reject
-- Stand the resync in with one that refuses, as the browser's second request could.
ALTER FUNCTION public.recompute_people_hours_after_session_edit(uuid, date) RENAME TO recompute_real;
CREATE FUNCTION public.recompute_people_hours_after_session_edit(p_session_id uuid, p_old_work_date date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'resync refused';
END $$;
GRANT EXECUTE ON FUNCTION public.recompute_people_hours_after_session_edit(uuid, date) TO authenticated;
SET ROLE authenticated;
SELECT set_config('bed.uid', '00000000-0000-0000-0000-00000000000a', false);
SELECT public.expect_error($q$SELECT public.reject_clock_session('30000000-0000-0000-0000-000000000004')$q$, 'resync refused');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT rejected_at FROM clock_sessions WHERE notes = 'r4') IS NULL, '1: the reject was undone with the resync';
  ASSERT (SELECT hours FROM people_hours WHERE person_name = 'Ana Worker' AND work_date = '2026-09-28') = 4, '1: hours untouched';
END $$;
DROP FUNCTION public.recompute_people_hours_after_session_edit(uuid, date);
ALTER FUNCTION public.recompute_real(uuid, date) RENAME TO recompute_people_hours_after_session_edit;

-- ---------------------------------------------------------------- 2. her own approved session: rejected, and its hours leave payroll
SET ROLE authenticated;
SELECT set_config('bed.uid', '00000000-0000-0000-0000-00000000000a', false);
SELECT public.reject_clock_session('30000000-0000-0000-0000-000000000001');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT rejected_at FROM clock_sessions WHERE notes = 'r1') IS NOT NULL, '2: r1 rejected';
  ASSERT (SELECT rejected_by FROM clock_sessions WHERE notes = 'r1') = '00000000-0000-0000-0000-00000000000a', '2: by Ana';
  ASSERT (SELECT hours FROM people_hours WHERE person_name = 'Ana Worker' AND work_date = '2026-09-28') = 2, '2: r2 + r4';
END $$;

-- ---------------------------------------------------------------- 3. her own pending session: rejected; payroll was never counting it
SET ROLE authenticated;
SELECT set_config('bed.uid', '00000000-0000-0000-0000-00000000000a', false);
SELECT public.reject_clock_session('30000000-0000-0000-0000-000000000003');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT rejected_at FROM clock_sessions WHERE notes = 'r3') IS NOT NULL, '3: r3 rejected';
  ASSERT (SELECT hours FROM people_hours WHERE person_name = 'Ana Worker' AND work_date = '2026-09-28') = 2, '3: still 2';
END $$;

-- ---------------------------------------------------------------- 4. someone else cannot reach her row: refused, nothing written
SET ROLE authenticated;
SELECT set_config('bed.uid', '00000000-0000-0000-0000-00000000000b', false);
SELECT public.expect_error($q$SELECT public.reject_clock_session('30000000-0000-0000-0000-000000000002')$q$, 'that you can change');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT rejected_at FROM clock_sessions WHERE notes = 'r2') IS NULL, '4: r2 untouched';
  ASSERT (SELECT hours FROM people_hours WHERE person_name = 'Ana Worker' AND work_date = '2026-09-28') = 2, '4: still 2';
END $$;

-- ---------------------------------------------------------------- 5. her team lead rejects her approved session
SET ROLE authenticated;
SELECT set_config('bed.uid', '00000000-0000-0000-0000-00000000000c', false);
SELECT set_config('bed.lead', 'on', false);
SELECT public.reject_clock_session('30000000-0000-0000-0000-000000000002');
SELECT set_config('bed.lead', '', false);
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT rejected_by FROM clock_sessions WHERE notes = 'r2') = '00000000-0000-0000-0000-00000000000c', '5: by Cal';
  ASSERT (SELECT hours FROM people_hours WHERE person_name = 'Ana Worker' AND work_date = '2026-09-28') = 1, '5: r4 alone';
END $$;

-- ---------------------------------------------------------------- 6. refusals before any write
SET ROLE authenticated;
SELECT set_config('bed.uid', '00000000-0000-0000-0000-00000000000a', false);
SELECT public.expect_error($q$SELECT public.reject_clock_session(NULL)$q$, 'a session is required');
SELECT public.expect_error($q$SELECT public.reject_clock_session('30000000-0000-0000-0000-0000000000ff')$q$, 'that you can change');
SELECT set_config('bed.uid', '', false);
SELECT public.expect_error($q$SELECT public.reject_clock_session('30000000-0000-0000-0000-000000000004')$q$, 'Not authenticated');
RESET ROLE;
SET ROLE anon;
SELECT public.expect_error($q$SELECT public.reject_clock_session('30000000-0000-0000-0000-000000000004')$q$, 'permission denied');
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT rejected_at FROM clock_sessions WHERE notes = 'r4') IS NULL, '6: r4 untouched';
END $$;

SELECT 'reject_clock_session PASSED' AS result;
