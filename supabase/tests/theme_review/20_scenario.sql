-- The review of theme marks already on the record (v2.6844): dev_theme_review_write keeps the proposed marks named
-- and takes the named marks off with a reason each. Here: who may call it and every refusal of a bad shape; a dry
-- run that resolves each mark (ready, already, held) and writes nothing; the apply, which stamps the ready ones as
-- the dev and skips the rest; a replay that finds everything already done; and what the marks table's own trigger
-- still refuses. Made-up people and words. Fixtures made as postgres; the door runs as a dev through RLS; everything
-- runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "theme_review PASSED". See scripts/pgtest-theme-review.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA trv;
CREATE FUNCTION trv.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION trv.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION trv.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- What the bed reads past RLS (as postgres): a mark's stamps in a few words.
CREATE FUNCTION trv.mark(p uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN m.proposed THEN 'proposed' ELSE 'made kept' END
      || CASE WHEN m.kept_at IS NULL THEN ', not kept' ELSE ', kept by ' || COALESCE((SELECT u.name FROM public.users u WHERE u.id = m.kept_by), 'nobody') END
      || CASE WHEN m.removed_at IS NULL THEN '' ELSE ', off by ' || COALESCE((SELECT u.name FROM public.users u WHERE u.id = m.removed_by), 'nobody') || ': ' || m.removed_why END
  FROM public.legal_theme_marks m WHERE m.id = p $$;
CREATE FUNCTION trv.states(r jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT string_agg((x->>'act') || ' ' || (x->>'state'), ', ' ORDER BY (x->>'seq')::int) FROM jsonb_array_elements(r->'marks') x $$;
GRANT USAGE ON SCHEMA trv TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA trv TO authenticated;

-- Who: a dev and an estimator.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000844d1', 'dev@themes.test'),
  ('00000000-0000-0000-0000-0000000844d2', 'estimator@themes.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000844d1', 'dev@themes.test', 'Theme Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000844d2', 'estimator@themes.test', 'Theme Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- A person with an HR entry and a piece of evidence, one theme, and five marks an agent made:
-- m1 and m2 proposed, m3 proposed and already kept, m4 proposed and already off, m5 made kept (never proposed).
INSERT INTO public.people (id, master_user_id, kind, name) VALUES
  ('00000000-0000-0000-0000-0000000844b1', '00000000-0000-0000-0000-0000000844d1', 'helper', 'Pat Sample');
INSERT INTO public.person_file_entries (id, person_id, entry_date, content, source) VALUES
  ('00000000-0000-0000-0000-0000000844e1', '00000000-0000-0000-0000-0000000844b1', '2026-03-02', 'Said the truck was back when it was not.', 'incident'),
  ('00000000-0000-0000-0000-0000000844e2', '00000000-0000-0000-0000-0000000844b1', '2026-03-09', 'Left the gate open after being told twice.', 'incident'),
  ('00000000-0000-0000-0000-0000000844e3', '00000000-0000-0000-0000-0000000844b1', '2026-03-16', 'Charged lunch to the shop card.', 'incident'),
  ('00000000-0000-0000-0000-0000000844e4', '00000000-0000-0000-0000-0000000844b1', '2026-03-23', 'Late three days running.', 'incident');
INSERT INTO public.person_file_evidence (id, person_id, dated_on, title, memo) VALUES
  ('00000000-0000-0000-0000-0000000844f1', '00000000-0000-0000-0000-0000000844b1', '2026-03-02', 'Gate camera still, 6:40', 'The truck is not in the yard.');
INSERT INTO public.legal_themes (id, name, what_counts) VALUES
  ('00000000-0000-0000-0000-0000000844a1', 'Bed theme of untruth', 'A statement the record shows to be untrue.');
INSERT INTO public.legal_theme_marks (id, theme_id, target_kind, target_id, person_id, why, proves_by, author_label, proposed, kept_at, kept_by, removed_at, removed_by, removed_why) VALUES
  ('00000000-0000-0000-0000-0000000844c1', '00000000-0000-0000-0000-0000000844a1', 'hr_entry', '00000000-0000-0000-0000-0000000844e1', '00000000-0000-0000-0000-0000000844b1', 'said back, was not', 'firsthand', 'dev seat', true, NULL, NULL, NULL, NULL, ''),
  ('00000000-0000-0000-0000-0000000844c2', '00000000-0000-0000-0000-0000000844a1', 'hr_evidence', '00000000-0000-0000-0000-0000000844f1', '00000000-0000-0000-0000-0000000844b1', 'the still shows the yard empty', 'document', 'dev seat', true, NULL, NULL, NULL, NULL, ''),
  ('00000000-0000-0000-0000-0000000844c3', '00000000-0000-0000-0000-0000000844a1', 'hr_entry', '00000000-0000-0000-0000-0000000844e2', '00000000-0000-0000-0000-0000000844b1', 'kept before', 'firsthand', 'dev seat', true, now() - interval '1 day', '00000000-0000-0000-0000-0000000844d1', NULL, NULL, ''),
  ('00000000-0000-0000-0000-0000000844c4', '00000000-0000-0000-0000-0000000844a1', 'hr_entry', '00000000-0000-0000-0000-0000000844e3', '00000000-0000-0000-0000-0000000844b1', 'came off before', 'document', 'dev seat', true, NULL, NULL, now() - interval '1 day', '00000000-0000-0000-0000-0000000844d1', 'not this theme'),
  ('00000000-0000-0000-0000-0000000844c5', '00000000-0000-0000-0000-0000000844a1', 'hr_entry', '00000000-0000-0000-0000-0000000844e4', '00000000-0000-0000-0000-0000000844b1', 'made kept', 'firsthand', 'dev seat', false, now() - interval '2 days', '00000000-0000-0000-0000-0000000844d1', NULL, NULL, '');

-- Who may call it.
SELECT trv.refused('nobody signed in is refused', $q$SELECT public.dev_theme_review_write('{"keep":["00000000-0000-0000-0000-0000000844c1"]}'::jsonb, true)$q$, 'devs only');
SET LOCAL ROLE authenticated;
SELECT trv.as_user('00000000-0000-0000-0000-0000000844d2');
SELECT trv.refused('an estimator is refused', $q$SELECT public.dev_theme_review_write('{"keep":["00000000-0000-0000-0000-0000000844c1"]}'::jsonb, true)$q$, 'devs only');
SELECT trv.as_user('00000000-0000-0000-0000-0000000844d1');

-- A bad shape raises in words.
SELECT trv.refused('nothing named is refused', $q$SELECT public.dev_theme_review_write('{}'::jsonb, true)$q$, 'name 1 to 200 marks');
SELECT trv.refused('keep must be a list', $q$SELECT public.dev_theme_review_write('{"keep":"00000000-0000-0000-0000-0000000844c1"}'::jsonb, true)$q$, 'keep is a list of mark ids');
SELECT trv.refused('a keep that is not an id is refused', $q$SELECT public.dev_theme_review_write('{"keep":["the first one"]}'::jsonb, true)$q$, 'must be a mark id');
SELECT trv.refused('a take off with no reason is refused', $q$SELECT public.dev_theme_review_write('{"take_off":[{"id":"00000000-0000-0000-0000-0000000844c2","why":"  "}]}'::jsonb, true)$q$, 'needs why');
SELECT trv.refused('a reason over 200 characters is refused', format($q$SELECT public.dev_theme_review_write('{"take_off":[{"id":"00000000-0000-0000-0000-0000000844c2","why":"%s"}]}'::jsonb, true)$q$, repeat('x', 201)), 'needs why');
SELECT trv.refused('a mark named twice is refused', $q$SELECT public.dev_theme_review_write('{"keep":["00000000-0000-0000-0000-0000000844c1"],"take_off":[{"id":"00000000-0000-0000-0000-0000000844c1","why":"both"}]}'::jsonb, true)$q$, 'named twice');
SELECT trv.refused('over 200 marks is refused', format($q$SELECT public.dev_theme_review_write(jsonb_build_object('keep', (SELECT jsonb_agg(gen_random_uuid()) FROM generate_series(1, %s))), true)$q$, 201), 'name 1 to 200 marks');

-- The dry run resolves each mark and writes nothing.
CREATE TEMP TABLE trv_plan (r jsonb) ON COMMIT DROP;
INSERT INTO trv_plan SELECT public.dev_theme_review_write($j${
  "keep": ["00000000-0000-0000-0000-0000000844c1", "00000000-0000-0000-0000-0000000844c3", "00000000-0000-0000-0000-0000000844c4", "00000000-0000-0000-0000-0000000844c5", "00000000-0000-0000-0000-0000000844ff"],
  "take_off": [{"id": "00000000-0000-0000-0000-0000000844c2", "why": "the still is of another day"}]
}$j$::jsonb, true);
SELECT trv.same('the dry run says it is one', (SELECT r->>'dry_run' FROM trv_plan), 'true');
SELECT trv.same('it names who reviews', (SELECT r->>'reviewed_by' FROM trv_plan), 'Theme Dev');
SELECT trv.same('each mark is resolved in order', (SELECT trv.states(r) FROM trv_plan), 'keep ready, keep already, keep held, keep already, keep held, take_off ready');
SELECT trv.same('the keep counts', (SELECT r->'keep'::text FROM trv_plan)::text, '{"held": 2, "ready": 1, "already": 2}');
SELECT trv.same('the take off counts', (SELECT r->'take_off'::text FROM trv_plan)::text, '{"held": 0, "ready": 1, "already": 0}');
SELECT trv.same('a mark that came off is held with the day', (SELECT (r->'marks'->2->>'reason') LIKE 'taken off on %; a mark that came off is made again, not kept' FROM trv_plan)::text, 'true');
SELECT trv.same('an unknown id is held', (SELECT r->'marks'->4->>'reason' FROM trv_plan), 'no mark with that id');
SELECT trv.same('a row carries the theme and the first words', (SELECT (r->'marks'->0->>'theme') || ' · ' || (r->'marks'->0->>'target_words') || ' · ' || (r->'marks'->0->>'why') FROM trv_plan), 'Bed theme of untruth · Said the truck was back when it was not. · said back, was not');
SELECT trv.same('evidence is named by its title', (SELECT r->'marks'->5->>'target_words' FROM trv_plan), 'Gate camera still, 6:40');
RESET ROLE;
SELECT trv.same('the dry run kept nothing', trv.mark('00000000-0000-0000-0000-0000000844c1'), 'proposed, not kept');
SELECT trv.same('the dry run took nothing off', trv.mark('00000000-0000-0000-0000-0000000844c2'), 'proposed, not kept');

-- The apply stamps the ready ones as the dev and skips the rest.
SET LOCAL ROLE authenticated;
SELECT trv.as_user('00000000-0000-0000-0000-0000000844d1');
CREATE TEMP TABLE trv_done (r jsonb) ON COMMIT DROP;
INSERT INTO trv_done SELECT public.dev_theme_review_write($j${
  "keep": ["00000000-0000-0000-0000-0000000844c1", "00000000-0000-0000-0000-0000000844c3", "00000000-0000-0000-0000-0000000844c4", "00000000-0000-0000-0000-0000000844c5", "00000000-0000-0000-0000-0000000844ff"],
  "take_off": [{"id": "00000000-0000-0000-0000-0000000844c2", "why": "the still is of another day"}]
}$j$::jsonb, false);
SELECT trv.same('the apply counts what it did', (SELECT (r->>'ok') || ' · kept ' || (r->>'kept') || ' · off ' || (r->>'taken_off') || ' · already ' || (r->>'already') || ' · held ' || (r->>'held') FROM trv_done), 'true · kept 1 · off 1 · already 2 · held 2');
RESET ROLE;
SELECT trv.same('the ready mark is kept by the dev', trv.mark('00000000-0000-0000-0000-0000000844c1'), 'proposed, kept by Theme Dev');
SELECT trv.same('the other came off with its reason', trv.mark('00000000-0000-0000-0000-0000000844c2'), 'proposed, not kept, off by Theme Dev: the still is of another day');
SELECT trv.same('a mark off before stays as it was', trv.mark('00000000-0000-0000-0000-0000000844c4'), 'proposed, not kept, off by Theme Dev: not this theme');
SELECT trv.same('a mark kept before keeps its first stamp', (SELECT (kept_at < now() - interval '12 hours')::text FROM public.legal_theme_marks WHERE id = '00000000-0000-0000-0000-0000000844c3'), 'true');
SELECT trv.same('no mark was made or deleted', (SELECT count(*)::text FROM public.legal_theme_marks WHERE person_id = '00000000-0000-0000-0000-0000000844b1'), '5');
SELECT trv.same('a mark''s words did not change', (SELECT why || ' / ' || proves_by FROM public.legal_theme_marks WHERE id = '00000000-0000-0000-0000-0000000844c1'), 'said back, was not / firsthand');

-- A replay finds everything done; a kept mark can still come off, and then cannot be kept again.
SET LOCAL ROLE authenticated;
SELECT trv.as_user('00000000-0000-0000-0000-0000000844d1');
SELECT trv.same('a replay finds nothing ready', (SELECT trv.states(public.dev_theme_review_write($j${
  "keep": ["00000000-0000-0000-0000-0000000844c1"],
  "take_off": [{"id": "00000000-0000-0000-0000-0000000844c2", "why": "again"}]
}$j$::jsonb, true))), 'keep already, take_off already');
SELECT trv.same('a kept mark comes off', (SELECT (r->>'taken_off') FROM (SELECT public.dev_theme_review_write('{"take_off":[{"id":"00000000-0000-0000-0000-0000000844c1","why":"on a second look"}]}'::jsonb, false) AS r) s), '1');
SELECT trv.same('and is then held from keeping', (SELECT trv.states(public.dev_theme_review_write('{"keep":["00000000-0000-0000-0000-0000000844c1"]}'::jsonb, true))), 'keep held');
-- The table's own trigger still holds a mark to what it was when made.
SELECT trv.refused('a mark''s why cannot be reworded', $q$UPDATE public.legal_theme_marks SET why = 'something else' WHERE id = '00000000-0000-0000-0000-0000000844c5'$q$, 'a mark is what it was when made');
RESET ROLE;
SELECT trv.same('the mark that came off twice kept its first reason', trv.mark('00000000-0000-0000-0000-0000000844c2'), 'proposed, not kept, off by Theme Dev: the still is of another day');

DO $$ BEGIN RAISE NOTICE 'theme_review PASSED'; END $$;
ROLLBACK;
