-- The register of sub papers (migration *_sub_papers, punch list #350): a paper is registered through mint_sub_paper
-- and nowhere else, a number is never given out twice, a change is a revision under the same number, a reprint makes
-- nothing, and only the office roles who see sub pay read the register. Fixtures are written as postgres; each press
-- runs as its user; everything rolls back. Raises on the first failed assertion; ends with "sub_papers PASSED". See
-- scripts/pgtest-sub-papers.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Devon is a dev, the office. Priya estimates and is not office staff. Tara is an assistant in training (read only).
-- Pat Sub is the sheets' one person. Every name and figure is made up.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000350a0a1', 'devon@subpapers.test'),
  ('00000000-0000-0000-0000-00000350a0a2', 'priya@subpapers.test'),
  ('00000000-0000-0000-0000-00000350a0a3', 'tara@subpapers.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at) VALUES
  ('00000000-0000-0000-0000-00000350a0a1', 'devon@subpapers.test', 'Devon Dev', 'dev', false, false, false, NULL),
  ('00000000-0000-0000-0000-00000350a0a2', 'priya@subpapers.test', 'Priya Estimator', 'estimator', false, false, false, NULL),
  ('00000000-0000-0000-0000-00000350a0a3', 'tara@subpapers.test', 'Tara Trainee', 'assistant', true, false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at;
INSERT INTO public.people (id, master_user_id, kind, name) VALUES
  ('00000000-0000-0000-0000-00000350a0e1', '00000000-0000-0000-0000-00000350a0a1', 'sub', 'Pat Sub Paperbed');
-- Two sheets on job 2041, one sheet with no job number, and a third on 2041 made later to be deleted.
INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name, job_number) VALUES
  ('00000000-0000-0000-0000-00000350a0b1', '00000000-0000-0000-0000-00000350a0a1', 'Pat Sub Paperbed', '2041'),
  ('00000000-0000-0000-0000-00000350a0b2', '00000000-0000-0000-0000-00000350a0a1', 'Pat Sub Paperbed', ' 2041 '),
  ('00000000-0000-0000-0000-00000350a0b3', '00000000-0000-0000-0000-00000350a0a1', 'Pat Sub Paperbed', NULL),
  ('00000000-0000-0000-0000-00000350a0b4', '00000000-0000-0000-0000-00000350a0a1', 'Pat Sub Paperbed', '2041');
-- One sending with its own number, a payment on it, and a payment recorded before sendings.
INSERT INTO public.sub_payment_sendings (id, person_id) VALUES
  ('00000000-0000-0000-0000-00000350a0d1', '00000000-0000-0000-0000-00000350a0e1');
INSERT INTO public.people_labor_job_payments (id, job_id, amount, sequence_order, payment_date, method, sending_id) VALUES
  ('00000000-0000-0000-0000-00000350a0c1', '00000000-0000-0000-0000-00000350a0b1', 100, 0, '2026-10-01', 'check', '00000000-0000-0000-0000-00000350a0d1'),
  ('00000000-0000-0000-0000-00000350a0c2', '00000000-0000-0000-0000-00000350a0b1', 40, 1, '2026-09-01', 'check', NULL),
  ('00000000-0000-0000-0000-00000350a0c3', '00000000-0000-0000-0000-00000350a0b1', 30, 2, '2026-09-02', 'check', NULL);

CREATE SCHEMA spb;
CREATE FUNCTION spb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION spb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION spb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- One mint, as one line: the number, the revision and whether the row was already there.
CREATE FUNCTION spb.mint(p_kind text, p_print text, p_sheet uuid DEFAULT NULL, p_sending uuid DEFAULT NULL, p_payment uuid DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', m.number, m.revision, m.reused::text)
  FROM public.mint_sub_paper(p_kind, '00000000-0000-0000-0000-00000350a0e1', jsonb_build_object('kind', p_kind, 'print', p_print), p_print, p_sheet, p_sending, p_payment, NULL, NULL, 100, 60) AS m
$$;
GRANT USAGE ON SCHEMA spb TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA spb TO authenticated, anon;

-- 0 · The tables are fenced, and the two functions are a signed-in login's to call.
SELECT spb.same('the three tables hold their rows behind policies',
  (SELECT string_agg(relname || ':' || relrowsecurity::text, ',' ORDER BY relname) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname IN ('sub_papers', 'sub_paper_acks', 'sub_paper_job_counters')),
  'sub_paper_acks:true,sub_paper_job_counters:true,sub_papers:true');
SELECT spb.same('a signed-in login may mint', has_function_privilege('authenticated', 'public.mint_sub_paper(text, uuid, jsonb, text, uuid, uuid, uuid, date, date, numeric, numeric)', 'EXECUTE')::text, 'true');
SELECT spb.same('nobody signed out may mint', has_function_privilege('anon', 'public.mint_sub_paper(text, uuid, jsonb, text, uuid, uuid, uuid, date, date, numeric, numeric)', 'EXECUTE')::text, 'false');
SELECT spb.same('nobody signed out may void', has_function_privilege('anon', 'public.void_sub_paper(uuid, text)', 'EXECUTE')::text, 'false');

-- 1 · Who may not: an estimator, and an assistant in training.
SELECT spb.as_user('00000000-0000-0000-0000-00000350a0a2');
SET LOCAL ROLE authenticated;
SELECT spb.refused('Priya''s mint', $q$SELECT spb.mint('statement_of_account', 'a')$q$, 'Only the office roles');
RESET ROLE;
SELECT spb.as_user('00000000-0000-0000-0000-00000350a0a3');
SET LOCAL ROLE authenticated;
SELECT spb.refused('Tara''s mint in training', $q$SELECT spb.mint('statement_of_account', 'a')$q$, 'A training account cannot make a sub paper');
RESET ROLE;

-- 2 · Each refusal, as Devon, with its reason. None of them takes a number.
SELECT spb.as_user('00000000-0000-0000-0000-00000350a0a1');
SET LOCAL ROLE authenticated;
SELECT spb.refused('a kind nobody knows', $q$SELECT spb.mint('invoice', 'a')$q$, 'Unknown paper kind');
SELECT spb.refused('a paper with no paper', $q$SELECT * FROM public.mint_sub_paper('statement_of_account', NULL, '[]'::jsonb, 'a')$q$, 'registered with the paper itself');
SELECT spb.refused('a work statement with no sheet', $q$SELECT spb.mint('work_statement', 'a')$q$, 'A work statement is for one sheet');
SELECT spb.refused('a work statement for a sheet that is gone', $q$SELECT spb.mint('work_statement', 'a', '00000000-0000-0000-0000-00000350a0ff')$q$, 'That sheet is gone');
SELECT spb.refused('a payment record for nothing', $q$SELECT spb.mint('payment_record', 'a')$q$, 'A payment record is for one sending');
RESET ROLE;
SELECT spb.same('the refusals registered nothing and took no number',
  concat_ws('|', (SELECT count(*) FROM public.sub_papers), (SELECT count(*) FROM public.sub_paper_job_counters)), '0|0');

-- 3 · Work statements. The first paper of a sheet takes the job's next number. A reprint makes nothing. A change
--     is revision 2 under the same number, and the copy it replaces points at it.
SET LOCAL ROLE authenticated;
SELECT spb.same('sheet 1, first paper', spb.mint('work_statement', 'v1', '00000000-0000-0000-0000-00000350a0b1'), 'WS-2041-1|1|false');
SELECT spb.same('sheet 1, printed again unchanged', spb.mint('work_statement', 'v1', '00000000-0000-0000-0000-00000350a0b1'), 'WS-2041-1|1|true');
SELECT spb.same('sheet 1, after a back-charge', spb.mint('work_statement', 'v2', '00000000-0000-0000-0000-00000350a0b1'), 'WS-2041-1|2|false');
SELECT spb.same('sheet 2, same job, typed with spaces', spb.mint('work_statement', 'v1', '00000000-0000-0000-0000-00000350a0b2'), 'WS-2041-2|1|false');
SELECT spb.same('a sheet with no job number', spb.mint('work_statement', 'v1', '00000000-0000-0000-0000-00000350a0b3'), 'WS-0-1|1|false');
SELECT spb.same('sheet 4, same job', spb.mint('work_statement', 'v1', '00000000-0000-0000-0000-00000350a0b4'), 'WS-2041-3|1|false');
RESET ROLE;
SELECT spb.same('sheet 1 holds two copies, and the first points at the second',
  (SELECT string_agg(concat_ws(':', a.revision, COALESCE(b.revision::text, 'current')), ',' ORDER BY a.revision)
   FROM public.sub_papers a LEFT JOIN public.sub_papers b ON b.id = a.replaced_by
   WHERE a.labor_job_id = '00000000-0000-0000-0000-00000350a0b1'), '1:2,2:current');
SELECT spb.same('each copy keeps the paper as issued, who issued it and its figures',
  (SELECT string_agg(concat_ws(':', snapshot->>'print', issued_by_name, comes_to, still_open), ',' ORDER BY revision)
   FROM public.sub_papers WHERE labor_job_id = '00000000-0000-0000-0000-00000350a0b1'), 'v1:Devon Dev:100.00:60.00,v2:Devon Dev:100.00:60.00');

-- 4 · A deleted sheet's number is not given to another. Sheet 4 goes; its row stays with its number, and the next
--     sheet on the job takes the number after it.
DELETE FROM public.people_labor_jobs WHERE id = '00000000-0000-0000-0000-00000350a0b4';
SELECT spb.same('the deleted sheet''s paper stays, with its number and no sheet',
  (SELECT concat_ws('|', count(*), bool_and(labor_job_id IS NULL)::text) FROM public.sub_papers WHERE number = 'WS-2041-3'), '1|true');
INSERT INTO public.people_labor_jobs (id, master_user_id, assigned_to_name, job_number) VALUES
  ('00000000-0000-0000-0000-00000350a0b5', '00000000-0000-0000-0000-00000350a0a1', 'Pat Sub Paperbed', '2041');
SET LOCAL ROLE authenticated;
SELECT spb.same('a new sheet on the job takes the next number', spb.mint('work_statement', 'v1', '00000000-0000-0000-0000-00000350a0b5'), 'WS-2041-4|1|false');

-- 5 · Payment records. A sending's record carries the sending's own number. A payment recorded before sendings
--     has no number, and two of those do not collide.
SELECT spb.same('a sending''s record carries its number',
  spb.mint('payment_record', 'v1', NULL, '00000000-0000-0000-0000-00000350a0d1'),
  (SELECT 'PR-' || lpad(number::text, 4, '0') || '|1|false' FROM public.sub_payment_sendings WHERE id = '00000000-0000-0000-0000-00000350a0d1'));
SELECT spb.same('printed again unchanged', split_part(spb.mint('payment_record', 'v1', NULL, '00000000-0000-0000-0000-00000350a0d1'), '|', 3), 'true');
SELECT spb.same('a payment from before sendings has no number', spb.mint('payment_record', 'v1', NULL, NULL, '00000000-0000-0000-0000-00000350a0c2'), '|1|false');
SELECT spb.same('and a second one does not collide', spb.mint('payment_record', 'v1', NULL, NULL, '00000000-0000-0000-0000-00000350a0c3'), '|1|false');
SELECT spb.same('its own reprint is the same row', spb.mint('payment_record', 'v1', NULL, NULL, '00000000-0000-0000-0000-00000350a0c2'), '|1|true');

-- 6 · A statement of account is always a new paper with the next number, though nothing on it changed.
SELECT spb.same('a statement of account is new and numbered SA-nnnn',
  (SELECT (split_part(x.line, '|', 1) ~ '^SA-[0-9]{4,}$')::text || ':' || split_part(x.line, '|', 3) FROM (SELECT spb.mint('statement_of_account', 'same') AS line) x), 'true:false');
SELECT spb.same('the same statement made again is new too',
  (SELECT (split_part(x.line, '|', 1) ~ '^SA-[0-9]{4,}$')::text || ':' || split_part(x.line, '|', 3) FROM (SELECT spb.mint('statement_of_account', 'same') AS line) x), 'true:false');
RESET ROLE;
SELECT spb.same('two statements are registered, and the second number follows the first',
  (SELECT concat_ws('|', count(*), max(substr(number, 4)::int) - min(substr(number, 4)::int)) FROM public.sub_papers WHERE kind = 'statement_of_account'), '2|1');

-- 7 · Void. It needs a reason, the paper keeps its number, and the sheet's next paper takes a new one.
SET LOCAL ROLE authenticated;
SELECT spb.refused('a void with no reason', $q$SELECT public.void_sub_paper((SELECT id FROM public.sub_papers WHERE number = 'WS-2041-2'), '  ')$q$, 'Say why the paper is void');
SELECT public.void_sub_paper((SELECT id FROM public.sub_papers WHERE number = 'WS-2041-2'), ' made on the wrong sheet ');
SELECT spb.same('the voided paper keeps its number and its reason',
  (SELECT concat_ws('|', number, (voided_at IS NOT NULL)::text, void_reason) FROM public.sub_papers WHERE labor_job_id = '00000000-0000-0000-0000-00000350a0b2'), 'WS-2041-2|true|made on the wrong sheet');
SELECT spb.same('the sheet''s next paper takes a new number', spb.mint('work_statement', 'v1', '00000000-0000-0000-0000-00000350a0b2'), 'WS-2041-5|1|false');
RESET ROLE;
SELECT spb.as_user('00000000-0000-0000-0000-00000350a0a3');
SET LOCAL ROLE authenticated;
SELECT spb.refused('Tara''s void in training', $q$SELECT public.void_sub_paper('00000000-0000-0000-0000-00000350a0ff', 'x')$q$, 'A training account cannot void a sub paper');
RESET ROLE;

-- 8 · No number was given out twice.
SELECT spb.same('every numbered copy is one of a kind',
  (SELECT count(*)::text FROM (SELECT kind, number, revision FROM public.sub_papers WHERE number <> '' GROUP BY 1, 2, 3 HAVING count(*) > 1) d), '0');
SELECT spb.same('the job''s counter stands at the last number given', (SELECT string_agg(job_key || ':' || last_n, ',' ORDER BY job_key) FROM public.sub_paper_job_counters), '0:1,2041:5');

-- 9 · Who reads and who writes. The office reads the register. An estimator reads nothing. Nobody types a row.
SELECT spb.as_user('00000000-0000-0000-0000-00000350a0a1');
SET LOCAL ROLE authenticated;
SELECT spb.same('Devon reads the register', (SELECT (count(*) > 0)::text FROM public.sub_papers), 'true');
SELECT spb.same('no login reads or writes a counter', has_table_privilege('authenticated', 'public.sub_paper_job_counters', 'SELECT, INSERT, UPDATE, DELETE')::text, 'false');
SELECT spb.refused('Devon typing a row by hand', $q$INSERT INTO public.sub_papers (kind, number, snapshot) VALUES ('work_statement', 'WS-9-9', '{}'::jsonb)$q$, 'permission denied');
SELECT spb.refused('Devon changing a number by hand', $q$UPDATE public.sub_papers SET number = 'WS-9-9'$q$, 'permission denied');
SELECT spb.refused('Devon typing what a sub said back', $q$INSERT INTO public.sub_paper_acks (paper_id, kind, revision) SELECT id, 'confirmed', 1 FROM public.sub_papers LIMIT 1$q$, 'permission denied');
RESET ROLE;
SELECT spb.as_user('00000000-0000-0000-0000-00000350a0a2');
SET LOCAL ROLE authenticated;
SELECT spb.same('Priya reads nothing', concat_ws('|', (SELECT count(*) FROM public.sub_papers), (SELECT count(*) FROM public.sub_paper_acks)), '0|0');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'sub_papers PASSED'; END $$;
ROLLBACK;
