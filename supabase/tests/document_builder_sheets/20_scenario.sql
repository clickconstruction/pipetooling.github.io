-- The Document builder's sheets, links, a link's opens (migration *_document_builder_link_opens) and sends (punch list #404, migration *_document_builder_sheets). A dev alone
-- reads them. A job's sheet starts as a draft, goes up one revision at a time with its copy and its page, and only on
-- the usual's published revision. A link is written by the service role alone and keeps only a hash. A send is
-- written by the service role, and a dev may only take one off a page, once. A dev in training, a dev's twin and a
-- dev who left are held by the fences. Every name and every word here is made up.
-- Everything rolls back. Raises on the first failed assertion; ends with "document_builder_sheets PASSED". See
-- scripts/pgtest-document-builder-sheets.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000004043a1', 'dana@sheets.test'),
  ('00000000-0000-0000-0000-0000004043a2', 'marcus@sheets.test'),
  ('00000000-0000-0000-0000-0000004043a3', 'ana@sheets.test'),
  ('00000000-0000-0000-0000-0000004043a4', 'carol@sheets.test'),
  ('00000000-0000-0000-0000-0000004043a5', 'priya@sheets.test'),
  ('00000000-0000-0000-0000-0000004043a6', 'pat@sheets.test'),
  ('00000000-0000-0000-0000-0000004043a7', 'luis@sheets.test'),
  ('00000000-0000-0000-0000-0000004043a8', 'hector@sheets.test'),
  ('00000000-0000-0000-0000-0000004043a9', 'sam@sheets.test'),
  ('00000000-0000-0000-0000-0000004043b1', 'tara@sheets.test'),
  ('00000000-0000-0000-0000-0000004043b2', 'tess@sheets.test'),
  ('00000000-0000-0000-0000-0000004043b3', 'gwen@sheets.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000004043a1', 'dana@sheets.test', 'Dana Dev', 'dev', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004043a2', 'marcus@sheets.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004043a3', 'ana@sheets.test', 'Ana Assistant', 'assistant', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004043a4', 'carol@sheets.test', 'Carol Controller', 'controller', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004043a5', 'priya@sheets.test', 'Priya Estimator', 'estimator', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004043a6', 'pat@sheets.test', 'Pat Primary', 'primary', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004043a7', 'luis@sheets.test', 'Luis Lead', 'superintendent', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004043a8', 'hector@sheets.test', 'Hector Helper', 'helpers', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004043a9', 'sam@sheets.test', 'Sam Sub', 'subcontractor', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004043b1', 'tara@sheets.test', 'Tara Training', 'dev', true, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004043b2', 'tess@sheets.test', 'Tess Twin', 'dev', false, true, false, NULL, now()),
  ('00000000-0000-0000-0000-0000004043b3', 'gwen@sheets.test', 'Gwen Gone', 'dev', false, false, false, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA dsb;
CREATE FUNCTION dsb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION dsb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF want <> '' AND position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION dsb.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Nobody signed in: the edge function with the service role.
CREATE FUNCTION dsb.as_nobody() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
CREATE FUNCTION dsb.touched(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'refused';
  END;
  RETURN n::text;
END $$;
-- How many rows of each table the caller reads, as "sheets links sends".
CREATE FUNCTION dsb.reads() RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT (SELECT count(*) FROM public.document_builder_sheets)::text || ' ' || (SELECT count(*) FROM public.document_builder_links)::text || ' ' || (SELECT count(*) FROM public.document_builder_sends)::text
$$;
-- Past row-level security: one answer of one query, as text.
CREATE FUNCTION dsb.past(q text) RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE out text;
BEGIN
  EXECUTE q INTO out;
  RETURN coalesce(out, 'null');
END $$;
GRANT USAGE ON SCHEMA dsb TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dsb TO authenticated, anon;

-- A made-up job the company runs as the GC, a second one, a trade partner, and a customer who is the GC on a job of ours.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000004043c1', 'Pecan Ridge Holdings', '00000000-0000-0000-0000-0000004043a2'),
  ('00000000-0000-0000-0000-0000004043c2', 'Northgate Builders', '00000000-0000-0000-0000-0000004043a2');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000004043d1', 'Cedar Park Medical Office', '00000000-0000-0000-0000-0000004043c1'),
  ('00000000-0000-0000-0000-0000004043d2', 'Mesa Verde Retail Shell', '00000000-0000-0000-0000-0000004043c1');
INSERT INTO public.gc_companies (id, name, trades) VALUES ('00000000-0000-0000-0000-0000004043e1', 'Cedar Fork Drain', ARRAY['Plumbing']);
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000004043f9', 'Sheets Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, development_id) VALUES
  ('00000000-0000-0000-0000-0000004043f1', '00000000-0000-0000-0000-0000004043a2', '00000000-0000-0000-0000-0000004043f9', 'Northgate Tower fit-out', NULL);

-- 0 · Each table carries its fences, its own policies and its grants.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['document_builder_sheets', 'document_builder_links', 'document_builder_sends', 'document_builder_link_opens'] LOOP
    PERFORM dsb.same(t || ' has its archived fence', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'archived_fence')::text, '1');
    PERFORM dsb.same(t || ' has its training-mode policies', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname LIKE 'read_only_users_cannot_%')::text, '3');
    PERFORM dsb.same(t || ' has its twin fence', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname LIKE 'digital_twin_write_fence_%')::text, '3');
    PERFORM dsb.same(t || ' has its training-mode statement trigger', (SELECT count(*) FROM pg_trigger WHERE tgrelid = ('public.' || t)::regclass AND tgname = 'read_only_block_stmt' AND NOT tgisinternal)::text, '1');
    PERFORM dsb.same('anon holds nothing on ' || t, (SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = t AND grantee = 'anon')::text, '0');
  END LOOP;
END $$;
SELECT dsb.same('a signed-in person holds the four row grants on a sheet', (SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'document_builder_sheets' AND grantee = 'authenticated'), 'DELETE, INSERT, SELECT, UPDATE');
SELECT dsb.same('a signed-in person may only read a link', (SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'document_builder_links' AND grantee = 'authenticated'), 'SELECT');
SELECT dsb.same('a signed-in person may only read a link''s opens', (SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'document_builder_link_opens' AND grantee = 'authenticated'), 'SELECT');
SELECT dsb.same('a signed-in person may read a send and change it', (SELECT string_agg(privilege_type, ', ' ORDER BY privilege_type) FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'document_builder_sends' AND grantee = 'authenticated'), 'SELECT, UPDATE');
SELECT dsb.same('one of each policy of a sheet''s own', (SELECT string_agg(policyname, ', ' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_builder_sheets' AND policyname LIKE 'document_builder_sheets_%'), 'document_builder_sheets_delete, document_builder_sheets_insert, document_builder_sheets_select, document_builder_sheets_update');

-- 1 · Dana loads the two builders. Only the one that is a page with blanks takes a job's sheet.
SELECT dsb.as_user('00000000-0000-0000-0000-0000004043a1'); SET LOCAL ROLE authenticated;
SELECT dsb.same('a dev loads a filled builder and a walked one', dsb.touched($q$INSERT INTO public.document_builders (key, kind, draft) VALUES ('insurance', 'filled', '{"fields": {"co": "Acme Plumbing"}}'), ('sub-nda', 'walked', '{"title": "A made-up paper"}')$q$), '2');
SELECT dsb.refused('a job''s sheet on a builder someone walks', $q$INSERT INTO public.document_builder_sheets (builder_key, project_id, draft) VALUES ('sub-nda', '00000000-0000-0000-0000-0000004043d1', '{}')$q$, 'Only a builder that is one page with blanks has a sheet for a job.');
SELECT dsb.same('she starts a job''s sheet, sent as published',
  dsb.touched($q$INSERT INTO public.document_builder_sheets (id, builder_key, project_id, draft, published, published_sheet, revision, usual_revision)
    VALUES ('00000000-0000-0000-0000-0000004043a0', 'insurance', '00000000-0000-0000-0000-0000004043d1', '{"name": "Cedar Park Medical Office"}', '{"name": "Sent"}', '{"co": "Sent"}', 4, 4)$q$), '1');
RESET ROLE;
SELECT dsb.same('its draft is number 0', dsb.past($q$SELECT draft_no::text FROM document_builder_sheets WHERE project_id = '00000000-0000-0000-0000-0000004043d1'$q$), '0');
SELECT dsb.same('it starts as a draft on revision 0', dsb.past($q$SELECT revision::text || ' ' || coalesce(published::text, 'null') || ' ' || coalesce(published_sheet::text, 'null') || ' ' || coalesce(usual_revision::text, 'null') FROM document_builder_sheets WHERE project_id = '00000000-0000-0000-0000-0000004043d1'$q$), '0 null null null');
SELECT dsb.same('who made it is the caller', dsb.past($q$SELECT created_by::text FROM document_builder_sheets WHERE project_id = '00000000-0000-0000-0000-0000004043d1'$q$), '00000000-0000-0000-0000-0000004043a1');
SELECT dsb.as_user('00000000-0000-0000-0000-0000004043a1'); SET LOCAL ROLE authenticated;
SELECT dsb.refused('a second sheet for one job', $q$INSERT INTO public.document_builder_sheets (builder_key, project_id, draft) VALUES ('insurance', '00000000-0000-0000-0000-0000004043d1', '{}')$q$, 'document_builder_sheets_one_a_job');
SELECT dsb.refused('a sheet for a job that is not there', $q$INSERT INTO public.document_builder_sheets (builder_key, project_id, draft) VALUES ('insurance', '00000000-0000-0000-0000-00000040ffff', '{}')$q$, 'foreign key');

-- 2 · A job's sheet goes out only on the usual's published revision.
SELECT dsb.refused('a sheet published before the usual', $q$UPDATE public.document_builder_sheets SET published = draft, published_sheet = '{"co": "Acme Plumbing"}', revision = 1, usual_revision = 1 WHERE project_id = '00000000-0000-0000-0000-0000004043d1'$q$, 'Publish the usual sheet first.');
SELECT dsb.same('she publishes the usual', dsb.touched($q$UPDATE public.document_builders SET published = draft, revision = 1 WHERE key = 'insurance' AND revision = 0$q$), '1');
SELECT dsb.refused('a sheet published on a usual revision that is not the published one', $q$UPDATE public.document_builder_sheets SET published = draft, published_sheet = '{"co": "Acme Plumbing"}', revision = 1, usual_revision = 2 WHERE project_id = '00000000-0000-0000-0000-0000004043d1'$q$, 'The usual sheet is on revision 1.');
SELECT dsb.refused('a new revision with no page', $q$UPDATE public.document_builder_sheets SET published = draft, revision = 1, usual_revision = 1 WHERE project_id = '00000000-0000-0000-0000-0000004043d1'$q$, 'A new revision needs its published copy.');
SELECT dsb.refused('a revision two steps on', $q$UPDATE public.document_builder_sheets SET published = draft, published_sheet = '{"co": "Acme Plumbing"}', revision = 2, usual_revision = 1 WHERE project_id = '00000000-0000-0000-0000-0000004043d1'$q$, 'A revision goes up one at a time.');
SELECT dsb.same('she publishes the job''s sheet', dsb.touched($q$UPDATE public.document_builder_sheets SET published = draft, published_sheet = '{"co": "Acme Plumbing", "place": "410 Sample Street"}', revision = 1, usual_revision = 1, published_by = '00000000-0000-0000-0000-0000004043a2' WHERE project_id = '00000000-0000-0000-0000-0000004043d1' AND revision = 0$q$), '1');
RESET ROLE;
SELECT dsb.same('revision 1 is out, on usual revision 1, by the caller', dsb.past($q$SELECT revision::text || ' ' || usual_revision::text || ' ' || published_by::text || ' ' || (published_at IS NOT NULL)::text FROM document_builder_sheets WHERE project_id = '00000000-0000-0000-0000-0000004043d1'$q$), '1 1 00000000-0000-0000-0000-0000004043a1 true');
SELECT dsb.as_user('00000000-0000-0000-0000-0000004043a1'); SET LOCAL ROLE authenticated;
SELECT dsb.refused('the page changed with no new revision', $q$UPDATE public.document_builder_sheets SET published_sheet = '{"co": "Changed"}' WHERE project_id = '00000000-0000-0000-0000-0000004043d1'$q$, 'A published copy changes only with a new revision.');
SELECT dsb.same('the draft moves on while revision 1 stands', dsb.touched($q$UPDATE public.document_builder_sheets SET draft = '{"name": "Cedar Park Medical Office", "place": "412 Sample Street"}' WHERE project_id = '00000000-0000-0000-0000-0000004043d1'$q$), '1');
SELECT dsb.same('a sheet''s job and builder do not change', dsb.touched($q$UPDATE public.document_builder_sheets SET project_id = '00000000-0000-0000-0000-0000004043d2', builder_key = 'sub-nda' WHERE project_id = '00000000-0000-0000-0000-0000004043d1'$q$), '1');
RESET ROLE;
SELECT dsb.same('it is still Cedar Park''s insurance sheet, and subs still read revision 1', dsb.past($q$SELECT builder_key || ' ' || project_id::text || ' ' || published_sheet::text FROM document_builder_sheets WHERE id = '00000000-0000-0000-0000-0000004043a0'$q$), 'insurance 00000000-0000-0000-0000-0000004043d1 {"co": "Acme Plumbing", "place": "410 Sample Street"}');
SELECT dsb.as_user('00000000-0000-0000-0000-0000004043a1'); SET LOCAL ROLE authenticated;
SELECT dsb.refused('a builder that has a sheet cannot be deleted', $q$DELETE FROM public.document_builders WHERE key = 'insurance'$q$, 'foreign key');

-- 2b · A job's draft has a number (migration *_document_builder_draft_no). A teammate saves the job's draft after
-- this page read it. The page's own save, and the usual's publish to every job from it, land on no row.
RESET ROLE;
SELECT dsb.past($q$SELECT draft_no::text FROM document_builder_sheets WHERE id = '00000000-0000-0000-0000-0000004043a0'$q$) AS n \gset
SELECT dsb.as_user('00000000-0000-0000-0000-0000004043a1'); SET LOCAL ROLE authenticated;
SELECT dsb.same('a teammate''s save, naming the number her page read, lands',
  dsb.touched(format($q$UPDATE public.document_builder_sheets SET draft = '{"name": "Cedar Park Medical Office", "place": "414 Sample Street"}' WHERE id = '00000000-0000-0000-0000-0000004043a0' AND draft_no = %s$q$, :n)), '1');
SELECT dsb.same('a save from the page that fell behind lands on no row',
  dsb.touched(format($q$UPDATE public.document_builder_sheets SET draft = '{"name": "Cedar Park Medical Office", "place": "Typed on the page left open"}' WHERE id = '00000000-0000-0000-0000-0000004043a0' AND draft_no = %s$q$, :n)), '0');
SELECT dsb.same('and so does a publish from it, though the revision it names still stands',
  dsb.touched(format($q$UPDATE public.document_builder_sheets SET draft = published, published_sheet = '{"co": "Acme Plumbing", "place": "From the page left open"}', revision = 2, usual_revision = 1 WHERE id = '00000000-0000-0000-0000-0000004043a0' AND revision = 1 AND draft_no = %s$q$, :n)), '0');
SELECT dsb.same('a number sent by the client is taken as a write', dsb.touched($q$UPDATE public.document_builder_sheets SET draft_no = 900 WHERE id = '00000000-0000-0000-0000-0000004043a0'$q$), '1');
RESET ROLE;
SELECT dsb.same('the teammate''s words stand, subs still read revision 1, and the number went up one',
  dsb.past(format($q$SELECT draft::text || ' ' || revision::text || ' ' || published_sheet::text || ' ' || (draft_no - %s)::text FROM document_builder_sheets WHERE id = '00000000-0000-0000-0000-0000004043a0'$q$, :n)),
  '{"name": "Cedar Park Medical Office", "place": "414 Sample Street"} 1 {"co": "Acme Plumbing", "place": "410 Sample Street"} 1');
SELECT dsb.as_user('00000000-0000-0000-0000-0000004043a1'); SET LOCAL ROLE authenticated;
SELECT dsb.same('a publish that names the number as it now stands lands',
  dsb.touched(format($q$UPDATE public.document_builder_sheets SET published = draft, published_sheet = '{"co": "Acme Plumbing", "place": "414 Sample Street"}', revision = 2, usual_revision = 1 WHERE id = '00000000-0000-0000-0000-0000004043a0' AND revision = 1 AND draft_no = %s$q$, :n + 1)), '1');
SELECT dsb.same('the draft goes back to where the next steps read it', dsb.touched($q$UPDATE public.document_builder_sheets SET draft = '{"name": "Cedar Park Medical Office", "place": "412 Sample Street"}' WHERE id = '00000000-0000-0000-0000-0000004043a0'$q$), '1');
RESET ROLE;
SELECT dsb.same('a publish and a save each moved the number', dsb.past(format($q$SELECT (draft_no - %s)::text || ' on revision ' || revision::text FROM document_builder_sheets WHERE id = '00000000-0000-0000-0000-0000004043a0'$q$, :n)), '3 on revision 2');
SELECT dsb.as_user('00000000-0000-0000-0000-0000004043a1'); SET LOCAL ROLE authenticated;

-- 3 · A link is the function's to write. A dev reads it and writes none.
SELECT dsb.refused('a dev making a link', $q$INSERT INTO public.document_builder_links (builder_key, sheet_id, nonce, code_hash) VALUES ('insurance', '00000000-0000-0000-0000-0000004043a0', repeat('a', 32), repeat('b', 64))$q$, 'permission denied');
RESET ROLE;
SELECT dsb.as_nobody();
INSERT INTO public.document_builder_links (id, builder_key, sheet_id, nonce, code_hash) VALUES ('00000000-0000-0000-0000-000000404311', 'insurance', '00000000-0000-0000-0000-0000004043a0', repeat('a', 32), repeat('b', 64));
SELECT dsb.refused('a second live link to one sheet', $q$INSERT INTO public.document_builder_links (builder_key, sheet_id, nonce, code_hash) VALUES ('insurance', '00000000-0000-0000-0000-0000004043a0', repeat('c', 32), repeat('d', 64))$q$, 'document_builder_links_live_key');
SELECT dsb.refused('a code that is not a hash', $q$INSERT INTO public.document_builder_links (builder_key, nonce, code_hash) VALUES ('sub-nda', repeat('c', 32), 'the-code-itself')$q$, 'document_builder_links_code_hash_check');
UPDATE public.document_builder_links SET ended_at = now() WHERE id = '00000000-0000-0000-0000-000000404311';
INSERT INTO public.document_builder_links (builder_key, sheet_id, nonce, code_hash) VALUES ('insurance', '00000000-0000-0000-0000-0000004043a0', repeat('c', 32), repeat('d', 64));
INSERT INTO public.document_builder_links (builder_key, nonce, code_hash) VALUES ('sub-nda', repeat('e', 32), repeat('f', 64));
SELECT dsb.refused('a second live link to one builder', $q$INSERT INTO public.document_builder_links (builder_key, nonce, code_hash) VALUES ('sub-nda', repeat('1', 32), repeat('2', 64))$q$, 'document_builder_links_live_key');
SELECT dsb.refused('one code under two links', $q$INSERT INTO public.document_builder_links (builder_key, sheet_id, nonce, code_hash) VALUES ('insurance', NULL, repeat('3', 32), repeat('d', 64))$q$, 'document_builder_links_code_hash_key');
SELECT dsb.same('a new link stands beside the ended one', (SELECT count(*)::text || ' ' || count(*) FILTER (WHERE ended_at IS NULL)::text FROM public.document_builder_links WHERE sheet_id = '00000000-0000-0000-0000-0000004043a0'), '2 1');

-- 3b · An open of a link is the function's to write: an account by its id, someone outside by what the browser sent.
INSERT INTO public.document_builder_link_opens (id, link_id, viewer, user_id, revision)
  VALUES ('00000000-0000-0000-0000-000000404331', '00000000-0000-0000-0000-000000404311', 'staff', '00000000-0000-0000-0000-0000004043a1', 1);
INSERT INTO public.document_builder_link_opens (id, link_id, viewer, revision, client_ip, user_agent, device)
  VALUES ('00000000-0000-0000-0000-000000404332', '00000000-0000-0000-0000-000000404311', 'outside', 1, '203.0.113.7', 'A made-up browser', '{"language": "en-US", "timeZone": "America/Chicago", "screen": "390x844"}');
SELECT dsb.refused('an open by nobody we tell apart', $q$INSERT INTO public.document_builder_link_opens (link_id, viewer) VALUES ('00000000-0000-0000-0000-000000404311', 'a stranger')$q$, 'document_builder_link_opens_viewer_check');
SELECT dsb.refused('a device that is not an object', $q$INSERT INTO public.document_builder_link_opens (link_id, viewer, device) VALUES ('00000000-0000-0000-0000-000000404311', 'outside', '[]')$q$, 'document_builder_link_opens_device_check');
SELECT dsb.refused('a device too big to be a few details', $q$INSERT INTO public.document_builder_link_opens (link_id, viewer, device) VALUES ('00000000-0000-0000-0000-000000404311', 'outside', jsonb_build_object('a', (SELECT string_agg(md5(g::text), '') FROM generate_series(1, 400) g)))$q$, 'document_builder_link_opens_device_check');
SELECT dsb.refused('an open of no link', $q$INSERT INTO public.document_builder_link_opens (link_id, viewer) VALUES ('00000000-0000-0000-0000-00000040439f', 'outside')$q$, 'document_builder_link_opens_link_id_fkey');

-- 4 · A send is the function's to write: a sheet to a trade, a builder to a customer.
INSERT INTO public.document_builder_sends (id, builder_key, sheet_id, company_id, contact_name, contact_email, sent_revision, sent_by, sent_by_name)
  VALUES ('00000000-0000-0000-0000-000000404321', 'insurance', '00000000-0000-0000-0000-0000004043a0', '00000000-0000-0000-0000-0000004043e1', 'Ana Pruitt', 'ana@cedarfork.test', 1, '00000000-0000-0000-0000-0000004043a1', 'Dana Dev');
INSERT INTO public.document_builder_sends (id, builder_key, customer_id, contact_name, contact_email, about_job_id, sent_revision)
  VALUES ('00000000-0000-0000-0000-000000404322', 'sub-nda', '00000000-0000-0000-0000-0000004043c2', 'Dana Whitlock', 'dana@northgate.test', '00000000-0000-0000-0000-0000004043f1', 1);
SELECT dsb.refused('a second live send of one sheet to one trade', $q$INSERT INTO public.document_builder_sends (builder_key, sheet_id, company_id, sent_revision) VALUES ('insurance', '00000000-0000-0000-0000-0000004043a0', '00000000-0000-0000-0000-0000004043e1', 1)$q$, 'document_builder_sends_live_key');
SELECT dsb.refused('a send to nobody', $q$INSERT INTO public.document_builder_sends (builder_key, sent_revision) VALUES ('sub-nda', 1)$q$, 'document_builder_sends_one_party');
SELECT dsb.refused('a send to a trade and a customer at once', $q$INSERT INTO public.document_builder_sends (builder_key, company_id, customer_id, sent_revision) VALUES ('sub-nda', '00000000-0000-0000-0000-0000004043e1', '00000000-0000-0000-0000-0000004043c2', 1)$q$, 'document_builder_sends_one_party');
SELECT dsb.refused('a trade''s send about a customer''s job', $q$INSERT INTO public.document_builder_sends (builder_key, company_id, about_job_id, sent_revision) VALUES ('sub-nda', '00000000-0000-0000-0000-0000004043e1', '00000000-0000-0000-0000-0000004043f1', 1)$q$, 'document_builder_sends_about_a_customers_job');
SELECT dsb.refused('an opened day with no revision', $q$UPDATE public.document_builder_sends SET opened_at = now() WHERE id = '00000000-0000-0000-0000-000000404321'$q$, 'document_builder_sends_opened_whole');
UPDATE public.document_builder_sends SET opened_at = now(), opened_revision = 1 WHERE id = '00000000-0000-0000-0000-000000404321';
UPDATE public.document_builder_sends SET sent_at = now(), times_sent = times_sent + 1 WHERE id = '00000000-0000-0000-0000-000000404321';
SELECT dsb.same('the function stamps the open and sends again', (SELECT opened_revision::text || ' ' || times_sent::text FROM public.document_builder_sends WHERE id = '00000000-0000-0000-0000-000000404321'), '1 2');

-- 5 · A dev reads all three, and on a send may only take it off the page, once.
SELECT dsb.as_user('00000000-0000-0000-0000-0000004043a1'); SET LOCAL ROLE authenticated;
SELECT dsb.same('a dev reads the sheet, the links and the sends', dsb.reads(), '1 3 2');
SELECT dsb.same('a dev reads the opens, the account and the outsider', (SELECT count(*)::text || ' ' || count(user_id)::text || ' ' || count(client_ip)::text FROM public.document_builder_link_opens), '2 1 1');
SELECT dsb.refused('a dev writing an open', $q$INSERT INTO public.document_builder_link_opens (link_id, viewer) VALUES ('00000000-0000-0000-0000-000000404311', 'outside')$q$, 'permission denied');
SELECT dsb.refused('a dev deleting an open', $q$DELETE FROM public.document_builder_link_opens$q$, 'permission denied');
SELECT dsb.refused('a dev writing a send', $q$INSERT INTO public.document_builder_sends (builder_key, customer_id, sent_revision) VALUES ('sub-nda', '00000000-0000-0000-0000-0000004043c1', 1)$q$, 'permission denied');
SELECT dsb.refused('a dev deleting a send', $q$DELETE FROM public.document_builder_sends WHERE id = '00000000-0000-0000-0000-000000404321'$q$, 'permission denied');
SELECT dsb.refused('a dev marking a send opened', $q$UPDATE public.document_builder_sends SET opened_at = now(), opened_revision = 3 WHERE id = '00000000-0000-0000-0000-000000404322'$q$, 'A send is changed only by sending again.');
SELECT dsb.same('a dev takes a send off the page', dsb.touched($q$UPDATE public.document_builder_sends SET taken_off_at = '2020-01-01', contact_name = 'Changed', sent_revision = 9, taken_off_by = '00000000-0000-0000-0000-0000004043a2' WHERE id = '00000000-0000-0000-0000-000000404322'$q$), '1');
RESET ROLE;
SELECT dsb.same('only the taking off landed, at the server''s time, by the caller', dsb.past($q$SELECT contact_name || ' ' || sent_revision::text || ' ' || taken_off_by::text || ' ' || (taken_off_at > now() - interval '1 hour')::text FROM document_builder_sends WHERE id = '00000000-0000-0000-0000-000000404322'$q$), 'Dana Whitlock 1 00000000-0000-0000-0000-0000004043a1 true');
SELECT dsb.as_user('00000000-0000-0000-0000-0000004043a1'); SET LOCAL ROLE authenticated;
SELECT dsb.refused('taking it off a second time', $q$UPDATE public.document_builder_sends SET taken_off_at = now() WHERE id = '00000000-0000-0000-0000-000000404322'$q$, 'This send was taken off the page already.');
RESET ROLE;
SELECT dsb.as_nobody();
INSERT INTO public.document_builder_sends (builder_key, customer_id, contact_name, sent_revision) VALUES ('sub-nda', '00000000-0000-0000-0000-0000004043c2', 'Dana Whitlock', 1);
SELECT dsb.same('taking a send off frees its place for a new one', (SELECT count(*)::text FROM public.document_builder_sends WHERE customer_id = '00000000-0000-0000-0000-0000004043c2'), '2');

-- 6 · Every other role: reads nothing, and no write lands.
DO $$
DECLARE who record;
BEGIN
  FOR who IN SELECT * FROM (VALUES
    ('00000000-0000-0000-0000-0000004043a2'::uuid, 'the owner'),
    ('00000000-0000-0000-0000-0000004043a3'::uuid, 'an assistant'),
    ('00000000-0000-0000-0000-0000004043a4'::uuid, 'the controller'),
    ('00000000-0000-0000-0000-0000004043a5'::uuid, 'an estimator'),
    ('00000000-0000-0000-0000-0000004043a6'::uuid, 'a primary'),
    ('00000000-0000-0000-0000-0000004043a7'::uuid, 'a superintendent'),
    ('00000000-0000-0000-0000-0000004043a8'::uuid, 'a helper'),
    ('00000000-0000-0000-0000-0000004043a9'::uuid, 'a sub')) AS t(id, label)
  LOOP
    PERFORM dsb.as_user(who.id);
    SET LOCAL ROLE authenticated;
    PERFORM dsb.same(who.label || ' reads no sheet, link or send', dsb.reads(), '0 0 0');
    PERFORM dsb.same(who.label || ' reads no open of a link', (SELECT count(*)::text FROM public.document_builder_link_opens), '0');
    PERFORM dsb.same(who.label || ' starts no sheet', dsb.touched($q$INSERT INTO public.document_builder_sheets (builder_key, project_id, draft) VALUES ('insurance', '00000000-0000-0000-0000-0000004043d2', '{}')$q$), 'refused');
    PERFORM dsb.same(who.label || ' changes no sheet', dsb.touched($q$UPDATE public.document_builder_sheets SET draft = '{"name": "Changed"}'$q$), '0');
    PERFORM dsb.same(who.label || ' deletes no sheet', dsb.touched($q$DELETE FROM public.document_builder_sheets$q$), '0');
    PERFORM dsb.same(who.label || ' takes no send off', dsb.touched($q$UPDATE public.document_builder_sends SET taken_off_at = now()$q$), '0');
    RESET ROLE;
  END LOOP;
END $$;

-- 7 · The fences. Each of the three is a dev, so nothing but the fence refuses her.
SELECT dsb.as_user('00000000-0000-0000-0000-0000004043b1'); SET LOCAL ROLE authenticated;
SELECT dsb.same('a dev in training reads them', dsb.reads(), '1 3 3');
SELECT dsb.same('and starts no sheet', dsb.touched($q$INSERT INTO public.document_builder_sheets (builder_key, project_id, draft) VALUES ('insurance', '00000000-0000-0000-0000-0000004043d2', '{}')$q$), 'refused');
SELECT dsb.same('and changes no sheet', dsb.touched($q$UPDATE public.document_builder_sheets SET draft = '{"name": "Changed in training"}'$q$), 'refused');
SELECT dsb.same('and takes no send off', dsb.touched($q$UPDATE public.document_builder_sends SET taken_off_at = now() WHERE id = '00000000-0000-0000-0000-000000404321'$q$), 'refused');
RESET ROLE;
SELECT dsb.as_user('00000000-0000-0000-0000-0000004043b2'); SET LOCAL ROLE authenticated;
SELECT dsb.same('a dev''s twin starts no sheet', dsb.touched($q$INSERT INTO public.document_builder_sheets (builder_key, project_id, draft) VALUES ('insurance', '00000000-0000-0000-0000-0000004043d2', '{}')$q$), 'refused');
SELECT dsb.same('and changes no sheet', dsb.touched($q$UPDATE public.document_builder_sheets SET draft = '{"name": "Changed by a twin"}'$q$) IN ('0', 'refused')::text, 'true');
SELECT dsb.same('and takes no send off', dsb.touched($q$UPDATE public.document_builder_sends SET taken_off_at = now() WHERE id = '00000000-0000-0000-0000-000000404321'$q$) IN ('0', 'refused')::text, 'true');
RESET ROLE;
SELECT dsb.as_user('00000000-0000-0000-0000-0000004043b3'); SET LOCAL ROLE authenticated;
SELECT dsb.same('a dev who left reads nothing', dsb.reads(), '0 0 0');
SELECT dsb.same('and starts no sheet', dsb.touched($q$INSERT INTO public.document_builder_sheets (builder_key, project_id, draft) VALUES ('insurance', '00000000-0000-0000-0000-0000004043d2', '{}')$q$), 'refused');
RESET ROLE;
SELECT dsb.same('the sheet and the live send are as they were left', dsb.past($q$SELECT (SELECT draft::text FROM document_builder_sheets WHERE id = '00000000-0000-0000-0000-0000004043a0') || ' ' || (SELECT (taken_off_at IS NULL)::text FROM document_builder_sends WHERE id = '00000000-0000-0000-0000-000000404321')$q$), '{"name": "Cedar Park Medical Office", "place": "412 Sample Street"} true');

-- 8 · Someone not signed in holds no grant at all.
SET LOCAL ROLE anon;
SELECT dsb.refused('someone not signed in reading a sheet', $q$SELECT count(*) FROM public.document_builder_sheets$q$, 'permission denied');
SELECT dsb.refused('someone not signed in reading a link', $q$SELECT count(*) FROM public.document_builder_links$q$, 'permission denied');
SELECT dsb.refused('someone not signed in reading a link''s opens', $q$SELECT count(*) FROM public.document_builder_link_opens$q$, 'permission denied');
SELECT dsb.refused('someone not signed in reading a send', $q$SELECT count(*) FROM public.document_builder_sends$q$, 'permission denied');
RESET ROLE;

-- 9 · A job that goes takes its sheet, its link and its send with it. A link that goes takes its opens.
DELETE FROM public.projects WHERE id = '00000000-0000-0000-0000-0000004043d1';
SELECT dsb.same('the opens went with their link', (SELECT count(*)::text FROM public.document_builder_link_opens), '0');
SELECT dsb.same('the sheet, its links and its send went with the job', (SELECT count(*) FROM public.document_builder_sheets)::text || ' ' || (SELECT count(*) FROM public.document_builder_links WHERE sheet_id IS NOT NULL)::text || ' ' || (SELECT count(*) FROM public.document_builder_sends WHERE sheet_id IS NOT NULL)::text, '0 0 0');

DO $$ BEGIN RAISE NOTICE 'document_builder_sheets PASSED'; END $$;
ROLLBACK;
