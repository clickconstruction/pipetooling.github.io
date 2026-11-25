-- *It stands as printed*, and taken back (v2.8595, punch list #362 step 7): who may press, what is refused, what an
-- answer writes, the same press twice, a second difference beside the first, what taking back stamps, who reads the
-- rows, and that no one writes the table by hand. One transaction that rolls back; raises on the first failed
-- assertion; ends with "lien_print_stands PASSED". See scripts/pgtest-lien-print-stands.sh. Never against prod.
\set ON_ERROR_STOP on
BEGIN;

CREATE SCHEMA bedt;
GRANT USAGE ON SCHEMA bedt TO authenticated;
CREATE FUNCTION bedt.ok(label text, pass boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF pass IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION bedt.id(n text) RETURNS uuid LANGUAGE sql IMMUTABLE AS
  $$ SELECT ('00000000-0000-0000-0000-' || lpad(n, 12, '0'))::uuid $$;
CREATE FUNCTION bedt.as_user(n text) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claim.sub', CASE WHEN n = '' THEN '' ELSE bedt.id(n)::text END, true) $$;
CREATE FUNCTION bedt.live(job text, paper text) RETURNS bigint LANGUAGE sql AS
  $$ SELECT count(*) FROM public.lien_print_stands WHERE job_id = bedt.id(job) AND paper = $2 AND taken_back_at IS NULL $$;
-- What a signed-in person reads under the table's own policy.
CREATE FUNCTION bedt.seen() RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.lien_print_stands;
  RESET ROLE;
  RETURN n;
END $$;
-- One change in words, as the client sends it.
CREATE FUNCTION bedt.change(now_words text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS
  $$ SELECT jsonb_build_array(jsonb_build_object('key', 'unpaidAmount', 'label', 'The amount unpaid', 'printed', '$610.00', 'now', now_words)) $$;

INSERT INTO public.users (id, role) VALUES (bedt.id('1'), 'assistant'), (bedt.id('2'), 'technician'), (bedt.id('3'), 'master_technician'), (bedt.id('4'), 'controller'), (bedt.id('5'), 'dev'), (bedt.id('6'), 'estimator');
INSERT INTO public.jobs_ledger (id, hcp_number) VALUES (bedt.id('10'), 'ZZ10'), (bedt.id('11'), 'ZZ11');

-- 1 · Who may run the press, and who may touch the table.
SELECT bedt.ok('anon cannot run the press', NOT has_function_privilege('anon', 'public.set_lien_print_stands(uuid, text, boolean, text, jsonb, uuid)', 'EXECUTE'));
SELECT bedt.ok('a signed-in person can', has_function_privilege('authenticated', 'public.set_lien_print_stands(uuid, text, boolean, text, jsonb, uuid)', 'EXECUTE'));
SELECT bedt.ok('the function runs as its owner', (SELECT prosecdef FROM pg_proc WHERE proname = 'set_lien_print_stands'));
SELECT bedt.ok('row security is on', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.lien_print_stands'::regclass));
SELECT bedt.ok('a signed-in person may read the table and nothing else', has_table_privilege('authenticated', 'public.lien_print_stands', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.lien_print_stands', 'INSERT') AND NOT has_table_privilege('authenticated', 'public.lien_print_stands', 'UPDATE') AND NOT has_table_privilege('authenticated', 'public.lien_print_stands', 'DELETE'));
SELECT bedt.ok('anon may not read it', NOT has_table_privilege('anon', 'public.lien_print_stands', 'SELECT'));

-- 2 · What is refused, in words, with nothing written.
SELECT bedt.as_user('');
SELECT bedt.ok('nobody signed in is refused', public.set_lien_print_stands(bedt.id('10'), 'affidavit', true, 'affidavit:1:a', bedt.change('$310.00')) = '{"error": "Not authenticated"}'::jsonb);
SELECT bedt.as_user('2');
SELECT bedt.ok('a technician is refused', public.set_lien_print_stands(bedt.id('10'), 'affidavit', true, 'affidavit:1:a', bedt.change('$310.00')) = '{"error": "Not authorized to say a lien paper stands as printed"}'::jsonb);
SELECT bedt.as_user('6');
SELECT bedt.ok('an estimator is refused', public.set_lien_print_stands(bedt.id('10'), 'affidavit', true, 'affidavit:1:a', bedt.change('$310.00'))->>'error' = 'Not authorized to say a lien paper stands as printed');
SELECT bedt.as_user('1');
SELECT bedt.ok('a paper that is neither is refused', public.set_lien_print_stands(bedt.id('10'), 'release', true, 'k', bedt.change('$310.00'))->>'error' = 'The paper must be notice or affidavit');
SELECT bedt.ok('no answer is refused', public.set_lien_print_stands(bedt.id('10'), 'affidavit', NULL)->>'error' = 'Say whether the paper stands or the answer is taken back');
SELECT bedt.ok('a job that is not there is refused', public.set_lien_print_stands(bedt.id('99'), 'affidavit', true, 'k', bedt.change('$310.00'))->>'error' = 'Job not found');
SELECT bedt.ok('no difference named is refused', public.set_lien_print_stands(bedt.id('10'), 'affidavit', true, '  ', bedt.change('$310.00'))->>'error' = 'Say which change the paper stands through');
SELECT bedt.ok('a key too long is refused', public.set_lien_print_stands(bedt.id('10'), 'affidavit', true, repeat('k', 201), bedt.change('$310.00'))->>'error' = 'Say which change the paper stands through');
SELECT bedt.ok('no change said is refused', public.set_lien_print_stands(bedt.id('10'), 'affidavit', true, 'affidavit:1:a', '[]'::jsonb)->>'error' = 'Say what had changed on the paper');
SELECT bedt.ok('no change at all is refused', public.set_lien_print_stands(bedt.id('10'), 'affidavit', true, 'affidavit:1:a')->>'error' = 'Say what had changed on the paper');
SELECT bedt.ok('changes that are not a list are refused', public.set_lien_print_stands(bedt.id('10'), 'affidavit', true, 'affidavit:1:a', '{"a": 1}'::jsonb)->>'error' = 'Say what had changed on the paper');
SELECT bedt.ok('every refusal wrote nothing', (SELECT count(*) = 0 FROM public.lien_print_stands));

-- 3 · It stands: one row, with the difference, what had changed, the filed print, who and when.
SELECT bedt.ok('the assistant says it stands', public.set_lien_print_stands(bedt.id('10'), 'affidavit', true, ' affidavit:1:a ', bedt.change('$310.00'), bedt.id('500')) = '{"ok": true, "stands": true, "changed": true}'::jsonb);
SELECT bedt.ok('one row stands, with the key trimmed, the change in words, the print and who', bedt.live('10', 'affidavit') = 1 AND (SELECT change_key = 'affidavit:1:a' AND changes = bedt.change('$310.00') AND sent_document_id = bedt.id('500') AND stood_by = bedt.id('1') AND stood_at IS NOT NULL AND taken_back_at IS NULL AND taken_back_by IS NULL FROM public.lien_print_stands WHERE job_id = bedt.id('10')));
SELECT bedt.ok('the job''s notice is untouched', bedt.live('10', 'notice') = 0);

-- 4 · The same press twice writes one row, whoever presses.
SELECT bedt.as_user('3');
SELECT bedt.ok('again, same difference: ok and unchanged', public.set_lien_print_stands(bedt.id('10'), 'affidavit', true, 'affidavit:1:a', bedt.change('other words')) = '{"ok": true, "stands": true, "changed": false}'::jsonb);
SELECT bedt.ok('again: still one row, still the assistant''s', bedt.live('10', 'affidavit') = 1 AND (SELECT stood_by = bedt.id('1') AND changes = bedt.change('$310.00') FROM public.lien_print_stands WHERE job_id = bedt.id('10')));

-- 5 · A second change is another difference: a second row beside the first. The first answers for its own alone.
SELECT bedt.ok('a second difference: a new row', public.set_lien_print_stands(bedt.id('10'), 'affidavit', true, 'affidavit:1:b', bedt.change('$110.00'))->>'changed' = 'true');
SELECT bedt.ok('two rows stand, one a difference', bedt.live('10', 'affidavit') = 2 AND (SELECT count(*) = 1 FROM public.lien_print_stands WHERE job_id = bedt.id('10') AND change_key = 'affidavit:1:b' AND stood_by = bedt.id('3') AND sent_document_id IS NULL));
SELECT bedt.ok('the same key on the notice is its own row', public.set_lien_print_stands(bedt.id('10'), 'notice', true, 'affidavit:1:a', bedt.change('$310.00'))->>'changed' = 'true' AND bedt.live('10', 'notice') = 1);
SELECT bedt.ok('a notice on another job stands by the master', public.set_lien_print_stands(bedt.id('11'), 'notice', true, 'notice:1:a', bedt.change('$5,000.00'))->>'changed' = 'true');

-- 6 · Taken back: every standing answer for that paper is stamped, with who and when, and nothing else is.
SELECT bedt.as_user('4');
SELECT bedt.ok('taken back: the press answers ok', public.set_lien_print_stands(bedt.id('10'), 'affidavit', false) = '{"ok": true, "stands": false, "changed": true}'::jsonb);
SELECT bedt.ok('taken back: both rows are stamped by the controller', bedt.live('10', 'affidavit') = 0 AND (SELECT count(*) = 2 FROM public.lien_print_stands WHERE job_id = bedt.id('10') AND paper = 'affidavit' AND taken_back_by = bedt.id('4') AND taken_back_at IS NOT NULL));
SELECT bedt.ok('taken back: who said it stood and what had changed stay on the row', (SELECT count(*) = 1 FROM public.lien_print_stands WHERE job_id = bedt.id('10') AND change_key = 'affidavit:1:a' AND stood_by = bedt.id('1') AND changes = bedt.change('$310.00')));
SELECT bedt.ok('taken back: the job''s notice and the other job''s still stand', bedt.live('10', 'notice') = 1 AND bedt.live('11', 'notice') = 1);
SELECT bedt.ok('taken back twice: ok and unchanged', public.set_lien_print_stands(bedt.id('10'), 'affidavit', false)->>'changed' = 'false');
-- A paper taken back can stand through the same difference again: the key holds only the rows that stand.
SELECT bedt.as_user('5');
SELECT bedt.ok('it stands again after a take back: a new row', public.set_lien_print_stands(bedt.id('10'), 'affidavit', true, 'affidavit:1:a', bedt.change('$310.00'))->>'changed' = 'true' AND bedt.live('10', 'affidavit') = 1);

-- 7 · Who reads the rows.
SELECT bedt.as_user('1');
SELECT bedt.ok('an assistant reads every row', bedt.seen() = 5);
SELECT bedt.as_user('3');
SELECT bedt.ok('a master reads every row', bedt.seen() = 5);
SELECT bedt.as_user('4');
SELECT bedt.ok('a controller reads every row', bedt.seen() = 5);
SELECT bedt.as_user('5');
SELECT bedt.ok('a dev reads every row', bedt.seen() = 5);
SELECT bedt.as_user('2');
SELECT bedt.ok('a technician reads none', bedt.seen() = 0);
SELECT bedt.as_user('6');
SELECT bedt.ok('an estimator reads none', bedt.seen() = 0);

-- 8 · Nobody writes the table by hand, and the table refuses a row that makes no sense.
SELECT bedt.as_user('1');
DO $$ BEGIN
  BEGIN
    SET LOCAL ROLE authenticated;
    INSERT INTO public.lien_print_stands (job_id, paper, change_key, stood_by) VALUES (bedt.id('11'), 'affidavit', 'k', bedt.id('1'));
    RESET ROLE;
    RAISE EXCEPTION 'FAILED: a signed-in person wrote the table by hand';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'ok: a signed-in person cannot write the table by hand';
  END;
END $$;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.lien_print_stands (job_id, paper, change_key, stood_by) VALUES (bedt.id('11'), 'affidavit', '   ', bedt.id('1'));
    RAISE EXCEPTION 'FAILED: the table took an answer with no difference named';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: the table refuses an answer with no difference named';
  END;
END $$;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.lien_print_stands (job_id, paper, change_key, changes, stood_by) VALUES (bedt.id('11'), 'affidavit', 'k', '{"a": 1}'::jsonb, bedt.id('1'));
    RAISE EXCEPTION 'FAILED: the table took changes that are not a list';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: the table refuses changes that are not a list';
  END;
END $$;
DO $$ BEGIN
  BEGIN
    UPDATE public.lien_print_stands SET taken_back_at = now() WHERE job_id = bedt.id('11') AND paper = 'notice';
    RAISE EXCEPTION 'FAILED: the table took a take back with nobody named';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: the table refuses a take back with nobody named';
  END;
END $$;
-- A job deleted takes its rows with it.
DELETE FROM public.jobs_ledger WHERE id = bedt.id('11');
SELECT bedt.ok('a deleted job takes its rows', (SELECT count(*) = 0 FROM public.lien_print_stands WHERE job_id = bedt.id('11')));

DO $$ BEGIN RAISE NOTICE 'lien_print_stands PASSED'; END $$;
ROLLBACK;
