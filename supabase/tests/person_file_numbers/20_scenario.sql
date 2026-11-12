-- Rows the system numbers (20261112070000, punch list #315): exhibit numbers, a case's open items and its log. Here:
-- a new evidence record takes the file's next number, one past the highest number any old title opens with, whatever
-- the client sends; the backfill numbers the records whose title wears a number nobody else wears and reports the
-- rest (a number worn twice, a number with a letter, a title with none) without guessing, a counsel-only record named
-- as one; dev_case_write numbers a new item, carries one over with the number it already goes by, refuses a number
-- that is taken, writes a log line for every change, and answers a dry run in words that move when another session
-- adds an item first; who may read and write (a dev; an estimator nothing). Made-up people and words. Fixtures made as
-- postgres; the doors run as signed-in users through RLS, inside one transaction that rolls back. Raises on the first
-- failed assertion; ends with "person_file_numbers PASSED". See scripts/pgtest-person-file-numbers.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA pfn;
CREATE FUNCTION pfn.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pfn.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION pfn.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- What the bed reads past RLS: a file's records as "<last two of the id>=<number or ->", oldest first.
CREATE FUNCTION pfn.numbers(p_person uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(string_agg(right(e.id::text, 2) || '=' || COALESCE(e.exhibit_no::text, '-'), ' ' ORDER BY e.created_at, e.id), 'none')
  FROM public.person_file_evidence e WHERE e.person_id = p_person $$;
CREATE FUNCTION pfn.items(p_person uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(string_agg(i.item_no || ' ' || i.state || CASE WHEN i.owner_label <> '' THEN ' @' || i.owner_label ELSE '' END || ': ' || i.title, ' | ' ORDER BY i.item_no), 'none')
  FROM public.person_case_items i WHERE i.person_id = p_person $$;
CREATE FUNCTION pfn.log(p_person uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::text FROM public.person_case_log l WHERE l.person_id = p_person $$;
-- A dry run's item changes and log lines, in a few words.
CREATE FUNCTION pfn.plan(r jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE((SELECT string_agg((x->>'op') || ' ' || (x->>'item_no') || ' ' || (x->'after'->>'state'), ', ' ORDER BY ord) FROM jsonb_array_elements(r->'items') WITH ORDINALITY AS t(x, ord)), 'no items')
      || ' / ' || jsonb_array_length(r->'log') || ' log / open ' || (r->'standing'->>'open') $$;
GRANT USAGE ON SCHEMA pfn TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pfn TO authenticated;

-- Who: a dev and an estimator.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000971d1', 'dev@numbers.test'),
  ('00000000-0000-0000-0000-0000000971d2', 'estimator@numbers.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000971d1', 'dev@numbers.test', 'Number Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000971d2', 'estimator@numbers.test', 'Number Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.people (id, master_user_id, kind, name) VALUES
  ('00000000-0000-0000-0000-0000000971b1', '00000000-0000-0000-0000-0000000971d1', 'helper', 'Pat Sample'),
  ('00000000-0000-0000-0000-0000000971b2', '00000000-0000-0000-0000-0000000971d1', 'helper', 'Sam Sample');

-- Pat's file as it stood before the numbers: eight records whose titles carry what a person typed. Number 1 is worn
-- by two records (one counsel-only), number 2 by two, 3 has a letter, 4 and 6 are worn once, one title has no number.
INSERT INTO public.person_file_evidence (id, person_id, dated_on, title, memo, counsel_only, created_at) VALUES
  ('00000000-0000-0000-0000-0000000971f1', '00000000-0000-0000-0000-0000000971b1', '2026-03-02', 'Ev #1 Gate log', 'x', false, '2026-03-03 15:00+00'),
  ('00000000-0000-0000-0000-0000000971f2', '00000000-0000-0000-0000-0000000971b1', '2026-03-02', 'Ev #2 Photo of the truck', 'x', false, '2026-03-04 15:00+00'),
  ('00000000-0000-0000-0000-0000000971f3', '00000000-0000-0000-0000-0000000971b1', '2026-03-02', 'Ev #2 A second photo', 'x', false, '2026-03-05 15:00+00'),
  ('00000000-0000-0000-0000-0000000971f4', '00000000-0000-0000-0000-0000000971b1', '2026-03-06', 'Ev #3a The same call, part two', 'x', false, '2026-03-06 15:00+00'),
  ('00000000-0000-0000-0000-0000000971f5', '00000000-0000-0000-0000-0000000971b1', '2026-03-07', 'Ev. 4 Text thread', 'x', false, '2026-03-07 15:00+00'),
  ('00000000-0000-0000-0000-0000000971f6', '00000000-0000-0000-0000-0000000971b1', '2026-03-08', 'Receipt from the supply house', 'x', false, '2026-03-08 15:00+00'),
  ('00000000-0000-0000-0000-0000000971f7', '00000000-0000-0000-0000-0000000971b1', '2026-03-09', 'ev 6: Signed form', 'x', false, '2026-03-09 15:00+00'),
  ('00000000-0000-0000-0000-0000000971f8', '00000000-0000-0000-0000-0000000971b1', '2026-03-10', 'Ev #1 A note kept for counsel', 'x', true, '2026-03-10 15:00+00');
UPDATE public.person_file_evidence SET exhibit_no = NULL WHERE person_id = '00000000-0000-0000-0000-0000000971b1';
DELETE FROM public.person_file_counters WHERE person_id = '00000000-0000-0000-0000-0000000971b1';

SELECT pfn.same('a title''s number is read in the one form, and never out of a letter or the middle',
  (SELECT string_agg(COALESCE(public.exhibit_no_from_title(t)::text, '-'), ' ' ORDER BY ord) FROM unnest(ARRAY['Ev #41 x', 'Ev 41', 'ev. #41: x', ' EV#41-x', 'Ev #41a x', 'Ev #4100000 x', 'See Ev #41', 'Exhibit 41', '41. x', NULL]) WITH ORDINALITY AS u(t, ord)),
  '41 41 41 41 - - - - - -');

SET LOCAL ROLE authenticated;

-- ── who may ask ──────────────────────────────────────────────────────────────────────────────────
SELECT pfn.as_user('00000000-0000-0000-0000-0000000971d2');
SELECT pfn.refused('an estimator is refused the backfill', $q$SELECT public.dev_evidence_number_backfill('00000000-0000-0000-0000-0000000971b1', true)$q$, 'devs only');
SELECT pfn.refused('an estimator is refused the case door', $q$SELECT public.dev_case_write('{"person_id":"00000000-0000-0000-0000-0000000971b1","log":["x"]}'::jsonb, true)$q$, 'devs only');
SELECT pfn.same('an estimator is told no next number', COALESCE(public.person_file_next_exhibit_no('00000000-0000-0000-0000-0000000971b1')::text, 'nothing'), 'nothing');
SELECT pfn.same('and reads no counter, item or log line',
  (SELECT count(*) FROM public.person_file_counters)::text || ' ' || (SELECT count(*) FROM public.person_case_items)::text || ' ' || (SELECT count(*) FROM public.person_case_log)::text, '0 0 0');

SELECT pfn.as_user('00000000-0000-0000-0000-0000000971d1');

-- ── exhibit numbers ──────────────────────────────────────────────────────────────────────────────
SELECT pfn.same('the next number is one past the highest any old title opens with', public.person_file_next_exhibit_no('00000000-0000-0000-0000-0000000971b1')::text, '7');
SELECT pfn.same('the backfill''s dry run numbers what is clear and reports the rest',
  (SELECT (r->>'numbered') || ' numbered (' || (SELECT string_agg(right(a->>'id', 2) || '=' || (a->>'exhibit_no'), ' ' ORDER BY (a->>'exhibit_no')::int) FROM jsonb_array_elements(r->'assigned') a) || '), clashes on '
       || (SELECT string_agg((c->>'number') || ' x' || jsonb_array_length(c->'records'), ' and ' ORDER BY (c->>'number')::int) FROM jsonb_array_elements(r->'clashes') c)
       || ', ' || jsonb_array_length(r->'lettered') || ' lettered, ' || jsonb_array_length(r->'no_number') || ' with no number, highest ' || (r->>'highest') || ', next ' || (r->>'next') || ', ' || (r->>'still_unnumbered') || ' left'
     FROM public.dev_evidence_number_backfill('00000000-0000-0000-0000-0000000971b1', true) r),
  '2 numbered (f5=4 f7=6), clashes on 1 x2 and 2 x2, 1 lettered, 1 with no number, highest 6, next 7, 6 left');
SELECT pfn.same('a counsel-only record in a clash is named as one, never by its title',
  (SELECT string_agg(rec->>'title', ' | ' ORDER BY rec->>'kept') FROM jsonb_array_elements(public.dev_evidence_number_backfill('00000000-0000-0000-0000-0000000971b1', true)->'clashes') c, jsonb_array_elements(c->'records') rec WHERE (c->>'number') = '1'),
  'Ev #1 Gate log | a counsel-only record');
RESET ROLE;
SELECT pfn.same('the dry run numbered nothing', pfn.numbers('00000000-0000-0000-0000-0000000971b1'), 'f1=- f2=- f3=- f4=- f5=- f6=- f7=- f8=-');
SET LOCAL ROLE authenticated;

-- A new record, as the panel adds one: the number is the database's, whatever the client sends.
INSERT INTO public.person_file_evidence (id, person_id, dated_on, title, memo, created_by, exhibit_no)
  VALUES ('00000000-0000-0000-0000-0000000971f9', '00000000-0000-0000-0000-0000000971b1', '2026-03-20', 'Voicemail from Friday', 'x', '00000000-0000-0000-0000-0000000971d1', 1);
RESET ROLE;
SELECT pfn.same('a new record takes 7, not the 1 the client sent', (SELECT exhibit_no::text FROM public.person_file_evidence WHERE id = '00000000-0000-0000-0000-0000000971f9'), '7');
SET LOCAL ROLE authenticated;

SELECT public.dev_evidence_number_backfill('00000000-0000-0000-0000-0000000971b1', false);
RESET ROLE;
SELECT pfn.same('the backfill numbered the two that were clear and left the rest', pfn.numbers('00000000-0000-0000-0000-0000000971b1'), 'f1=- f2=- f3=- f4=- f5=4 f6=- f7=6 f8=- f9=7');
SET LOCAL ROLE authenticated;
SELECT pfn.same('a second run finds nothing clear', (SELECT (r->>'numbered') || ' ' || (r->>'still_unnumbered') FROM public.dev_evidence_number_backfill('00000000-0000-0000-0000-0000000971b1', false) r), '0 6');
SELECT pfn.same('asked to, it numbers the one with no number after the highest',
  (SELECT (r->>'no_number_numbered') || ' ' || (r->>'highest') || ' ' || (r->>'next') || ' ' || (r->>'still_unnumbered') FROM public.dev_evidence_number_backfill('00000000-0000-0000-0000-0000000971b1', false, true) r), '1 8 9 5');
RESET ROLE;
SELECT pfn.same('and never touches a clash or a lettered one', pfn.numbers('00000000-0000-0000-0000-0000000971b1'), 'f1=- f2=- f3=- f4=- f5=4 f6=8 f7=6 f8=- f9=7');
SELECT pfn.same('no title changed', (SELECT string_agg(left(title, 6), '|' ORDER BY created_at, id) FROM public.person_file_evidence WHERE person_id = '00000000-0000-0000-0000-0000000971b1'), 'Ev #1 |Ev #2 |Ev #2 |Ev #3a|Ev. 4 |Receip|ev 6: |Ev #1 |Voicem');
SET LOCAL ROLE authenticated;

-- A file with nothing on it starts at 1.
INSERT INTO public.person_file_evidence (id, person_id, dated_on, title, memo) VALUES
  ('00000000-0000-0000-0000-0000000971fa', '00000000-0000-0000-0000-0000000971b2', '2026-03-20', 'First thing', 'x'),
  ('00000000-0000-0000-0000-0000000971fb', '00000000-0000-0000-0000-0000000971b2', '2026-03-21', 'Second thing', 'x');
RESET ROLE;
SELECT pfn.same('a new file numbers from 1', pfn.numbers('00000000-0000-0000-0000-0000000971b2'), 'fa=1 fb=2');
SET LOCAL ROLE authenticated;

-- ── a case's items and log ───────────────────────────────────────────────────────────────────────
\set c1 '{"person_id":"00000000-0000-0000-0000-0000000971b1","session":"bed session","items":[{"add":{"title":"Pull the March gate logs","owner":"bed session"}},{"add":{"title":"Ask about Friday"}}],"log":["Read the file end to end."]}'
SELECT pfn.same('a dry run names the numbers two new items would take', pfn.plan(public.dev_case_write(:'c1'::jsonb, true)), 'add 1 open, add 2 open / 3 log / open 2');
SELECT pfn.same('and answers the same on a second run, word for word', (public.dev_case_write(:'c1'::jsonb, true)::text = public.dev_case_write(:'c1'::jsonb, true)::text)::text, 'true');
RESET ROLE;
SELECT pfn.same('the dry run wrote nothing', pfn.items('00000000-0000-0000-0000-0000000971b1') || ' / ' || pfn.log('00000000-0000-0000-0000-0000000971b1'), 'none / 0');
SET LOCAL ROLE authenticated;
SELECT public.dev_case_write(:'c1'::jsonb, false);
RESET ROLE;
SELECT pfn.same('the write landed both items and three log lines',
  pfn.items('00000000-0000-0000-0000-0000000971b1') || ' / ' || pfn.log('00000000-0000-0000-0000-0000000971b1'),
  '1 open @bed session: Pull the March gate logs | 2 open: Ask about Friday / 3');
SELECT pfn.same('each change wrote its own line, by the dev, from the session',
  (SELECT string_agg(l.line || ' [' || COALESCE(l.item_no::text, '-') || ', ' || l.author_label || ', ' || l.session_label || ']', ' | ' ORDER BY l.item_no NULLS LAST) FROM public.person_case_log l WHERE l.person_id = '00000000-0000-0000-0000-0000000971b1'),
  'Item 1 opened: Pull the March gate logs (with bed session) [1, Number Dev, bed session] | Item 2 opened: Ask about Friday [2, Number Dev, bed session] | Read the file end to end. [-, Number Dev, bed session]');
SET LOCAL ROLE authenticated;

-- The same plan, after another session added an item: the number moves, so the words move, and the seat refuses it.
\set c2 '{"person_id":"00000000-0000-0000-0000-0000000971b1","items":[{"add":{"title":"Call the supply house"}}]}'
SELECT set_config('pfn.seen', public.dev_case_write(:'c2'::jsonb, true)::text, true) IS NOT NULL AS kept;
SELECT public.dev_case_write('{"person_id":"00000000-0000-0000-0000-0000000971b1","items":[{"add":{"title":"Another session got here first"}}]}'::jsonb, false);
SELECT pfn.same('a plan made before another session''s item no longer reads the same', (current_setting('pfn.seen') = public.dev_case_write(:'c2'::jsonb, true)::text)::text, 'false');
SELECT pfn.same('it would now take the next number', pfn.plan(public.dev_case_write(:'c2'::jsonb, true)), 'add 4 open / 1 log / open 4');

-- An item carried over from prose keeps the number people call it by; a taken number is refused.
SELECT public.dev_case_write('{"person_id":"00000000-0000-0000-0000-0000000971b1","items":[{"add":{"title":"The OAuth log","item_no":22}}]}'::jsonb, false);
SELECT pfn.refused('a number that is taken', $q$SELECT public.dev_case_write('{"person_id":"00000000-0000-0000-0000-0000000971b1","items":[{"add":{"title":"Also 22","item_no":22}}]}'::jsonb, true)$q$, 'item 22 already stands');
SELECT pfn.same('the next item after a carried-over 22 is 23', pfn.plan(public.dev_case_write(:'c2'::jsonb, true)), 'add 23 open / 1 log / open 5');

-- Change, close, reopen.
SELECT pfn.same('an item is handed over, closed with its reason, and logged each time',
  pfn.plan(public.dev_case_write('{"person_id":"00000000-0000-0000-0000-0000000971b1","items":[{"item_no":2,"set":{"owner":"a second session"}},{"item_no":1,"close":{"why":"The logs are on the file."}}],"log":[{"line":"Checked the dates against the logs.","item_no":1}]}'::jsonb, false)),
  'set 2 open, close 1 done / 3 log / open 3');
SELECT pfn.refused('a close with no reason', $q$SELECT public.dev_case_write('{"person_id":"00000000-0000-0000-0000-0000000971b1","items":[{"item_no":2,"close":{"state":"dropped"}}]}'::jsonb, true)$q$, 'close needs why');
SELECT pfn.refused('a close of a closed item', $q$SELECT public.dev_case_write('{"person_id":"00000000-0000-0000-0000-0000000971b1","items":[{"item_no":1,"close":{"why":"again"}}]}'::jsonb, true)$q$, 'already done');
SELECT pfn.same('a closed item is reopened', pfn.plan(public.dev_case_write('{"person_id":"00000000-0000-0000-0000-0000000971b1","items":[{"item_no":1,"reopen":true}]}'::jsonb, false)), 'reopen 1 open / 1 log / open 4');
SELECT pfn.refused('a reopen of an open item', $q$SELECT public.dev_case_write('{"person_id":"00000000-0000-0000-0000-0000000971b1","items":[{"item_no":1,"reopen":true}]}'::jsonb, true)$q$, 'open already');
SELECT pfn.refused('an item that is not on the file', $q$SELECT public.dev_case_write('{"person_id":"00000000-0000-0000-0000-0000000971b1","items":[{"item_no":9,"set":{"owner":"x"}}]}'::jsonb, true)$q$, 'no item 9');
SELECT pfn.refused('a log line about an item that is not there', $q$SELECT public.dev_case_write('{"person_id":"00000000-0000-0000-0000-0000000971b1","log":[{"line":"x","item_no":9}]}'::jsonb, true)$q$, 'no item 9');
SELECT pfn.refused('a call with nothing in it', $q$SELECT public.dev_case_write('{"person_id":"00000000-0000-0000-0000-0000000971b1"}'::jsonb, true)$q$, 'nothing to write');
SELECT pfn.refused('an item with no title', $q$SELECT public.dev_case_write('{"person_id":"00000000-0000-0000-0000-0000000971b1","items":[{"add":{"title":"  "}}]}'::jsonb, true)$q$, 'add needs a title');
SELECT pfn.refused('a change that is no change', $q$SELECT public.dev_case_write('{"person_id":"00000000-0000-0000-0000-0000000971b1","items":[{"item_no":1,"archive":true}]}'::jsonb, true)$q$, 'set | close | reopen');

-- The tables themselves, as the tab writes them: the database numbers a direct insert, and an item keeps its number.
INSERT INTO public.person_case_items (person_id, title, created_by) VALUES ('00000000-0000-0000-0000-0000000971b1', 'Added from the tab', '00000000-0000-0000-0000-0000000971d1');
SELECT pfn.same('a direct insert takes the next number', (SELECT item_no::text FROM public.person_case_items WHERE title = 'Added from the tab'), '23');
SELECT pfn.refused('an item''s number cannot be changed', $q$UPDATE public.person_case_items SET item_no = 99 WHERE person_id = '00000000-0000-0000-0000-0000000971b1' AND item_no = 2$q$, 'keeps its file, its number');
SELECT pfn.refused('a closed state needs its reason at the table too', $q$UPDATE public.person_case_items SET state = 'done' WHERE person_id = '00000000-0000-0000-0000-0000000971b1' AND item_no = 2$q$, 'person_case_items_closed_with_why');
SELECT pfn.refused('a log line is never rewritten', $q$DO $d$ DECLARE n int := 0; BEGIN BEGIN UPDATE public.person_case_log SET line = 'rewritten' WHERE person_id = '00000000-0000-0000-0000-0000000971b1'; GET DIAGNOSTICS n = ROW_COUNT; EXCEPTION WHEN insufficient_privilege THEN n := 0; END; IF n = 0 THEN RAISE EXCEPTION 'nothing rewritten'; END IF; END $d$$q$, 'nothing rewritten');
SELECT pfn.refused('the counter is nobody''s to write', $q$DO $d$ DECLARE n int := 0; BEGIN BEGIN UPDATE public.person_file_counters SET next_item_no = 1; GET DIAGNOSTICS n = ROW_COUNT; EXCEPTION WHEN insufficient_privilege THEN n := 0; END; IF n = 0 THEN RAISE EXCEPTION 'nothing moved'; END IF; END $d$$q$, 'nothing moved');
RESET ROLE;
SELECT pfn.same('the file reads as it should at the end', pfn.items('00000000-0000-0000-0000-0000000971b1'),
  '1 open @bed session: Pull the March gate logs | 2 open @a second session: Ask about Friday | 3 open: Another session got here first | 22 open: The OAuth log | 23 open: Added from the tab');

DO $$ BEGIN RAISE NOTICE 'person_file_numbers PASSED'; END $$;
ROLLBACK;
