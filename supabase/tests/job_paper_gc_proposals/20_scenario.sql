-- A GC proposes a stricter setting for a job's paper (punch list #389 step 6, migration *_job_paper_gc_proposals). The
-- service key proposes for the customer who is the job's GC: a proposal that loosens a topic, changes nothing, has no
-- name, skips the notice's box, or names a job that is not theirs is refused, and one that stands changes no paper. A
-- newer proposal overtakes the one waiting, and so does the office's own change of settings and the paper coming off
-- the job. The office declines with a reason the GC's page reads, or takes it: in place while nobody has signed, and as
-- a new version that everyone signs again once somebody has. The GC's page reads the row's picks, the list and the
-- last proposal. Nobody signed in proposes, a helper answers nothing, and the office reads the table.
-- Every word is a made-up placeholder. The fixture is made as postgres; presses run as each user; everything rolls
-- back. Raises on the first failed assertion; ends with "job_paper_gc_proposals PASSED". See
-- scripts/pgtest-job-paper-gc-proposals.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA jpp;
CREATE FUNCTION jpp.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000003896' || p)::uuid $$;
CREATE FUNCTION jpp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION jpp.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION jpp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION jpp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
END $$;
CREATE FUNCTION jpp.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- A job's live required paper for a Book entry, whoever asks.
CREATE FUNCTION jpp.row_of(p_job uuid, p_book uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT r.id FROM public.job_required_papers r WHERE r.job_id = p_job AND r.book_document_id = p_book AND r.removed_at IS NULL
$$;
-- The live row's picks and its number in its chain.
CREATE FUNCTION jpp.picks(p_job uuid, p_book uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT 'r' || r.settings_revision || ' ' || (r.settings ->> 'photos') || '/' || (r.settings ->> 'term')
  FROM public.job_required_papers r WHERE r.job_id = p_job AND r.book_document_id = p_book AND r.removed_at IS NULL
$$;
-- Every proposal on a job, oldest first, as state name photos/term.
CREATE FUNCTION jpp.all_of(p_job uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce(string_agg(x.state || ' ' || x.proposed_by_name || ' ' || (x.settings ->> 'photos') || '/' || (x.settings ->> 'term'), ', ' ORDER BY x.proposed_at, x.id), 'none')
  FROM public.job_paper_proposals x WHERE x.job_id = p_job
$$;
-- The proposal waiting on a job's paper.
CREATE FUNCTION jpp.waiting(p_job uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT x.id FROM public.job_paper_proposals x WHERE x.job_id = p_job AND x.state = 'waiting'
$$;
CREATE FUNCTION jpp.copy_of(p_row uuid, p_person uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT d.id FROM public.person_contract_documents d WHERE d.job_required_paper_id = p_row AND d.person_id = p_person
$$;
-- What accept-contract does to a job's copy when its person signs: the paper as the database reads it now, frozen.
CREATE FUNCTION jpp.sign(p_row uuid, p_person uuid) RETURNS void LANGUAGE sql AS $$
  UPDATE public.person_contract_documents d
    SET status = 'signed', signed_at = public.app_today(), paper_revision = (p.j ->> 'revision')::integer,
        clause_versions = p.j || jsonb_build_object('title', d.document_name, 'between', NULL)
  FROM (SELECT public.job_paper_clauses_now(p_row, 'en') AS j) p
  WHERE d.id = jpp.copy_of(p_row, p_person)
$$;
-- The one paper of one job as the service key reads it for the GC's page: its picks, its basis, whether the list
-- came with it, and its last proposal as state by/why.
CREATE FUNCTION jpp.page(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce((
    SELECT 'r' || (p ->> 'settings_revision') || ' ' || (p -> 'picks' ->> 'photos') || '/' || (p -> 'picks' ->> 'term')
      || ' basis ' || coalesce(p ->> 'basis', '-')
      || ' list ' || jsonb_array_length(p -> 'def' -> 'settings')
      || ' ; ' || CASE WHEN jsonb_typeof(p -> 'proposal') = 'object'
           THEN (p -> 'proposal' ->> 'state') || ' ' || (p -> 'proposal' ->> 'by_name') || ' ' || (p -> 'proposal' -> 'settings' ->> 'photos') || '/' || (p -> 'proposal' -> 'settings' ->> 'term')
             || coalesce(' why ' || (p -> 'proposal' ->> 'why'), '')
           ELSE 'no proposal' END
    FROM jsonb_array_elements(public.job_papers_gc_page(ARRAY[p_job])) AS j, jsonb_array_elements(j -> 'papers') AS p
  ), 'nothing')
$$;
GRANT USAGE ON SCHEMA jpp TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA jpp TO authenticated, anon, service_role;

-- Dana is the office. Hector helps and is on the job's team.
INSERT INTO auth.users (id, email) VALUES (jpp.id('a1'), 'devon@jobproposal.test'), (jpp.id('a2'), 'dana@jobproposal.test'), (jpp.id('a4'), 'hector@jobproposal.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at, login_attached_at) VALUES
  (jpp.id('a1'), 'devon@jobproposal.test', 'Devon Dev Jpp', 'dev', false, false, NULL, now()),
  (jpp.id('a2'), 'dana@jobproposal.test', 'Dana Office Jpp', 'assistant', false, false, NULL, now()),
  (jpp.id('a4'), 'hector@jobproposal.test', 'Hector Helper Jpp', 'helpers', false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, archived_at = EXCLUDED.archived_at, login_attached_at = EXCLUDED.login_attached_at;
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  (jpp.id('b2'), jpp.id('a1'), 'assistant', 'Dana Office Jpp', jpp.id('a2')),
  (jpp.id('b4'), jpp.id('a1'), 'helper', 'Hector Helper Jpp', jpp.id('a4'));

-- Two customers. The first is the GC on the first two jobs. The second is the GC on the third.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  (jpp.id('91'), 'ZZ Test proposing GC', jpp.id('a1')),
  (jpp.id('92'), 'ZZ Test other GC', jpp.id('a1'));
INSERT INTO public.service_types (id, name) VALUES (jpp.id('f9'), 'Job Proposal Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, gc_customer_id) VALUES
  (jpp.id('e1'), jpp.id('a1'), jpp.id('f9'), 'ZZ Test proposal bed job', 'J920', jpp.id('91')),
  (jpp.id('e2'), jpp.id('a1'), jpp.id('f9'), 'ZZ Test prose proposal job', 'J921', jpp.id('91')),
  (jpp.id('e3'), jpp.id('a1'), jpp.id('f9'), 'ZZ Test other GC job', 'J922', jpp.id('92'));
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES (jpp.id('e1'), jpp.id('a4')) ON CONFLICT DO NOTHING;

-- The Contract Book: a paper built from settings that opens on a notice, and site rules in prose.
INSERT INTO public.contract_templates (id, name) VALUES (jpp.id('c0'), 'Job proposal bed packet');
INSERT INTO public.contract_template_documents (id, template_id, document_name, revision, published_at, settings_def) VALUES
  (jpp.id('c1'), jpp.id('c0'), 'Proposal bed paper (test)', 1, now(), $def${
    "settings": [
      { "key": "photos", "label": "Photos and video", "choices": [
        { "key": "off", "label": "Off", "says": "Placeholder: no photo rule.", "out": true },
        { "key": "standard", "label": "Standard", "says": "Placeholder: ask first." },
        { "key": "strict", "label": "Strict", "says": "Placeholder: no photos." } ] },
      { "key": "term", "label": "How long", "choices": [
        { "key": "short", "label": "Short", "says": "Placeholder: a short term." },
        { "key": "long", "label": "Long", "says": "Placeholder: a long term." } ] } ],
    "fields": [],
    "levels": [
      { "key": "standard", "label": "Standard", "alignedWith": "Aligned with a placeholder place", "picks": { "photos": "standard", "term": "short" } },
      { "key": "strict", "label": "Strict", "alignedWith": "Aligned with another placeholder place", "picks": { "photos": "strict", "term": "long" } } ],
    "notice": { "title": "Before you start", "lines": ["Placeholder notice line one."], "tick": "I have read this." }
  }$def$::jsonb);
INSERT INTO public.contract_template_documents (id, template_id, document_name, book_body_html, book_body_format) VALUES
  (jpp.id('c2'), jpp.id('c0'), 'Proposal bed site rules (test)', '<p>Placeholder rules.</p>', 'html');
INSERT INTO public.contract_clauses (id, paper_id, sequence_order, text_en, text_es, scope, slot, when_opts) VALUES
  (jpp.id('d1'), jpp.id('c1'), 1, 'Fixed placeholder one.', '', ARRAY['all'], NULL, NULL);

-- Dana requires the paper at its Standard level on the first and third jobs, and the prose paper on the second.
SELECT jpp.as_user(jpp.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jpp.same('Dana requires the paper built from settings', public.job_papers_require(jpp.id('e1'), ARRAY[jpp.id('c1')],
  jsonb_build_object(jpp.id('c1')::text, '{"settings":{"photos":"standard","term":"short"},"basis":"standard","notice_read":true}'::jsonb))::text, '1');
SELECT jpp.same('and on the other GC''s job', public.job_papers_require(jpp.id('e3'), ARRAY[jpp.id('c1')],
  jsonb_build_object(jpp.id('c1')::text, '{"settings":{"photos":"standard","term":"short"},"basis":"standard","notice_read":true}'::jsonb))::text, '1');
SELECT jpp.same('and the prose paper on another job', public.job_papers_require(jpp.id('e2'), ARRAY[jpp.id('c2')])::text, '1');

-- Only the service key proposes.
SELECT jpp.refused('the office does not propose for a GC', format($q$SELECT public.job_paper_propose(%L, %L, NULL, '{"photos":"strict","term":"short"}'::jsonb, 'Greta Gc', true)$q$, jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91')), 'permission denied');
RESET ROLE;
SELECT jpp.signed_out();
SET LOCAL ROLE anon;
SELECT jpp.refused('signed out, nobody proposes', format($q$SELECT public.job_paper_propose(%L, %L, NULL, '{"photos":"strict","term":"short"}'::jsonb, 'Greta Gc', true)$q$, jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91')), 'permission denied');
RESET ROLE;

-- What the service key is refused.
SELECT jpp.as_service();
SET LOCAL ROLE service_role;
SELECT jpp.same('before any proposal the page reads the picks, the basis and the list', jpp.page(jpp.id('e1')), 'r1 standard/short basis standard list 2 ; no proposal');
SELECT jpp.refused('a looser topic is refused', format($q$SELECT public.job_paper_propose(%L, %L, NULL, '{"photos":"off","term":"short"}'::jsonb, 'Greta Gc', true)$q$, jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91')), 'can only make the paper stricter');
SELECT jpp.refused('one topic stricter and one looser is refused', format($q$SELECT public.job_paper_propose(%L, %L, NULL, '{"photos":"off","term":"long"}'::jsonb, 'Greta Gc', true)$q$, jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91')), 'can only make the paper stricter');
SELECT jpp.refused('the same picks are refused', format($q$SELECT public.job_paper_propose(%L, %L, NULL, '{"photos":"standard","term":"short"}'::jsonb, 'Greta Gc', true)$q$, jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91')), 'Nothing is stricter yet');
SELECT jpp.refused('a choice the list does not have is refused', format($q$SELECT public.job_paper_propose(%L, %L, NULL, '{"photos":"loud","term":"short"}'::jsonb, 'Greta Gc', true)$q$, jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91')), 'Pick Photos and video');
SELECT jpp.refused('a topic left out is refused', format($q$SELECT public.job_paper_propose(%L, %L, NULL, '{"photos":"strict"}'::jsonb, 'Greta Gc', true)$q$, jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91')), 'Pick How long');
SELECT jpp.refused('no name is refused', format($q$SELECT public.job_paper_propose(%L, %L, NULL, '{"photos":"strict","term":"short"}'::jsonb, '  ', true)$q$, jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91')), 'Type your name first');
SELECT jpp.refused('the notice''s box left empty is refused', format($q$SELECT public.job_paper_propose(%L, %L, NULL, '{"photos":"strict","term":"short"}'::jsonb, 'Greta Gc', false)$q$, jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91')), 'Tick the box under the notice first');
SELECT jpp.refused('another customer''s job is refused', format($q$SELECT public.job_paper_propose(%L, %L, NULL, '{"photos":"strict","term":"short"}'::jsonb, 'Greta Gc', true)$q$, jpp.row_of(jpp.id('e3'), jpp.id('c1')), jpp.id('91')), 'not one you are the general contractor on');
SELECT jpp.refused('a paper in prose has nothing to propose', format($q$SELECT public.job_paper_propose(%L, %L, NULL, '{"photos":"strict","term":"short"}'::jsonb, 'Greta Gc', true)$q$, jpp.row_of(jpp.id('e2'), jpp.id('c2')), jpp.id('91')), 'not built from settings');
SELECT jpp.same('nothing was written by a refusal', jpp.all_of(jpp.id('e1')), 'none');

-- One that stands. It changes no paper.
SELECT jpp.same('a stricter topic is taken as a proposal', (public.job_paper_propose(jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91'), NULL, '{"photos":"strict","term":"short","extra":"dropped"}'::jsonb, '  Greta Gc  ', true) ? 'id')::text, 'true');
SELECT jpp.same('it waits, under the typed name, with only the list''s topics', jpp.all_of(jpp.id('e1')), 'waiting Greta Gc strict/short');
SELECT jpp.same('the paper is as it was', jpp.picks(jpp.id('e1'), jpp.id('c1')), 'r1 standard/short');
SELECT jpp.same('the GC''s page reads its own proposal', jpp.page(jpp.id('e1')), 'r1 standard/short basis standard list 2 ; waiting Greta Gc strict/short');
SELECT jpp.same('the other GC''s job reads none', jpp.page(jpp.id('e3')), 'r1 standard/short basis standard list 2 ; no proposal');
-- A newer one overtakes it.
SELECT jpp.same('a second proposal is taken too', (public.job_paper_propose(jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91'), NULL, '{"photos":"strict","term":"long"}'::jsonb, 'Greta Gc', true) ? 'id')::text, 'true');
SELECT jpp.same('and the first is overtaken', jpp.all_of(jpp.id('e1')), 'overtaken Greta Gc strict/short, waiting Greta Gc strict/long');
RESET ROLE;

-- The office reads the table. A helper reads none of it and answers nothing.
SELECT jpp.as_user(jpp.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jpp.same('Dana reads both proposals', (SELECT count(*)::text FROM public.job_paper_proposals x WHERE x.job_id = jpp.id('e1')), '2');
SELECT jpp.refused('Dana writes no row by hand', format($q$UPDATE public.job_paper_proposals SET state = 'taken' WHERE job_id = %L$q$, jpp.id('e1')), 'permission denied');
RESET ROLE;
SELECT jpp.as_user(jpp.id('a4'));
SET LOCAL ROLE authenticated;
SELECT jpp.same('a helper reads no proposal', (SELECT count(*)::text FROM public.job_paper_proposals), '0');
SELECT jpp.refused('a helper answers no proposal', format($q$SELECT public.job_paper_proposal_decide(%L, true)$q$, jpp.waiting(jpp.id('e1'))), 'Only the office sets the papers a job requires');
RESET ROLE;

-- Dana declines, with a reason the GC's page reads.
SELECT jpp.as_user(jpp.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jpp.same('Dana declines the one waiting', public.job_paper_proposal_decide(jpp.waiting(jpp.id('e1')), false, '  Placeholder reason.  ') ->> 'proposal', 'declined');
SELECT jpp.same('the paper is still as it was', jpp.picks(jpp.id('e1'), jpp.id('c1')), 'r1 standard/short');
SELECT jpp.same('the decline keeps who and why', (SELECT x.decided_by_name || '|' || x.decline_why || '|' || (x.decided_at IS NOT NULL)::text FROM public.job_paper_proposals x WHERE x.job_id = jpp.id('e1') AND x.state = 'declined'), 'Dana Office Jpp|Placeholder reason.|true');
SELECT jpp.refused('a proposal already answered is not answered again', format($q$SELECT public.job_paper_proposal_decide(%L, true)$q$, (SELECT x.id FROM public.job_paper_proposals x WHERE x.job_id = jpp.id('e1') AND x.state = 'declined')), 'no longer waiting');
RESET ROLE;
SELECT jpp.as_service();
SET LOCAL ROLE service_role;
SELECT jpp.same('the GC''s page reads the decline and its reason', jpp.page(jpp.id('e1')), 'r1 standard/short basis standard list 2 ; declined Greta Gc strict/long why Placeholder reason.');

-- A take while nobody has signed saves in place.
SELECT jpp.same('a third proposal', (public.job_paper_propose(jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91'), NULL, '{"photos":"strict","term":"short"}'::jsonb, 'Greta Gc', true) ? 'id')::text, 'true');
RESET ROLE;
SELECT jpp.as_user(jpp.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jpp.same('Dana takes it, and nobody signs again', (SELECT (r ->> 'proposal') || '|' || (r ->> 'state') || '|' || (r ->> 'sign_again') FROM public.job_paper_proposal_decide(jpp.waiting(jpp.id('e1')), true) AS r), 'taken|saved|0');
SELECT jpp.same('the paper now holds the proposed picks on the same row', jpp.picks(jpp.id('e1'), jpp.id('c1')), 'r1 strict/short');
SELECT jpp.same('the take names the row it was taken as', (SELECT (x.taken_as = jpp.row_of(jpp.id('e1'), jpp.id('c1')))::text || '|' || x.decided_by_name FROM public.job_paper_proposals x WHERE x.job_id = jpp.id('e1') AND x.state = 'taken'), 'true|Dana Office Jpp');
RESET ROLE;
SELECT jpp.as_service();
SET LOCAL ROLE service_role;
SELECT jpp.same('the GC''s page reads the take and the new picks', jpp.page(jpp.id('e1')), 'r1 strict/short basis standard list 2 ; taken Greta Gc strict/short');

-- The office's own change overtakes a proposal that waits.
SELECT jpp.same('a fourth proposal', (public.job_paper_propose(jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91'), NULL, '{"photos":"strict","term":"long"}'::jsonb, 'Greta Gc', true) ? 'id')::text, 'true');
RESET ROLE;
SELECT jpp.as_user(jpp.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jpp.same('Dana loosens the paper herself', (SELECT r ->> 'state' FROM public.job_paper_set_settings(jpp.row_of(jpp.id('e1'), jpp.id('c1')), '{"photos":"standard","term":"short"}'::jsonb) AS r), 'saved');
SELECT jpp.same('the proposal that waited is overtaken', (SELECT count(*)::text || '|' || coalesce(jpp.waiting(jpp.id('e1'))::text, 'none waiting') FROM public.job_paper_proposals x WHERE x.job_id = jpp.id('e1') AND x.state = 'overtaken'), '2|none waiting');

-- A take after a signature makes a new version that everyone signs again.
SELECT jpp.same('Dana starts Hector''s copy', (public.job_paper_start(jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('b4')) IS NOT NULL)::text, 'true');
RESET ROLE;
SELECT jpp.signed_out();
SELECT jpp.sign(jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('b4'));
SELECT jpp.as_service();
SET LOCAL ROLE service_role;
SELECT jpp.same('a fifth proposal, after a signature', (public.job_paper_propose(jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91'), NULL, '{"photos":"standard","term":"long"}'::jsonb, 'Greta Gc', true) ? 'id')::text, 'true');
RESET ROLE;
SELECT jpp.as_user(jpp.id('a2'));
SET LOCAL ROLE authenticated;
SELECT jpp.same('Dana takes it, and one person signs again', (SELECT (r ->> 'proposal') || '|' || (r ->> 'state') || '|' || (r ->> 'sign_again') FROM public.job_paper_proposal_decide(jpp.waiting(jpp.id('e1')), true) AS r), 'taken|revised|1');
SELECT jpp.same('the paper is a new version with the proposed picks', jpp.picks(jpp.id('e1'), jpp.id('c1')), 'r2 standard/long');
SELECT jpp.same('the take names the new version, and stays taken', (SELECT (x.taken_as = jpp.row_of(jpp.id('e1'), jpp.id('c1')))::text || '|' || (x.required_paper_id <> x.taken_as)::text FROM public.job_paper_proposals x WHERE x.job_id = jpp.id('e1') AND x.state = 'taken' AND x.settings ->> 'term' = 'long'), 'true|true');
RESET ROLE;
SELECT jpp.as_service();
SET LOCAL ROLE service_role;
SELECT jpp.same('the GC''s page reads the take on the new version', jpp.page(jpp.id('e1')), 'r2 standard/long basis standard list 2 ; taken Greta Gc standard/long');

-- The paper coming off the job overtakes a proposal that waits, and the page says nothing.
SELECT jpp.same('a sixth proposal', (public.job_paper_propose(jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91'), NULL, '{"photos":"strict","term":"long"}'::jsonb, 'Greta Gc', true) ? 'id')::text, 'true');
SELECT jpp.refused('a seventh in one hour is refused', format($q$SELECT public.job_paper_propose(%L, %L, NULL, '{"photos":"strict","term":"long"}'::jsonb, 'Greta Gc', true)$q$, jpp.row_of(jpp.id('e1'), jpp.id('c1')), jpp.id('91')), 'many proposals in one hour');
RESET ROLE;
SELECT jpp.as_user(jpp.id('a2'));
SET LOCAL ROLE authenticated;
SELECT public.job_paper_remove(jpp.row_of(jpp.id('e1'), jpp.id('c1')));
SELECT jpp.same('taken off, nothing waits', coalesce(jpp.waiting(jpp.id('e1'))::text, 'none waiting'), 'none waiting');
SELECT jpp.same('six proposals in all, none lost', (SELECT count(*)::text FROM public.job_paper_proposals x WHERE x.job_id = jpp.id('e1')), '6');
RESET ROLE;
SELECT jpp.as_service();
SET LOCAL ROLE service_role;
SELECT jpp.same('a paper taken off the job is not read', jpp.page(jpp.id('e1')), 'nothing');
SELECT jpp.refused('and takes no proposal', format($q$SELECT public.job_paper_propose(%L, %L, NULL, '{"photos":"strict","term":"long"}'::jsonb, 'Greta Gc', true)$q$, (SELECT x.taken_as FROM public.job_paper_proposals x WHERE x.job_id = jpp.id('e1') AND x.state = 'taken' AND x.settings ->> 'term' = 'long'), jpp.id('91')), 'no longer requires that paper');
RESET ROLE;
SELECT jpp.signed_out();

SELECT jpp.same('who may call what', (
  SELECT string_agg(p.proname || ':' || has_function_privilege('authenticated', p.oid, 'EXECUTE') || '/' || has_function_privilege('anon', p.oid, 'EXECUTE') || '/' || has_function_privilege('service_role', p.oid, 'EXECUTE'), ' ' ORDER BY p.proname)
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('job_paper_propose', 'job_paper_proposal_decide', 'job_papers_gc_page')),
  'job_paper_proposal_decide:true/false/true job_paper_propose:false/false/true job_papers_gc_page:false/false/true');

DO $$ BEGIN RAISE NOTICE 'job_paper_gc_proposals PASSED'; END $$;
ROLLBACK;
