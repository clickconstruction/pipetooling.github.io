-- Engagement history (20261113090000, punch list #315): what a person was to the company over time. Here: the one
-- door records a stretch, changes the capacity (the running stretch ends the day before, the new one starts on the
-- day), closes and withdraws; a dry run writes nothing and answers in words that are the same on every run; two live
-- stretches of a person never share a day; a stretch is what it was when made; who may read and write (a dev through
-- the door; an estimator nothing; nobody the table directly). Made-up people and words. Fixtures made as postgres; the
-- door runs as signed-in users through RLS, inside one transaction that rolls back. Raises on the first failed
-- assertion; ends with "person_engagements PASSED". See scripts/pgtest-person-engagements.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA peng;
CREATE FUNCTION peng.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION peng.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION peng.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- What the bed reads past RLS: a person's stretches as "kind first..last[ withdrawn]", oldest first.
CREATE FUNCTION peng.rows(p_person uuid) RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(string_agg(e.kind || ' ' || e.started_on || '..' || COALESCE(e.ended_on::text, 'open') || CASE WHEN e.withdrawn_at IS NOT NULL THEN ' withdrawn' ELSE '' END, ' | ' ORDER BY e.started_on, e.created_at, e.id), 'none')
  FROM public.person_engagements e WHERE e.person_id = p_person $$;
-- A reply's changes and standing, in a few words.
CREATE FUNCTION peng.plan(r jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE((SELECT string_agg((x->>'op') || ' ' || (x->>'kind') || ' ' || (x->>'started_on') || '..' || COALESCE(x->>'ended_on', 'open'), ', ' ORDER BY ord) FROM jsonb_array_elements(r->'changes') WITH ORDINALITY AS t(x, ord)), 'no changes')
      || ' / standing ' || COALESCE((SELECT string_agg((x->>'kind') || ' ' || (x->>'started_on') || '..' || COALESCE(x->>'ended_on', 'open'), ', ' ORDER BY ord) FROM jsonb_array_elements(r->'standing') WITH ORDINALITY AS t(x, ord)), 'none') $$;
GRANT USAGE ON SCHEMA peng TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA peng TO authenticated;

-- Who: a dev and an estimator.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000981d1', 'dev@engagements.test'),
  ('00000000-0000-0000-0000-0000000981d2', 'estimator@engagements.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000981d1', 'dev@engagements.test', 'Standing Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000981d2', 'estimator@engagements.test', 'Standing Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.people (id, master_user_id, kind, name) VALUES
  ('00000000-0000-0000-0000-0000000981b1', '00000000-0000-0000-0000-0000000981d1', 'helper', 'Pat Sample'),
  ('00000000-0000-0000-0000-0000000981b2', '00000000-0000-0000-0000-0000000981d1', 'helper', 'Sam Sample');

-- ── as the dev, through the door ─────────────────────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT peng.as_user('00000000-0000-0000-0000-0000000981d1');

-- A dry run is the default: it answers what would be written and writes nothing.
SELECT peng.same('a dry run names the stretch it would record',
  peng.plan(public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","open":{"kind":"employee","started_on":"2025-03-03","source":"contract","source_ref":"the hire form"}}'::jsonb)),
  'open employee 2025-03-03..open / standing employee 2025-03-03..open');
SELECT peng.same('and writes nothing', peng.rows('00000000-0000-0000-0000-0000000981b1'), 'none');
SELECT peng.same('a dry run answers the same words twice, so a plan and its apply hash alike',
  public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","open":{"kind":"employee","started_on":"2025-03-03","source":"contract"}}'::jsonb)::text,
  public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","open":{"kind":"employee","started_on":"2025-03-03","source":"contract"}}'::jsonb)::text);

-- The write.
SELECT peng.same('open records the stretch',
  peng.plan(public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","open":{"kind":"employee","started_on":"2025-03-03","source":"contract","source_ref":"the hire form","note":"Made up."}}'::jsonb, false)),
  'open employee 2025-03-03..open / standing employee 2025-03-03..open');
SELECT peng.same('the stretch is on file', peng.rows('00000000-0000-0000-0000-0000000981b1'), 'employee 2025-03-03..open');
SELECT peng.same('the dev reads it through RLS, named as its author',
  (SELECT e.author_label || ' ' || e.source || ' ' || e.source_ref FROM public.person_engagements e WHERE e.person_id = '00000000-0000-0000-0000-0000000981b1'),
  'Standing Dev contract the hire form');

-- A change of capacity: the running stretch ends the day before, the new one starts on the day.
SELECT peng.same('change closes the running stretch the day before and opens the new kind',
  peng.plan(public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","change":{"kind":"subcontractor","on":"2025-09-01","source":"payroll"}}'::jsonb, false)),
  'close employee 2025-03-03..2025-08-31, open subcontractor 2025-09-01..open / standing employee 2025-03-03..2025-08-31, subcontractor 2025-09-01..open');
SELECT peng.refused('a change to the kind already running',
  $q$SELECT public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","change":{"kind":"subcontractor","on":"2025-10-01","source":"payroll"}}'::jsonb, false)$q$,
  'already subcontractor');
SELECT peng.refused('a change on or before the running stretch''s first day',
  $q$SELECT public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","change":{"kind":"employee","on":"2025-09-01","source":"payroll"}}'::jsonb, false)$q$,
  'on or before the running stretch');

-- Two live stretches never share a day.
SELECT peng.refused('a stretch over days another holds',
  $q$SELECT public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","open":{"kind":"employee","started_on":"2025-08-31","ended_on":"2025-08-31","source":"record"}}'::jsonb, false)$q$,
  'overlap');
SELECT peng.refused('a stretch with no last day, under one that runs',
  $q$SELECT public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","open":{"kind":"employee","started_on":"2024-01-01","source":"record"}}'::jsonb, false)$q$,
  'overlap');
SELECT peng.same('an earlier closed stretch that touches no other day is recorded',
  peng.plan(public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","open":{"kind":"subcontractor","started_on":"2024-06-01","ended_on":"2025-03-02","source":"owner"}}'::jsonb, false)),
  'open subcontractor 2024-06-01..2025-03-02 / standing subcontractor 2024-06-01..2025-03-02, employee 2025-03-03..2025-08-31, subcontractor 2025-09-01..open');

-- Close, then the bad shapes.
SELECT peng.refused('a last day before the first day',
  $q$SELECT public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","close":{"ended_on":"2025-08-01"}}'::jsonb, false)$q$,
  'before the stretch');
SELECT peng.same('close ends the running stretch on the day',
  peng.plan(public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","close":{"ended_on":"2026-01-31"}}'::jsonb, false)),
  'close subcontractor 2025-09-01..2026-01-31 / standing subcontractor 2024-06-01..2025-03-02, employee 2025-03-03..2025-08-31, subcontractor 2025-09-01..2026-01-31');
SELECT peng.refused('a close with nothing running',
  $q$SELECT public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","close":{"ended_on":"2026-02-01"}}'::jsonb, false)$q$,
  'no stretch is running');
SELECT peng.refused('a kind the list does not hold',
  $q$SELECT public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","open":{"kind":"partner","started_on":"2026-03-01","source":"owner"}}'::jsonb, false)$q$,
  'employee or subcontractor');
SELECT peng.refused('a stretch with no source',
  $q$SELECT public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","open":{"kind":"employee","started_on":"2026-03-01"}}'::jsonb, false)$q$,
  'where the fact comes from');
SELECT peng.refused('two things named at once',
  $q$SELECT public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","open":{"kind":"employee","started_on":"2026-03-01","source":"owner"},"close":{"ended_on":"2026-03-02"}}'::jsonb, false)$q$,
  'exactly one');
SELECT peng.refused('a person who is not on the roster',
  $q$SELECT public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981bf","open":{"kind":"employee","started_on":"2026-03-01","source":"owner"}}'::jsonb, false)$q$,
  'not found');

-- Withdraw: a stretch made by mistake comes off with its reason, stays on the table, and frees its days.
SELECT peng.refused('a withdrawal with no reason',
  format($q$SELECT public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","withdraw":{"id":"%s","why":" "}}'::jsonb, false)$q$,
    (SELECT e.id FROM public.person_engagements e WHERE e.person_id = '00000000-0000-0000-0000-0000000981b1' AND e.started_on = '2024-06-01')),
  'needs why');
SELECT peng.same('withdraw takes the stretch off the standing',
  peng.plan(public.dev_engagement_write(jsonb_build_object('person_id', '00000000-0000-0000-0000-0000000981b1', 'withdraw', jsonb_build_object('id', (SELECT e.id FROM public.person_engagements e WHERE e.person_id = '00000000-0000-0000-0000-0000000981b1' AND e.started_on = '2024-06-01'), 'why', 'Made up: the wrong year.')), false)),
  'withdraw subcontractor 2024-06-01..2025-03-02 / standing employee 2025-03-03..2025-08-31, subcontractor 2025-09-01..2026-01-31');
SELECT peng.same('the row stays, stamped', peng.rows('00000000-0000-0000-0000-0000000981b1'),
  'subcontractor 2024-06-01..2025-03-02 withdrawn | employee 2025-03-03..2025-08-31 | subcontractor 2025-09-01..2026-01-31');
SELECT peng.refused('a second withdrawal of the same stretch',
  format($q$SELECT public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","withdraw":{"id":"%s","why":"again"}}'::jsonb, false)$q$,
    (SELECT e.id FROM public.person_engagements e WHERE e.person_id = '00000000-0000-0000-0000-0000000981b1' AND e.started_on = '2024-06-01')),
  'withdrawn already');
SELECT peng.refused('a stretch named from another person''s file',
  format($q$SELECT public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b2","withdraw":{"id":"%s","why":"wrong file"}}'::jsonb, false)$q$,
    (SELECT e.id FROM public.person_engagements e WHERE e.person_id = '00000000-0000-0000-0000-0000000981b1' AND e.started_on = '2025-03-03')),
  'no such stretch');
SELECT peng.same('the days a withdrawn stretch held are free again',
  peng.plan(public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","open":{"kind":"employee","started_on":"2024-06-01","ended_on":"2025-03-02","source":"record"}}'::jsonb, false)),
  'open employee 2024-06-01..2025-03-02 / standing employee 2024-06-01..2025-03-02, employee 2025-03-03..2025-08-31, subcontractor 2025-09-01..2026-01-31');

-- The table itself: a dev reads, and nobody writes it directly.
SELECT peng.refused('a dev inserting straight into the table',
  $q$INSERT INTO public.person_engagements (person_id, kind, started_on, source) VALUES ('00000000-0000-0000-0000-0000000981b2', 'employee', '2026-01-01', 'owner')$q$,
  'permission denied');
SELECT peng.refused('a dev updating the table',
  $q$UPDATE public.person_engagements SET note = 'changed' WHERE person_id = '00000000-0000-0000-0000-0000000981b1'$q$,
  'permission denied');
SELECT peng.refused('a dev deleting from the table',
  $q$DELETE FROM public.person_engagements WHERE person_id = '00000000-0000-0000-0000-0000000981b1'$q$,
  'permission denied');

-- ── as an estimator: nothing ─────────────────────────────────────────────────────────────────────
SELECT peng.as_user('00000000-0000-0000-0000-0000000981d2');
SELECT peng.same('an estimator reads no stretch', (SELECT count(*)::text FROM public.person_engagements), '0');
SELECT peng.refused('an estimator at the door',
  $q$SELECT public.dev_engagement_write('{"person_id":"00000000-0000-0000-0000-0000000981b1","close":{"ended_on":"2026-02-01"}}'::jsonb)$q$,
  'devs only');
RESET ROLE;

-- ── the guard, past the door (as the table's owner) ──────────────────────────────────────────────
SELECT peng.refused('a stretch reworded after it was made',
  $q$UPDATE public.person_engagements SET kind = 'subcontractor' WHERE person_id = '00000000-0000-0000-0000-0000000981b1' AND started_on = '2025-03-03'$q$,
  'what it was when made');
SELECT peng.refused('a closed stretch given another last day',
  $q$UPDATE public.person_engagements SET ended_on = '2025-09-15' WHERE person_id = '00000000-0000-0000-0000-0000000981b1' AND started_on = '2025-03-03'$q$,
  'keeps its last day');
SELECT peng.refused('a withdrawn stretch brought back',
  $q$UPDATE public.person_engagements SET withdrawn_at = NULL, withdrawn_why = NULL WHERE person_id = '00000000-0000-0000-0000-0000000981b1' AND withdrawn_at IS NOT NULL$q$,
  'stays withdrawn');
SELECT peng.refused('an overlap written past the door',
  $q$INSERT INTO public.person_engagements (person_id, kind, started_on, ended_on, source) VALUES ('00000000-0000-0000-0000-0000000981b1', 'employee', '2025-08-01', '2025-09-30', 'other')$q$,
  'overlap');
SELECT peng.refused('a last day before the first, past the door',
  $q$INSERT INTO public.person_engagements (person_id, kind, started_on, ended_on, source) VALUES ('00000000-0000-0000-0000-0000000981b2', 'employee', '2025-08-01', '2025-07-01', 'other')$q$,
  'person_engagements_days_in_order');
SELECT peng.refused('a withdrawal stamp with no reason, past the door',
  $q$UPDATE public.person_engagements SET withdrawn_at = now() WHERE person_id = '00000000-0000-0000-0000-0000000981b1' AND started_on = '2025-03-03'$q$,
  'person_engagements_withdrawn_with_why');
SELECT peng.same('another person''s file is its own', peng.rows('00000000-0000-0000-0000-0000000981b2'), 'none');

DO $$ BEGIN RAISE NOTICE 'person_engagements PASSED'; END $$;
ROLLBACK;
