-- A sub's company, the ground (migration *_sub_company_ground, punch list #403, step 5): a roster person works for a
-- trade company, the office makes a company's paper, and a person's paper says who they sign for. The scenario, inside
-- one transaction that rolls back:
--   * the link is the office's four roles' to write, through the door and by hand; an estimator, a primary, a
--     superintendent, a sub, a digital twin, a training account, an archived account and a caller who is not signed in
--     write nothing;
--   * the four roles read the link, and nobody else reads a row, a sub's own among them;
--   * a person's paper takes signing_for from the link when it is made and each time it is sent; an unsent paper follows
--     the link and the company's name; a paper that is out keeps what it said until it is sent again; a signed paper
--     never changes; a party's paper, a trade company's own, a paper entered signed and a send that names the business
--     itself are left alone;
--   * the office's four roles make a company's copy of a Contract Book entry, and an estimator, a primary, a twin, a
--     training account and an archived account make none;
--   * the one-press door finds a company by its name or makes it once, as a company we know;
--   * each role reads the papers it read before and no more: the four roles every paper, an estimator the trade
--     company's own paper and no person's paper, linked to a company or not, and everyone else none.
-- Every name, company and address is made up. The records are made as postgres, standing in for the screens; the
-- doors, the papers and the reads run as each user through RLS. Raises on the first failed assertion; ends with
-- "sub_company_ground PASSED". See scripts/pgtest-sub-company-ground.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000005c0d1', 'dev@subco.test'),
  ('00000000-0000-0000-0000-00000005c0d2', 'master@subco.test'),
  ('00000000-0000-0000-0000-00000005c0d3', 'assistant@subco.test'),
  ('00000000-0000-0000-0000-00000005c0d4', 'controller@subco.test'),
  ('00000000-0000-0000-0000-00000005c0d5', 'estimator@subco.test'),
  ('00000000-0000-0000-0000-00000005c0d6', 'primary@subco.test'),
  ('00000000-0000-0000-0000-00000005c0d7', 'super@subco.test'),
  ('00000000-0000-0000-0000-00000005c0d8', 'sub@subco.test'),
  ('00000000-0000-0000-0000-00000005c0d9', 'twin@subco.test'),
  ('00000000-0000-0000-0000-00000005c0da', 'trainee@subco.test'),
  ('00000000-0000-0000-0000-00000005c0db', 'gone@subco.test'),
  ('00000000-0000-0000-0000-00000005c0dc', 'officetwin@subco.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000005c0d1', 'dev@subco.test', 'Subco Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-00000005c0d2', 'master@subco.test', 'Subco Master', 'master_technician', false, false),
  ('00000000-0000-0000-0000-00000005c0d3', 'assistant@subco.test', 'Subco Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000005c0d4', 'controller@subco.test', 'Subco Controller', 'controller', false, false),
  ('00000000-0000-0000-0000-00000005c0d5', 'estimator@subco.test', 'Subco Estimator', 'estimator', false, false),
  ('00000000-0000-0000-0000-00000005c0d6', 'primary@subco.test', 'Subco Primary', 'primary', false, false),
  ('00000000-0000-0000-0000-00000005c0d7', 'super@subco.test', 'Subco Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-00000005c0d8', 'sub@subco.test', 'Marco Ibarra', 'subcontractor', false, false),
  ('00000000-0000-0000-0000-00000005c0d9', 'twin@subco.test', 'Subco Twin', 'estimator', false, true),
  ('00000000-0000-0000-0000-00000005c0da', 'trainee@subco.test', 'Subco Trainee', 'assistant', true, false),
  ('00000000-0000-0000-0000-00000005c0db', 'gone@subco.test', 'Subco Gone', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000005c0dc', 'officetwin@subco.test', 'Subco Office Twin', 'assistant', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
UPDATE public.users SET archived_at = now() WHERE id = '00000000-0000-0000-0000-00000005c0db';

-- Two trade companies, the roster (a sub with a login, a second sub who works for them, a helper), a customer whose
-- contact a party's paper is with, and one Contract Book entry.
INSERT INTO public.gc_companies (id, name, trades, contact_name, email) VALUES
  ('00000000-0000-0000-0000-00000005c0b1', 'Juniper Mechanical LLC', '{Plumbing}', 'Marco Ibarra', 'marco@juniper.example'),
  ('00000000-0000-0000-0000-00000005c0b2', 'Vega Drain Works', '{Plumbing}', '', '');
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  ('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0d2', 'sub', 'Marco Ibarra', '00000000-0000-0000-0000-00000005c0d8'),
  ('00000000-0000-0000-0000-00000005c0e2', '00000000-0000-0000-0000-00000005c0d2', 'sub', 'Dario Vega', NULL),
  ('00000000-0000-0000-0000-00000005c0e3', '00000000-0000-0000-0000-00000005c0d2', 'helper', 'Pat Tallman', NULL);
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-00000005c0c1', 'Ridgeway Builders', '00000000-0000-0000-0000-00000005c0d2');
INSERT INTO public.contract_templates (id, name) VALUES ('00000000-0000-0000-0000-00000005c0a1', 'Subco bed Subs');
INSERT INTO public.contract_template_documents (id, template_id, document_name, book_body_html, book_body_format, canonical_document_url) VALUES
  ('00000000-0000-0000-0000-00000005c0a2', '00000000-0000-0000-0000-00000005c0a1', 'Subcontractor agreement', '<p>The words of the agreement.</p>', 'html', NULL);

CREATE SCHEMA sc;
CREATE FUNCTION sc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION sc.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF position(want IN SQLERRM || ' ' || coalesce(v_detail, '')) = 0 THEN
      RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n% %\n--- want it to hold ---\n%', label, SQLERRM, v_detail, want;
    END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- A statement a fence refuses, whatever the fence's words; its writes go with the refusal.
CREATE FUNCTION sc.fenced(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION sc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Every link, past every policy: person, company and what they are there.
CREATE FUNCTION sc.links() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce(string_agg(p.name || ' at ' || c.name || coalesce(' as ' || l.title, ''), ', ' ORDER BY p.name), 'none')
  FROM public.person_trade_companies l JOIN public.people p ON p.id = l.person_id JOIN public.gc_companies c ON c.id = l.company_id
$$;
-- The links a caller reads, under their own policies.
CREATE FUNCTION sc.my_links() RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.person_trade_companies
$$;
-- What a paper says, past every policy: its state, its roster person or none, and who they sign for.
CREATE FUNCTION sc.paper(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT concat_ws('|', status, CASE WHEN person_id IS NULL THEN 'no person' ELSE 'person' END, coalesce(signing_for, 'nobody'))
  FROM public.person_contract_documents WHERE id = p_id), 'gone')
$$;
-- The papers a caller reads, by the last three of each id.
CREATE FUNCTION sc.rows() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(x.label, ',' ORDER BY x.label), 'none')
  FROM (SELECT CASE WHEN d.company_id IS NOT NULL THEN 'co' ELSE right(d.id::text, 3) END AS label FROM public.person_contract_documents d) x
$$;
-- A trade company's own paper, past every policy: its id, or null when it has none.
CREATE FUNCTION sc.company_paper(p_company uuid) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.person_contract_documents WHERE company_id = p_company ORDER BY created_at, id LIMIT 1
$$;
-- A trade company by its name, past every policy.
CREATE FUNCTION sc.company_named(p_name text) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.gc_companies WHERE name = p_name ORDER BY created_at, id LIMIT 1
$$;
-- A person's own paper, written as the caller under RLS, the way People → Contracts writes one.
CREATE FUNCTION sc.person_paper(p_id uuid, p_name text, p_doc text, p_status text DEFAULT 'unsent') RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.person_contract_documents (id, person_name, document_name, contract_lineage_id, lineage_version, status, signed_at)
  VALUES (p_id, p_name, p_doc, gen_random_uuid(), 1, p_status, CASE WHEN p_status = 'signed' THEN DATE '2026-11-01' END)
$$;
-- A send, as send-contract-for-signature writes it with the service role: the row goes out with a new time.
CREATE FUNCTION sc.send(p_id uuid, p_at timestamptz) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.person_contract_documents SET status = 'sent', sent_at = p_at WHERE id = p_id
$$;
GRANT USAGE ON SCHEMA sc TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sc TO authenticated, anon;

-- 0 · Before anyone is linked: a person's paper says nobody.
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d3');
SET LOCAL ROLE authenticated;
SELECT sc.person_paper('00000000-0000-0000-0000-000005c00101', 'Marco Ibarra', 'Site secrecy agreement');
RESET ROLE;
SELECT sc.same('a person with no company signs for nobody', sc.paper('00000000-0000-0000-0000-000005c00101'), 'unsent|person|nobody');

-- 1 · Who may not link. The door says so in words for a role that is not the office's; a fence refuses the rest.
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d5');
SET LOCAL ROLE authenticated;
SELECT sc.refused('an estimator at the door', $q$SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1')$q$, 'Only the office says which company');
SELECT sc.refused('an estimator at the one-press door', $q$SELECT public.person_trade_company_enter('00000000-0000-0000-0000-00000005c0e1', '{"name": "Estimator Made Co", "trades": ["Plumbing"]}')$q$, 'Only the office says which company');
SELECT sc.fenced('an estimator writing the link by hand', $q$INSERT INTO public.person_trade_companies (person_id, company_id) VALUES ('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1')$q$);
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d6');
SET LOCAL ROLE authenticated;
SELECT sc.refused('a primary at the door', $q$SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1')$q$, 'Only the office says which company');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d7');
SET LOCAL ROLE authenticated;
SELECT sc.refused('a superintendent at the door', $q$SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1')$q$, 'Only the office says which company');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d8');
SET LOCAL ROLE authenticated;
SELECT sc.refused('a sub linking themselves', $q$SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1')$q$, 'Only the office says which company');
SELECT sc.fenced('a sub writing their own link by hand', $q$INSERT INTO public.person_trade_companies (person_id, company_id) VALUES ('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1')$q$);
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d9');
SET LOCAL ROLE authenticated;
SELECT sc.refused('a digital twin at the door', $q$SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1')$q$, 'Only the office says which company');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0dc');
SET LOCAL ROLE authenticated;
SELECT sc.fenced('a digital twin with an office role at the door', $q$SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1')$q$);
SELECT sc.fenced('and writing the link by hand', $q$INSERT INTO public.person_trade_companies (person_id, company_id) VALUES ('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1')$q$);
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0da');
SET LOCAL ROLE authenticated;
SELECT sc.fenced('a training account at the door', $q$SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1')$q$);
SELECT sc.fenced('a training account at the one-press door', $q$SELECT public.person_trade_company_enter('00000000-0000-0000-0000-00000005c0e1', '{"name": "Trainee Made Co", "trades": ["Plumbing"]}')$q$);
SELECT sc.fenced('and writing the link by hand', $q$INSERT INTO public.person_trade_companies (person_id, company_id) VALUES ('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1')$q$);
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0db');
SET LOCAL ROLE authenticated;
SELECT sc.fenced('an archived account at the door', $q$SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1')$q$);
SELECT sc.fenced('and writing the link by hand', $q$INSERT INTO public.person_trade_companies (person_id, company_id) VALUES ('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1')$q$);
RESET ROLE;
SET LOCAL ROLE anon;
SELECT sc.refused('a caller who is not signed in', $q$SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1')$q$, 'permission denied');
SELECT sc.refused('reads no link', $q$SELECT count(*) FROM public.person_trade_companies$q$, 'permission denied');
RESET ROLE;
SELECT sc.same('nobody refused linked anyone', sc.links(), 'none');
SELECT sc.same('or made a company', (SELECT count(*)::text FROM public.gc_companies WHERE name IN ('Estimator Made Co', 'Trainee Made Co')), '0');

-- 2 · The four roles link, move, name what a person is there and take a person off.
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d1');
SET LOCAL ROLE authenticated;
SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1', '  Owner ');
SELECT sc.refused('a person who is not there', $q$SELECT public.person_trade_company_set('00000000-0000-0000-0000-0000005cdead', '00000000-0000-0000-0000-00000005c0b1')$q$, 'No person on the roster with that id.');
SELECT sc.refused('a company that is not there', $q$SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e2', '00000000-0000-0000-0000-0000005cdead')$q$, 'No company with that id.');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d2');
SET LOCAL ROLE authenticated;
SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e2', '00000000-0000-0000-0000-00000005c0b2');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d3');
SET LOCAL ROLE authenticated;
SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e2', '00000000-0000-0000-0000-00000005c0b1');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d4');
SET LOCAL ROLE authenticated;
SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e3', '00000000-0000-0000-0000-00000005c0b2', 'Helper');
SELECT sc.same('the controller reads the three', sc.my_links(), '3');
SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e3', NULL);
RESET ROLE;
SELECT sc.same('a company holds its people, each once, with what they are there', sc.links(),
  'Dario Vega at Juniper Mechanical LLC, Marco Ibarra at Juniper Mechanical LLC as Owner');
SELECT sc.same('a paper not sent yet follows the link', sc.paper('00000000-0000-0000-0000-000005c00101'), 'unsent|person|Juniper Mechanical LLC');

-- 3 · Who reads the link: the four roles, and nobody else, a sub's own among them.
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d1');
SET LOCAL ROLE authenticated;
SELECT sc.same('a dev reads the links', sc.my_links(), '2');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d2');
SET LOCAL ROLE authenticated;
SELECT sc.same('a leader reads the links', sc.my_links(), '2');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d3');
SET LOCAL ROLE authenticated;
SELECT sc.same('an assistant reads the links', sc.my_links(), '2');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0da');
SET LOCAL ROLE authenticated;
SELECT sc.same('a training assistant reads what an assistant reads', sc.my_links(), '2');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d5');
SET LOCAL ROLE authenticated;
SELECT sc.same('an estimator reads no link', sc.my_links(), '0');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d6');
SET LOCAL ROLE authenticated;
SELECT sc.same('a primary reads no link', sc.my_links(), '0');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d7');
SET LOCAL ROLE authenticated;
SELECT sc.same('a superintendent reads no link', sc.my_links(), '0');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d8');
SET LOCAL ROLE authenticated;
SELECT sc.same('a sub reads no link, their own included', sc.my_links(), '0');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d9');
SET LOCAL ROLE authenticated;
SELECT sc.same('a digital twin reads no link', sc.my_links(), '0');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0db');
SET LOCAL ROLE authenticated;
SELECT sc.same('an archived assistant reads no link', sc.my_links(), '0');
RESET ROLE;

-- 4 · A person's paper says who they sign for.
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d3');
SET LOCAL ROLE authenticated;
SELECT sc.person_paper('00000000-0000-0000-0000-000005c00102', 'Dario Vega', 'Site secrecy agreement');
SELECT sc.person_paper('00000000-0000-0000-0000-000005c00103', 'Pat Tallman', 'Employee handbook');
SELECT sc.person_paper('00000000-0000-0000-0000-000005c00104', 'Marco Ibarra', 'Paper entered signed', 'signed');
RESET ROLE;
SELECT sc.same('a new paper for a linked person takes the company', sc.paper('00000000-0000-0000-0000-000005c00102'), 'unsent|person|Juniper Mechanical LLC');
SELECT sc.same('a new paper for a person with no company says nobody', sc.paper('00000000-0000-0000-0000-000005c00103'), 'unsent|person|nobody');
SELECT sc.same('a paper entered already signed is left as it was written', sc.paper('00000000-0000-0000-0000-000005c00104'), 'signed|person|nobody');

-- The send keeps it. A person moved afterwards: the paper that is out keeps what it said, until it is sent again.
SELECT sc.send('00000000-0000-0000-0000-000005c00101', TIMESTAMPTZ '2026-11-20 15:00+00');
SELECT sc.same('the send keeps who they sign for', sc.paper('00000000-0000-0000-0000-000005c00101'), 'sent|person|Juniper Mechanical LLC');
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d3');
SET LOCAL ROLE authenticated;
SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b2', 'Owner');
SELECT sc.person_paper('00000000-0000-0000-0000-000005c00105', 'Marco Ibarra', 'Tool policy');
RESET ROLE;
SELECT sc.same('a paper that is out keeps what it said when it went', sc.paper('00000000-0000-0000-0000-000005c00101'), 'sent|person|Juniper Mechanical LLC');
SELECT sc.same('a new one says the company they work for now', sc.paper('00000000-0000-0000-0000-000005c00105'), 'unsent|person|Vega Drain Works');
SELECT sc.send('00000000-0000-0000-0000-000005c00101', TIMESTAMPTZ '2026-11-21 15:00+00');
SELECT sc.same('sent again, it takes the company they work for now', sc.paper('00000000-0000-0000-0000-000005c00101'), 'sent|person|Vega Drain Works');

-- Signed: it never changes again, whatever the link or the company's name does.
UPDATE public.person_contract_documents SET status = 'signed', signed_at = DATE '2026-11-21', signer_printed_name = 'Marco Ibarra'
  WHERE id = '00000000-0000-0000-0000-000005c00101';
SELECT sc.same('signing changes nothing of it', sc.paper('00000000-0000-0000-0000-000005c00101'), 'signed|person|Vega Drain Works');
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d3');
SET LOCAL ROLE authenticated;
SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e1', '00000000-0000-0000-0000-00000005c0b1', 'Owner');
UPDATE public.gc_companies SET name = 'Juniper Mechanical Inc' WHERE id = '00000000-0000-0000-0000-00000005c0b1';
RESET ROLE;
SELECT sc.same('a signed paper keeps what it said', sc.paper('00000000-0000-0000-0000-000005c00101'), 'signed|person|Vega Drain Works');
SELECT sc.same('an unsent paper follows the person back, under the company''s new name', sc.paper('00000000-0000-0000-0000-000005c00105'), 'unsent|person|Juniper Mechanical Inc');
SELECT sc.same('and so does a workmate''s unsent paper', sc.paper('00000000-0000-0000-0000-000005c00102'), 'unsent|person|Juniper Mechanical Inc');

-- A send that names the business itself is kept as written. A person taken off: their unsent paper says nobody.
UPDATE public.person_contract_documents SET status = 'sent', sent_at = TIMESTAMPTZ '2026-11-22 15:00+00', signing_for = 'A Typed Business'
  WHERE id = '00000000-0000-0000-0000-000005c00105';
SELECT sc.same('a send that names the business keeps it', sc.paper('00000000-0000-0000-0000-000005c00105'), 'sent|person|A Typed Business');
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d3');
SET LOCAL ROLE authenticated;
SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e2', NULL);
RESET ROLE;
SELECT sc.same('a person taken off signs for nobody on an unsent paper', sc.paper('00000000-0000-0000-0000-000005c00102'), 'unsent|person|nobody');
SELECT sc.send('00000000-0000-0000-0000-000005c00103', TIMESTAMPTZ '2026-11-22 16:00+00');
SELECT sc.same('a send for a person with no company says nobody', sc.paper('00000000-0000-0000-0000-000005c00103'), 'sent|person|nobody');
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d3');
SET LOCAL ROLE authenticated;
SELECT public.person_trade_company_set('00000000-0000-0000-0000-00000005c0e2', '00000000-0000-0000-0000-00000005c0b1');
RESET ROLE;

-- A party's paper and a trade company's own are left alone.
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d3');
SET LOCAL ROLE authenticated;
INSERT INTO public.person_contract_documents (id, person_name, party_contact_id, party_name, document_name, contract_lineage_id, lineage_version, status, signing_for)
  SELECT '00000000-0000-0000-0000-000005c00106', 'party:' || x.id::text, x.id, 'Ridgeway Builders', 'Mutual secrecy agreement', gen_random_uuid(), 1, 'unsent', 'Ridgeway Builders'
  FROM (SELECT public.paper_party_contact('customers', '00000000-0000-0000-0000-00000005c0c1') AS id) x;
RESET ROLE;
SELECT sc.send('00000000-0000-0000-0000-000005c00106', TIMESTAMPTZ '2026-11-22 17:00+00');
SELECT sc.same('a party''s paper keeps the business the office named', sc.paper('00000000-0000-0000-0000-000005c00106'), 'sent|no person|Ridgeway Builders');

-- 5 · The office makes a company's paper. An estimator is refused in words; a fence refuses the rest.
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d5');
SET LOCAL ROLE authenticated;
SELECT sc.refused('an estimator makes no company paper', $q$SELECT public.gc_company_paper('00000000-0000-0000-0000-00000005c0b1', '00000000-0000-0000-0000-00000005c0a2')$q$, 'Only the office sends a company its papers.');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d6');
SET LOCAL ROLE authenticated;
SELECT sc.refused('a primary makes no company paper', $q$SELECT public.gc_company_paper('00000000-0000-0000-0000-00000005c0b1', '00000000-0000-0000-0000-00000005c0a2')$q$, 'Only the office sends a company its papers.');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d9');
SET LOCAL ROLE authenticated;
SELECT sc.refused('a digital twin makes no company paper', $q$SELECT public.gc_company_paper('00000000-0000-0000-0000-00000005c0b1', '00000000-0000-0000-0000-00000005c0a2')$q$, 'Only the office sends a company its papers.');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0dc');
SET LOCAL ROLE authenticated;
SELECT sc.fenced('a digital twin with an office role makes no company paper', $q$SELECT public.gc_company_paper('00000000-0000-0000-0000-00000005c0b1', '00000000-0000-0000-0000-00000005c0a2')$q$);
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0da');
SET LOCAL ROLE authenticated;
SELECT sc.fenced('a training account makes no company paper', $q$SELECT public.gc_company_paper('00000000-0000-0000-0000-00000005c0b1', '00000000-0000-0000-0000-00000005c0a2')$q$);
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0db');
SET LOCAL ROLE authenticated;
SELECT sc.fenced('an archived account makes no company paper', $q$SELECT public.gc_company_paper('00000000-0000-0000-0000-00000005c0b1', '00000000-0000-0000-0000-00000005c0a2')$q$);
RESET ROLE;
SELECT sc.same('nobody refused made a company paper', (SELECT count(*)::text FROM public.person_contract_documents WHERE company_id IS NOT NULL), '0');

SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d3');
SET LOCAL ROLE authenticated;
SELECT sc.same('an assistant makes the company''s paper', (public.gc_company_paper('00000000-0000-0000-0000-00000005c0b1', '00000000-0000-0000-0000-00000005c0a2') IS NOT NULL)::text, 'true');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d2');
SET LOCAL ROLE authenticated;
SELECT sc.same('a leader is handed the same paper', (public.gc_company_paper('00000000-0000-0000-0000-00000005c0b1', '00000000-0000-0000-0000-00000005c0a2') = sc.company_paper('00000000-0000-0000-0000-00000005c0b1'))::text, 'true');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d4');
SET LOCAL ROLE authenticated;
SELECT sc.same('the controller is handed the same paper', (public.gc_company_paper('00000000-0000-0000-0000-00000005c0b1', '00000000-0000-0000-0000-00000005c0a2') = sc.company_paper('00000000-0000-0000-0000-00000005c0b1'))::text, 'true');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d1');
SET LOCAL ROLE authenticated;
SELECT sc.same('a dev is handed the same paper', (public.gc_company_paper('00000000-0000-0000-0000-00000005c0b1', '00000000-0000-0000-0000-00000005c0a2') = sc.company_paper('00000000-0000-0000-0000-00000005c0b1'))::text, 'true');
RESET ROLE;
SELECT sc.same('the company has one paper', (SELECT count(*)::text FROM public.person_contract_documents WHERE company_id = '00000000-0000-0000-0000-00000005c0b1'), '1');
SELECT sc.same('the company''s paper: its stored name, no person, unsent, and it signs for nobody', (
  SELECT (person_name = 'gc-company:' || company_id::text)::text || '|' || sc.paper(id)
  FROM public.person_contract_documents WHERE company_id = '00000000-0000-0000-0000-00000005c0b1'), 'true|unsent|no person|nobody');
SELECT sc.send(sc.company_paper('00000000-0000-0000-0000-00000005c0b1'), TIMESTAMPTZ '2026-11-22 18:00+00');
SELECT sc.same('a company''s own paper, sent, still signs for nobody', sc.paper(sc.company_paper('00000000-0000-0000-0000-00000005c0b1')), 'sent|no person|nobody');

-- 6 · The one-press door: found by name, or made once as a company we know.
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d3');
SET LOCAL ROLE authenticated;
SELECT sc.refused('a company with no name', $q$SELECT public.person_trade_company_enter('00000000-0000-0000-0000-00000005c0e3', '{"trades": ["Plumbing"]}')$q$, 'Give the company a name.');
SELECT sc.refused('a new company with no trade', $q$SELECT public.person_trade_company_enter('00000000-0000-0000-0000-00000005c0e3', '{"name": "Tallman Trenching"}')$q$, 'Pick the trade they do.');
SELECT sc.same('a name the app has is found, whatever its case and spaces',
  public.person_trade_company_enter('00000000-0000-0000-0000-00000005c0e3', '{"name": "  vega   DRAIN works "}', 'Foreman')::text, '00000000-0000-0000-0000-00000005c0b2');
SELECT sc.same('a name the app does not have makes the company', (public.person_trade_company_enter('00000000-0000-0000-0000-00000005c0e3', '{"name": "Tallman Trenching", "trades": ["Excavation"], "contactName": "Pat Tallman", "email": "pat@tallman.example"}', 'Owner') = sc.company_named('Tallman Trenching'))::text, 'true');
SELECT sc.same('a second press is handed the same company', (public.person_trade_company_enter('00000000-0000-0000-0000-00000005c0e3', '{"name": "Tallman Trenching", "trades": ["Excavation"]}', 'Owner') = sc.company_named('Tallman Trenching'))::text, 'true');
RESET ROLE;
SELECT sc.same('and makes no second company', (SELECT count(*)::text FROM public.gc_companies WHERE name = 'Tallman Trenching'), '1');
SELECT sc.same('made as a company we know, with its contact', (
  SELECT coalesce(vetting_status, 'known') || '|' || contact_name || '|' || email || '|' || array_to_string(trades, ',')
  FROM public.gc_companies WHERE name = 'Tallman Trenching'), 'known|Pat Tallman|pat@tallman.example|Excavation');
SELECT sc.same('everyone linked, each once', sc.links(),
  'Dario Vega at Juniper Mechanical Inc, Marco Ibarra at Juniper Mechanical Inc as Owner, Pat Tallman at Tallman Trenching as Owner');

-- 7 · Who reads which paper: what each role read before, and no more. 101 to 105 are people's papers, some of them
-- saying a company. 106 is a customer's. co is the trade company's own.
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d1');
SET LOCAL ROLE authenticated;
SELECT sc.same('a dev reads every paper', sc.rows(), '101,102,103,104,105,106,co');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d2');
SET LOCAL ROLE authenticated;
SELECT sc.same('a leader reads every paper', sc.rows(), '101,102,103,104,105,106,co');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d3');
SET LOCAL ROLE authenticated;
SELECT sc.same('an assistant reads every paper', sc.rows(), '101,102,103,104,105,106,co');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d4');
SET LOCAL ROLE authenticated;
SELECT sc.same('the controller reads every paper', sc.rows(), '101,102,103,104,105,106,co');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d5');
SET LOCAL ROLE authenticated;
SELECT sc.same('an estimator reads the customer''s and the trade company''s own, and no person''s paper, linked or not', sc.rows(), '106,co');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d6');
SET LOCAL ROLE authenticated;
SELECT sc.same('a primary reads no paper', sc.rows(), 'none');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d7');
SET LOCAL ROLE authenticated;
SELECT sc.same('a superintendent reads no paper', sc.rows(), 'none');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d8');
SET LOCAL ROLE authenticated;
SELECT sc.same('a sub reads no paper, their own included', sc.rows(), 'none');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0d9');
SET LOCAL ROLE authenticated;
SELECT sc.same('a digital twin reads no paper', sc.rows(), 'none');
RESET ROLE;
SELECT sc.as_user('00000000-0000-0000-0000-00000005c0db');
SET LOCAL ROLE authenticated;
SELECT sc.same('an archived assistant reads no paper', sc.rows(), 'none');
RESET ROLE;

-- 8 · The table's shape: row security on, the four roles' one policy, and a fence of each kind beside it.
SELECT sc.same('row security is on', (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.person_trade_companies'::regclass), 'true');
SELECT sc.same('one policy lets a caller in, and it asks for the office', (
  SELECT string_agg(policyname || ' ' || cmd || ' ' || (qual LIKE '%is_office_staff()%')::text || ' ' || (with_check LIKE '%is_office_staff()%')::text, ' ; ' ORDER BY policyname) FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'person_trade_companies' AND permissive = 'PERMISSIVE'),
  'person_trade_companies_office ALL true true');
SELECT sc.same('training mode, the twin fence and the archived seal are on it', (
  SELECT string_agg(policyname, ',' ORDER BY policyname) FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'person_trade_companies' AND permissive = 'RESTRICTIVE'
    AND policyname IN ('archived_fence', 'digital_twin_write_fence_insert', 'read_only_users_cannot_insert')),
  'archived_fence,digital_twin_write_fence_insert,read_only_users_cannot_insert');

DO $$ BEGIN RAISE NOTICE 'sub_company_ground PASSED'; END $$;
ROLLBACK;
