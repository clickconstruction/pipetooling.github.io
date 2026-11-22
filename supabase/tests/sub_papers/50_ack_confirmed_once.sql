-- A work statement is confirmed once per copy (migration *_sub_paper_confirm_once, punch list #350): a second confirm
-- of the same copy is refused by its index; the next revision is another copy and takes its own confirm; a note that
-- something is wrong on the same copy is not a confirm and is kept; a confirm stays when its copy is voided. Fixtures
-- are written as postgres; everything rolls back. Raises on the first failed assertion; ends with
-- "sub_paper_confirm_once PASSED". See scripts/pgtest-sub-papers.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Devon is a dev, the office. Pat Sub is the sheet's one person. Every name and figure is made up.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000350c0a1', 'devon@subconfirm.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at) VALUES
  ('00000000-0000-0000-0000-00000350c0a1', 'devon@subconfirm.test', 'Devon Dev', 'dev', false, false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at;
INSERT INTO public.people (id, master_user_id, kind, name) VALUES
  ('00000000-0000-0000-0000-00000350c0e1', '00000000-0000-0000-0000-00000350c0a1', 'sub', 'Pat Sub Confirmbed');
INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name, job_number) VALUES
  ('00000000-0000-0000-0000-00000350c0b1', '00000000-0000-0000-0000-00000350c0a1', 'Pat Sub Confirmbed', '2077');
-- The office's copy of the sheet's work statement, and the copy made after the sheet changed.
INSERT INTO public.sub_papers (id, kind, number, revision, person_id, labor_job_id, snapshot, fingerprint, comes_to) VALUES
  ('00000000-0000-0000-0000-00000350c0d1', 'work_statement', 'WS-2077-1', 1, '00000000-0000-0000-0000-00000350c0e1', '00000000-0000-0000-0000-00000350c0b1', '{}'::jsonb, 'first', 900),
  ('00000000-0000-0000-0000-00000350c0d2', 'work_statement', 'WS-2077-1', 2, '00000000-0000-0000-0000-00000350c0e1', '00000000-0000-0000-0000-00000350c0b1', '{}'::jsonb, 'second', 950);

CREATE SCHEMA sco;
CREATE FUNCTION sco.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION sco.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- The service role calls the helpers: it is who the sub-portal function writes as.
GRANT USAGE ON SCHEMA sco TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sco TO service_role;

-- 1 · The index is there, unique, and only over the confirms that name a copy.
SELECT sco.same('the index holds one confirm per copy',
  (SELECT (indexdef LIKE 'CREATE UNIQUE INDEX %(paper_id)%confirmed%paper_id IS NOT NULL%')::text FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = 'sub_paper_acks_confirmed_paper_key'),
  'true');

-- 2 · The sub-portal function writes with the service key. The first confirm of a copy is kept, the second refused.
SET LOCAL ROLE service_role;
INSERT INTO public.sub_paper_acks (kind, person_id, labor_job_id, paper_id, revision, amount, said_by_name)
  VALUES ('confirmed', '00000000-0000-0000-0000-00000350c0e1', '00000000-0000-0000-0000-00000350c0b1', '00000000-0000-0000-0000-00000350c0d1', 1, 900, 'Pat Sub Confirmbed');
SELECT sco.refused('a second confirm of the same copy',
  $q$INSERT INTO public.sub_paper_acks (kind, person_id, labor_job_id, paper_id, revision, amount) VALUES ('confirmed', '00000000-0000-0000-0000-00000350c0e1', '00000000-0000-0000-0000-00000350c0b1', '00000000-0000-0000-0000-00000350c0d1', 1, 900)$q$,
  'sub_paper_acks_confirmed_paper_key');

-- 3 · The next revision is another copy, and takes its own confirm once.
INSERT INTO public.sub_paper_acks (kind, person_id, labor_job_id, paper_id, revision, amount)
  VALUES ('confirmed', '00000000-0000-0000-0000-00000350c0e1', '00000000-0000-0000-0000-00000350c0b1', '00000000-0000-0000-0000-00000350c0d2', 2, 950);
SELECT sco.refused('a second confirm of the next revision',
  $q$INSERT INTO public.sub_paper_acks (kind, person_id, labor_job_id, paper_id, revision, amount) VALUES ('confirmed', '00000000-0000-0000-0000-00000350c0e1', '00000000-0000-0000-0000-00000350c0b1', '00000000-0000-0000-0000-00000350c0d2', 2, 950)$q$,
  'sub_paper_acks_confirmed_paper_key');

-- 4 · A note that something is wrong is not a confirm: it is kept on the same copy, and again.
INSERT INTO public.sub_paper_acks (kind, person_id, labor_job_id, paper_id, revision, amount, note) VALUES
  ('something_wrong', '00000000-0000-0000-0000-00000350c0e1', '00000000-0000-0000-0000-00000350c0b1', '00000000-0000-0000-0000-00000350c0d1', 1, 900, 'The rate is not what we agreed.'),
  ('something_wrong', '00000000-0000-0000-0000-00000350c0e1', '00000000-0000-0000-0000-00000350c0b1', '00000000-0000-0000-0000-00000350c0d1', 1, 900, 'Still waiting on an answer.');
RESET ROLE;
SELECT sco.same('two confirms and two notes are kept',
  (SELECT concat_ws('|', count(*) FILTER (WHERE kind = 'confirmed'), count(*) FILTER (WHERE kind = 'something_wrong'), count(DISTINCT paper_id) FILTER (WHERE kind = 'confirmed'))
   FROM public.sub_paper_acks WHERE person_id = '00000000-0000-0000-0000-00000350c0e1'), '2|2|2');

-- 5 · A voided copy keeps its confirm: the paper's row stays, so the answer does.
UPDATE public.sub_papers SET voided_at = now(), void_reason = 'made by mistake' WHERE id = '00000000-0000-0000-0000-00000350c0d1';
SELECT sco.same('the voided copy still holds its one confirm',
  (SELECT count(*)::text FROM public.sub_paper_acks WHERE kind = 'confirmed' AND paper_id = '00000000-0000-0000-0000-00000350c0d1'), '1');

DO $$ BEGIN RAISE NOTICE 'sub_paper_confirm_once PASSED'; END $$;
ROLLBACK;
