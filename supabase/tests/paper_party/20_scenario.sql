-- Where an outside signer lives, the ground (migration *_paper_party, punch list #403): a paper names the contact of
-- the outside party it is with, and keeps who signs. The scenario, inside one transaction that rolls back:
--   * the door paper_party_contact finds or makes the contact of each kind of record a paper can be with, for the four
--     roles that send a paper and nobody else, and a named contact with no record is allowed and sits on no lane;
--   * a party's paper is filed under a name no person can have, keeps no roster person even when the party is named like
--     one, and takes its party back from that name; the two checks hold the shape both ways;
--   * Documents → Agreements lists a party's paper under one of four new kinds, by the record's own name, with who
--     signs in its facts, and never shows or searches the stored name;
--   * each role reads what it read before and no more, but the estimator, who reads every kind of an outside company's
--     paper, a W-9 and a certificate among them (migration *_estimator_reads_outside_papers, the owner's call 9), and
--     still no staff paper, no sub's own, no person's tax form and nobody on no list; a digital twin and an archived
--     account read none;
--   * estimator_reads_paper, which the signed form's gate asks, answers yes for exactly the papers an estimator reads,
--     and no for everyone who is not an estimator;
--   * the paper follows its contact through Who is this?, a fold run by an estimator who may not write a paper, and a
--     record deleted by a screen, where the frozen name still says who it was with;
--   * the fold's helper, called by hand, moves nothing for a twin, a training account, an archived account or a primary;
--   * the e-sign ledger takes the audience 'outside'.
-- Every name, company, address and date is made up. The records are made as postgres, standing in for the screens;
-- the door, the papers and the reads run as each user through RLS. Raises on the first failed assertion; ends with
-- "paper_party PASSED". See scripts/pgtest-paper-party.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000403d1', 'dev@party.test'),
  ('00000000-0000-0000-0000-0000000403d2', 'master@party.test'),
  ('00000000-0000-0000-0000-0000000403d3', 'assistant@party.test'),
  ('00000000-0000-0000-0000-0000000403d4', 'controller@party.test'),
  ('00000000-0000-0000-0000-0000000403d5', 'estimator@party.test'),
  ('00000000-0000-0000-0000-0000000403d6', 'primary@party.test'),
  ('00000000-0000-0000-0000-0000000403d7', 'super@party.test'),
  ('00000000-0000-0000-0000-0000000403d8', 'sub@party.test'),
  ('00000000-0000-0000-0000-0000000403d9', 'twin@party.test'),
  ('00000000-0000-0000-0000-0000000403da', 'trainee@party.test'),
  ('00000000-0000-0000-0000-0000000403db', 'gone@party.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000403d1', 'dev@party.test', 'Party Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000403d2', 'master@party.test', 'Party Master', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000403d3', 'assistant@party.test', 'Party Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000403d4', 'controller@party.test', 'Party Controller', 'controller', false, false),
  ('00000000-0000-0000-0000-0000000403d5', 'estimator@party.test', 'Party Estimator', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000403d6', 'primary@party.test', 'Party Primary', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000403d7', 'super@party.test', 'Party Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000403d8', 'sub@party.test', 'Ortega Mechanical', 'subcontractor', false, false),
  ('00000000-0000-0000-0000-0000000403d9', 'twin@party.test', 'Party Twin', 'estimator', false, true),
  ('00000000-0000-0000-0000-0000000403da', 'trainee@party.test', 'Party Trainee', 'assistant', true, false),
  ('00000000-0000-0000-0000-0000000403db', 'gone@party.test', 'Party Gone', 'estimator', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
UPDATE public.users SET archived_at = now() WHERE id = '00000000-0000-0000-0000-0000000403db';

-- The records a paper can be with: a customer and a person there, a supply house with a rep and an insurer with nobody,
-- a trade company and a person there. And the roster: a helper and a sub.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000000403c1', 'Ridgeway Builders', '00000000-0000-0000-0000-0000000403d2');
INSERT INTO public.customer_contact_persons (id, customer_id, name, phone, email) VALUES
  ('00000000-0000-0000-0000-0000000403c2', '00000000-0000-0000-0000-0000000403c1', 'Dana Ruiz', '(210) 555-0141', 'dana@ridgeway.example');
INSERT INTO public.supply_houses (id, name, phone, vendor_kind) VALUES
  ('00000000-0000-0000-0000-0000000403a1', 'Tallgrass Supply Co.', '(210) 555-0142', 'supply_house'),
  ('00000000-0000-0000-0000-0000000403a2', 'Cedar Mutual Insurance', '(210) 555-0143', 'insurer');
INSERT INTO public.supply_house_contacts (id, supply_house_id, label, name, email, phone) VALUES
  ('00000000-0000-0000-0000-0000000403a3', '00000000-0000-0000-0000-0000000403a1', 'Lena', 'Lena Park', 'lena@tallgrass.example', '(210) 555-0144');
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-0000000403b1', 'Juniper Mechanical LLC', '{Plumbing}');
INSERT INTO public.gc_company_people (id, company_id, name, email) VALUES
  ('00000000-0000-0000-0000-0000000403b2', '00000000-0000-0000-0000-0000000403b1', 'Dario Vega', 'dario@juniper.example');
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  ('00000000-0000-0000-0000-0000000403e1', '00000000-0000-0000-0000-0000000403d2', 'helper', 'Pat Tallman', NULL),
  ('00000000-0000-0000-0000-0000000403e2', '00000000-0000-0000-0000-0000000403d2', 'sub', 'Ortega Mechanical', '00000000-0000-0000-0000-0000000403d8');

CREATE SCHEMA pp;
CREATE FUNCTION pp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION pp.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION pp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The contact on a record, the company's own (no name), past every policy.
CREATE FUNCTION pp.on(p_column text, p_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v uuid;
BEGIN
  EXECUTE format('SELECT id FROM public.contacts WHERE %I = $1 AND name IS NULL', p_column) INTO v USING p_id;
  RETURN v;
END $$;
-- The contact an address belongs to, past every policy.
CREATE FUNCTION pp.by_email(p_email text) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT ch.contact_id FROM public.contact_channels ch WHERE ch.kind = 'email' AND ch.key = lower(p_email) ORDER BY ch.created_at LIMIT 1
$$;
-- Who a contact is, in one line, past every policy.
CREATE FUNCTION pp.who(p_contact uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT concat_ws('|', kind,
    CASE WHEN customer_id IS NOT NULL THEN 'customer'
         WHEN customer_contact_person_id IS NOT NULL THEN 'customer person'
         WHEN gc_company_id IS NOT NULL THEN 'trade company'
         WHEN gc_company_person_id IS NOT NULL THEN 'trade person'
         WHEN person_id IS NOT NULL THEN 'roster'
         WHEN supply_house_id IS NOT NULL THEN 'house'
         WHEN supply_house_contact_id IS NOT NULL THEN 'rep'
         ELSE 'no record' END,
    coalesce(name, '-'),
    (SELECT string_agg(ch.kind || ' ' || ch.key, ',' ORDER BY ch.kind, ch.key) FROM public.contact_channels ch WHERE ch.contact_id = contacts.id))
  FROM public.contacts WHERE id = p_contact), 'gone')
$$;
-- A paper, in one line, past every policy: its party, the name it is filed under, its frozen name and its roster person.
CREATE FUNCTION pp.paper(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT concat_ws('|', coalesce(right(party_contact_id::text, 4), 'no party'), (person_name = 'party:' || party_contact_id::text)::text, party_name, coalesce(person_id::text, 'no person'))
  FROM public.person_contract_documents WHERE id = p_id), 'gone')
$$;
-- A party's paper, written as the caller under RLS, the way the Send a paper window will write it.
CREATE FUNCTION pp.send(p_id uuid, p_contact uuid, p_party text, p_doc text, p_status text, p_signer text, p_title text, p_email text, p_for text,
                        p_doc_type text DEFAULT 'agreement', p_sent timestamptz DEFAULT NULL, p_signed date DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.person_contract_documents (id, person_name, party_contact_id, party_name, document_name, contract_lineage_id, lineage_version, status, doc_type, sent_at, signed_at, signer_name, signer_title, signer_email, signing_for)
  VALUES (p_id, 'party:' || p_contact::text, p_contact, p_party, p_doc, gen_random_uuid(), 1, p_status, p_doc_type, p_sent, p_signed, p_signer, p_title, p_email, p_for)
$$;
-- The rows of the table a caller reads, by the last three of each id.
CREATE FUNCTION pp.rows() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(right(d.id::text, 3), ',' ORDER BY d.id), 'none') FROM public.person_contract_documents d
$$;
-- Every paper's id, past every policy: what the gate's question is asked of, one paper at a time.
CREATE FUNCTION pp.all_papers() RETURNS uuid[] LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce(array_agg(d.id ORDER BY d.id), '{}') FROM public.person_contract_documents d
$$;
CREATE FUNCTION pp.kinds() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(x.kind || ' ' || x.n::text, ', ' ORDER BY x.kind), 'none')
  FROM (SELECT kind, count(*) AS n FROM public.agreements_on_file GROUP BY kind) x
$$;
-- A party's lines as the page reads them, newest first: kind, state, paper, party, what the party is, who signs.
CREATE FUNCTION pp.lines() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(concat_ws('|', a.kind, a.state, a.paper_name, a.with_name, a.facts->>'party_kind', coalesce(a.facts->>'signer_name', '-'),
    coalesce(a.facts->>'signer_title', '-'), coalesce(a.facts->>'signing_for', '-'), coalesce(a.facts->>'signer_printed_name', '-'), a.at_day::text), E'\n' ORDER BY a.at DESC, a.id DESC), '')
  FROM public.agreements_on_file a
  WHERE a.kind IN ('customer_agreement', 'supply_house_agreement', 'trade_agreement', 'outside_agreement')
$$;
GRANT USAGE ON SCHEMA pp TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pp TO authenticated, anon;

-- 1 · The door: each kind of record a paper can be with. Messages' seed gave the supply house's counter and its rep a
-- contact already; the insurer, the customer, the person there, the trade company and the person there have none.
SELECT public.contacts_from_supply_houses();
SELECT pp.same('before the door, Messages knows the supply house and its rep alone',
  (SELECT string_agg(pp.who(id), ', ' ORDER BY pp.who(id)) FROM public.contacts),
  'supply_house|house|-|phone 2105550142, supply_house|rep|-|email lena@tallgrass.example,phone 2105550144');

SELECT pp.as_user('00000000-0000-0000-0000-0000000403d3');
SET LOCAL ROLE authenticated;
SELECT pp.same('the door finds the supply house''s own contact', public.paper_party_contact('supply_houses', '00000000-0000-0000-0000-0000000403a1')::text, pp.on('supply_house_id', '00000000-0000-0000-0000-0000000403a1')::text);
SELECT pp.same('and the rep''s', (pp.who(public.paper_party_contact('supply_house_contacts', '00000000-0000-0000-0000-0000000403a3'))), 'supply_house|rep|-|email lena@tallgrass.example,phone 2105550144');
SELECT pp.same('it makes the customer''s on first use', pp.who(public.paper_party_contact('customers', '00000000-0000-0000-0000-0000000403c1')), 'customer|customer|-');
SELECT pp.same('and the person''s at the customer, with their number and address', pp.who(public.paper_party_contact('customer_contact_persons', '00000000-0000-0000-0000-0000000403c2')), 'customer|customer person|-|email dana@ridgeway.example,phone 2105550141');
SELECT pp.same('and a vendor''s that is no supply house', pp.who(public.paper_party_contact('supply_houses', '00000000-0000-0000-0000-0000000403a2')), 'supply_house|house|-|phone 2105550143');
SELECT pp.same('and the trade company''s', pp.who(public.paper_party_contact('gc_companies', '00000000-0000-0000-0000-0000000403b1')), 'trade|trade company|-');
SELECT pp.same('and the person''s at the trade company', pp.who(public.paper_party_contact('gc_company_people', '00000000-0000-0000-0000-0000000403b2')), 'trade|trade person|-|email dario@juniper.example');
SELECT pp.same('a second ask makes no second contact',
  (public.paper_party_contact('customer_contact_persons', '00000000-0000-0000-0000-0000000403c2') = public.paper_party_contact('customer_contact_persons', '00000000-0000-0000-0000-0000000403c2'))::text, 'true');
SELECT pp.refused('a table the door does not know', $q$SELECT public.paper_party_contact('people', '00000000-0000-0000-0000-0000000403e1')$q$, 'Pick who the paper is with');
SELECT pp.refused('a record that is not there', $q$SELECT public.paper_party_contact('supply_houses', '00000000-0000-0000-0000-00000403dead')$q$, 'That record is not there');
RESET ROLE;
SELECT pp.same('seven contacts, one a record', (SELECT count(*)::text FROM public.contacts), '7');

-- The door is the four roles': an estimator, a primary and an archived account are refused, and a training account
-- finds a contact and never makes one.
INSERT INTO public.supply_houses (id, name, phone, vendor_kind) VALUES
  ('00000000-0000-0000-0000-0000000403a9', 'No Contact Yet Rentals', '(210) 555-0149', 'rental_yard');
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d5');
SET LOCAL ROLE authenticated;
SELECT pp.refused('an estimator at the door', $q$SELECT public.paper_party_contact('supply_houses', '00000000-0000-0000-0000-0000000403a1')$q$, 'Only the office sends a paper');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d6');
SET LOCAL ROLE authenticated;
SELECT pp.refused('a primary at the door', $q$SELECT public.paper_party_contact('supply_houses', '00000000-0000-0000-0000-0000000403a1')$q$, 'Only the office sends a paper');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403db');
SET LOCAL ROLE authenticated;
SELECT pp.refused('an archived account at the door', $q$SELECT public.paper_party_contact('supply_houses', '00000000-0000-0000-0000-0000000403a1')$q$, 'archived account');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403da');
SET LOCAL ROLE authenticated;
SELECT pp.same('a training account finds a contact', public.paper_party_contact('supply_houses', '00000000-0000-0000-0000-0000000403a1')::text, pp.on('supply_house_id', '00000000-0000-0000-0000-0000000403a1')::text);
SELECT pp.refused('and never makes one', $q$SELECT public.paper_party_contact('supply_houses', '00000000-0000-0000-0000-0000000403a9')$q$, 'A training account cannot start');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pp.refused('a caller who is not signed in', $q$SELECT public.paper_party_contact('supply_houses', '00000000-0000-0000-0000-0000000403a1')$q$, 'permission denied');
RESET ROLE;
SELECT pp.same('nobody refused made a contact', (SELECT count(*)::text FROM public.contacts), '7');

-- 2 · Someone on no list (call 6): a contact made from the address they typed, then named. A named contact with no
-- record is allowed, and with no message it sits on no lane of Messages.
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d3');
SET LOCAL ROLE authenticated;
SELECT public.contact_make_for_channel('email', 'noor@haddadeng.example');
SELECT public.contact_make_for_channel('email', 'pat@elsewhere.example');
UPDATE public.contacts SET name = 'Noor Haddad' WHERE id = pp.by_email('noor@haddadeng.example');
UPDATE public.contacts SET name = 'Pat Tallman' WHERE id = pp.by_email('pat@elsewhere.example');
SELECT pp.same('the typed address is one contact, asked twice', (public.contact_make_for_channel('email', 'Noor@HaddadEng.example') = pp.by_email('noor@haddadeng.example'))::text, 'true');
SELECT pp.same('nothing waits in Follow up', public.follow_up_count()::text, '0');
RESET ROLE;
SELECT pp.same('a named contact with no record is allowed', pp.who(pp.by_email('noor@haddadeng.example')), 'unknown|no record|Noor Haddad|email noor@haddadeng.example');
SELECT pp.same('and with no message it is on no lane: its conversation is done and it has no line',
  (SELECT concat_ws('|', c.state, (SELECT count(*) FROM public.messages m WHERE m.contact_id = c.id)::text) FROM public.contacts c WHERE c.id = pp.by_email('noor@haddadeng.example')), 'done|0');

-- 3 · The papers. A staff paper, a sub's own, a trade company's agreement and W-9 (company_id, as today), then a
-- teammate's own W-9, a sub's own certificate and the trade company's certificate, made as postgres. Then a party's
-- papers, written by the assistant under RLS.
INSERT INTO public.person_contract_documents (id, person_name, document_name, contract_lineage_id, lineage_version, status, doc_type, sent_at, signed_at) VALUES
  ('00000000-0000-0000-0000-000004030101', 'Pat Tallman', 'Employee handbook', gen_random_uuid(), 1, 'sent', 'agreement', '2026-11-10T15:00:00Z', NULL),
  ('00000000-0000-0000-0000-000004030102', 'Ortega Mechanical', 'Master subcontract', gen_random_uuid(), 1, 'signed', 'agreement', '2026-11-05T15:00:00Z', '2026-11-06'),
  ('00000000-0000-0000-0000-000004030103', 'gc-company:00000000-0000-0000-0000-0000000403b1', 'Master Services Agreement', gen_random_uuid(), 1, 'signed', 'agreement', '2026-11-07T15:00:00Z', '2026-11-08'),
  ('00000000-0000-0000-0000-000004030104', 'gc-company:00000000-0000-0000-0000-0000000403b1', 'W-9', gen_random_uuid(), 1, 'signed', 'w9', NULL, '2026-11-08'),
  -- A teammate's own W-9, a sub's own certificate, and the trade company's certificate.
  ('00000000-0000-0000-0000-000004030105', 'Pat Tallman', 'W-9', gen_random_uuid(), 1, 'signed', 'w9', NULL, '2026-11-09'),
  ('00000000-0000-0000-0000-000004030106', 'Ortega Mechanical', 'Certificate of insurance', gen_random_uuid(), 1, 'signed', 'coi', NULL, '2026-11-09'),
  ('00000000-0000-0000-0000-000004030107', 'gc-company:00000000-0000-0000-0000-0000000403b1', 'Certificate of insurance', gen_random_uuid(), 1, 'signed', 'coi', NULL, '2026-11-09');
SELECT pp.same('the staff paper found its roster person', pp.paper('00000000-0000-0000-0000-000004030101'), 'no party|00000000-0000-0000-0000-0000000403e1');

SELECT pp.as_user('00000000-0000-0000-0000-0000000403d3');
SET LOCAL ROLE authenticated;
SELECT pp.send('00000000-0000-0000-0000-000004030111', public.paper_party_contact('customer_contact_persons', '00000000-0000-0000-0000-0000000403c2'), 'Ridgeway Builders', 'Site secrecy agreement', 'signed', 'Dana Ruiz', 'Project manager', 'dana@ridgeway.example', 'Ridgeway Builders', 'agreement', '2026-11-16T15:00:00Z', '2026-11-17');
SELECT pp.send('00000000-0000-0000-0000-000004030112', public.paper_party_contact('supply_house_contacts', '00000000-0000-0000-0000-0000000403a3'), 'Tallgrass Supply Co.', 'Mutual secrecy agreement', 'sent', 'Lena Park', 'Branch manager', 'lena@tallgrass.example', 'Tallgrass Supply Co.', 'agreement', '2026-11-18T15:00:00Z');
SELECT pp.send('00000000-0000-0000-0000-000004030113', public.paper_party_contact('supply_houses', '00000000-0000-0000-0000-0000000403a1'), 'Tallgrass Supply Co.', 'Credit terms letter', 'sent', 'Omar Reyes', 'Credit desk', 'credit@tallgrass.example', 'Tallgrass Supply Co.', 'agreement', '2026-11-15T15:00:00Z');
SELECT pp.send('00000000-0000-0000-0000-000004030114', public.paper_party_contact('gc_companies', '00000000-0000-0000-0000-0000000403b1'), 'Juniper Mechanical LLC', 'Subcontractor agreement', 'signed', 'Marco Ibarra', 'Owner', 'marco@juniper.example', 'Juniper Mechanical LLC', 'agreement', '2026-11-13T15:00:00Z', '2026-11-14');
SELECT pp.send('00000000-0000-0000-0000-000004030115', pp.by_email('noor@haddadeng.example'), 'Haddad Engineering', 'Mutual secrecy agreement', 'sent', 'Noor Haddad', 'Structural engineer', 'noor@haddadeng.example', 'Haddad Engineering', 'agreement', '2026-11-19T15:00:00Z');
-- A supply house's W-9, a party's paper that is no agreement; a party named like a teammate; a copy nobody sent.
SELECT pp.send('00000000-0000-0000-0000-000004030116', public.paper_party_contact('supply_houses', '00000000-0000-0000-0000-0000000403a1'), 'Tallgrass Supply Co.', 'W-9', 'sent', 'Omar Reyes', NULL, 'credit@tallgrass.example', 'Tallgrass Supply Co.', 'w9', '2026-11-15T16:00:00Z');
SELECT pp.send('00000000-0000-0000-0000-000004030117', pp.by_email('pat@elsewhere.example'), 'Pat Tallman', 'Mutual secrecy agreement', 'sent', 'Pat Tallman', NULL, 'pat@elsewhere.example', NULL, 'agreement', '2026-11-12T15:00:00Z');
SELECT pp.send('00000000-0000-0000-0000-000004030118', public.paper_party_contact('supply_houses', '00000000-0000-0000-0000-0000000403a2'), 'Cedar Mutual Insurance', 'Mutual secrecy agreement', 'unsent', NULL, NULL, NULL, NULL);
-- The customer's certificate, and the W-9 of someone on no list.
SELECT pp.send('00000000-0000-0000-0000-000004030119', public.paper_party_contact('customers', '00000000-0000-0000-0000-0000000403c1'), 'Ridgeway Builders', 'Certificate of insurance', 'signed', 'Dana Ruiz', NULL, 'dana@ridgeway.example', 'Ridgeway Builders', 'coi', '2026-11-16T16:00:00Z', '2026-11-17');
SELECT pp.send('00000000-0000-0000-0000-000004030120', pp.by_email('noor@haddadeng.example'), 'Haddad Engineering', 'W-9', 'sent', 'Noor Haddad', NULL, 'noor@haddadeng.example', 'Haddad Engineering', 'w9', '2026-11-19T16:00:00Z');
UPDATE public.person_contract_documents SET signer_printed_name = 'Dana M. Ruiz' WHERE id = '00000000-0000-0000-0000-000004030111';
UPDATE public.person_contract_documents SET signer_last_viewed_at = '2026-11-15T18:00:00Z' WHERE id = '00000000-0000-0000-0000-000004030113';
RESET ROLE;

SELECT pp.same('a party''s paper is filed under its stored name, with its frozen name and no roster person',
  pp.paper('00000000-0000-0000-0000-000004030112'), right(pp.on('supply_house_contact_id', '00000000-0000-0000-0000-0000000403a3')::text, 4) || '|true|Tallgrass Supply Co.|no person');
SELECT pp.same('a party named like a roster person keeps no person_id', pp.paper('00000000-0000-0000-0000-000004030117'), right(pp.by_email('pat@elsewhere.example')::text, 4) || '|true|Pat Tallman|no person');
-- A roster person handed to a party's paper is cleared, and a copy with only the stored name takes its party back.
INSERT INTO public.person_contract_documents (id, person_name, party_contact_id, party_name, person_id, document_name, contract_lineage_id)
  VALUES ('00000000-0000-0000-0000-000004030121', 'party:' || pp.by_email('pat@elsewhere.example')::text, pp.by_email('pat@elsewhere.example'), 'Pat Tallman', '00000000-0000-0000-0000-0000000403e1', 'A second paper', gen_random_uuid());
SELECT pp.same('a roster person handed to a party''s paper is cleared', pp.paper('00000000-0000-0000-0000-000004030121'), right(pp.by_email('pat@elsewhere.example')::text, 4) || '|true|Pat Tallman|no person');
INSERT INTO public.person_contract_documents (id, person_name, document_name, contract_lineage_id, lineage_version, supersedes_person_contract_document_id)
  SELECT '00000000-0000-0000-0000-000004030122', d.person_name, d.document_name, d.contract_lineage_id, 2, d.id
  FROM public.person_contract_documents d WHERE d.id = '00000000-0000-0000-0000-000004030118';
SELECT pp.same('a copy with only the stored name takes its party and its frozen name back', pp.paper('00000000-0000-0000-0000-000004030122'), right(pp.on('supply_house_id', '00000000-0000-0000-0000-0000000403a2')::text, 4) || '|true|Cedar Mutual Insurance|no person');
DELETE FROM public.person_contract_documents WHERE id IN ('00000000-0000-0000-0000-000004030121', '00000000-0000-0000-0000-000004030122');

-- The shape is held both ways, and the words are words.
SELECT pp.refused('a party under a person''s name', format($q$INSERT INTO public.person_contract_documents (person_name, party_contact_id, party_name, document_name, contract_lineage_id) VALUES ('Somebody Else', %L, 'X', 'D', gen_random_uuid())$q$, pp.by_email('noor@haddadeng.example')), 'person_contract_documents_party_paper');
SELECT pp.refused('a stored party name with no party behind it', $q$INSERT INTO public.person_contract_documents (person_name, document_name, contract_lineage_id) VALUES ('party:nobody', 'D', gen_random_uuid())$q$, 'person_contract_documents_party_paper');
SELECT pp.refused('a party that is no contact', $q$INSERT INTO public.person_contract_documents (person_name, party_name, document_name, contract_lineage_id) VALUES ('party:00000000-0000-0000-0000-00000403dead', 'X', 'D', gen_random_uuid())$q$, 'violates foreign key constraint');
SELECT pp.refused('a party''s paper on a trade company too', format($q$INSERT INTO public.person_contract_documents (person_name, party_contact_id, party_name, company_id, document_name, contract_lineage_id) VALUES ('gc-company:00000000-0000-0000-0000-0000000403b1', %L, 'X', '00000000-0000-0000-0000-0000000403b1', 'D', gen_random_uuid())$q$, pp.by_email('noor@haddadeng.example')), 'person_contract_documents_party_paper');
SELECT pp.refused('a signer name of spaces', $q$UPDATE public.person_contract_documents SET signer_name = '   ' WHERE id = '00000000-0000-0000-0000-000004030101'$q$, 'person_contract_documents_party_words');
SELECT pp.refused('a signer address that is no address', $q$UPDATE public.person_contract_documents SET signer_email = 'nobody' WHERE id = '00000000-0000-0000-0000-000004030101'$q$, 'person_contract_documents_party_words');
SELECT pp.refused('a contact a paper names cannot be deleted from under it', format($q$DELETE FROM public.contacts WHERE id = %L$q$, pp.by_email('noor@haddadeng.example')), 'violates foreign key constraint');
-- A staff paper keeps its signer too (the second PR writes it on every send).
UPDATE public.person_contract_documents SET signer_name = 'Pat Tallman', signer_email = 'pat@crew.example' WHERE id = '00000000-0000-0000-0000-000004030101';

-- 4 · Documents → Agreements, as the office.
SELECT pp.same('the view is security_invoker', (SELECT reloptions::text FROM pg_class WHERE oid = 'public.agreements_on_file'::regclass), '{security_invoker=true}');
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d3');
SET LOCAL ROLE authenticated;
SELECT pp.same('the assistant reads a party''s papers as lines, newest first', pp.lines(), concat_ws(E'\n',
  'outside_agreement|waiting|Mutual secrecy agreement|Haddad Engineering|none|Noor Haddad|Structural engineer|Haddad Engineering|-|2026-11-19',
  'supply_house_agreement|waiting|Mutual secrecy agreement|Tallgrass Supply Co.|supply_house|Lena Park|Branch manager|Tallgrass Supply Co.|-|2026-11-18',
  'customer_agreement|signed|Site secrecy agreement|Ridgeway Builders|customer|Dana Ruiz|Project manager|Ridgeway Builders|Dana M. Ruiz|2026-11-17',
  'supply_house_agreement|waiting|Credit terms letter|Tallgrass Supply Co.|supply_house|Omar Reyes|Credit desk|Tallgrass Supply Co.|-|2026-11-15',
  'trade_agreement|signed|Subcontractor agreement|Juniper Mechanical LLC|trade|Marco Ibarra|Owner|Juniper Mechanical LLC|-|2026-11-14',
  'outside_agreement|waiting|Mutual secrecy agreement|Pat Tallman|none|Pat Tallman|-|-|-|2026-11-12'));
SELECT pp.same('every kind the assistant reads', pp.kinds(), 'company_agreement 1, customer_agreement 1, outside_agreement 2, person_agreement 2, supply_house_agreement 2, trade_agreement 1');
SELECT pp.same('a party''s W-9 and a copy nobody sent are no lines',
  (SELECT count(*)::text FROM public.agreements_on_file WHERE source_id IN ('00000000-0000-0000-0000-000004030116', '00000000-0000-0000-0000-000004030118')), '0');
SELECT pp.same('a party''s line names no roster person', (SELECT string_agg(DISTINCT concat_ws('|', coalesce(person_id::text, '-'), coalesce(person_kind, '-')), ',') FROM public.agreements_on_file WHERE facts ? 'party_kind'), '-|-');
SELECT pp.same('the stored name is never shown or searched', (SELECT bool_or(find_text LIKE '%party:%' OR with_name LIKE 'party:%')::text FROM public.agreements_on_file), 'false');
SELECT pp.same('the line carries the party''s contact', (SELECT (facts->>'party_contact_id' = pp.by_email('noor@haddadeng.example')::text)::text FROM public.agreements_on_file WHERE source_id = '00000000-0000-0000-0000-000004030115'), 'true');
SELECT pp.same('an opened paper still carries when', (SELECT (facts ? 'signer_last_viewed_at')::text FROM public.agreements_on_file WHERE source_id = '00000000-0000-0000-0000-000004030113'), 'true');
SELECT pp.same('the find box finds a party by its signer', (SELECT string_agg(kind, ',' ORDER BY kind) FROM public.agreements_on_file WHERE find_text ILIKE '%omar reyes%'), 'supply_house_agreement');
SELECT pp.same('by the business', (SELECT string_agg(kind, ',' ORDER BY kind) FROM public.agreements_on_file WHERE find_text ILIKE '%tallgrass%'), 'supply_house_agreement,supply_house_agreement');
SELECT pp.same('by the words supply house', (SELECT count(*)::text FROM public.agreements_on_file WHERE find_text ILIKE '%supply house%'), '2');
SELECT pp.same('by the words not on a list', (SELECT count(*)::text FROM public.agreements_on_file WHERE find_text ILIKE '%not on a list%'), '2');
SELECT pp.same('and every outside company''s by those words', (SELECT string_agg(kind, ',' ORDER BY kind) FROM public.agreements_on_file WHERE find_text ILIKE '%outside company%'), 'customer_agreement,outside_agreement,outside_agreement,supply_house_agreement,supply_house_agreement');
SELECT pp.same('find_text is lower case', (SELECT bool_and(find_text = lower(find_text))::text FROM public.agreements_on_file), 'true');
-- A staff paper and a trade company's read as before, and a staff paper's facts gain its signer once it is kept.
SELECT pp.same('a staff paper, a sub''s own and a trade company''s read as before',
  (SELECT string_agg(concat_ws('|', a.kind, a.state, a.paper_name, a.with_name, coalesce(a.person_kind, '-'), (a.facts ? 'party_kind')::text), E'\n' ORDER BY a.at DESC, a.id DESC)
   FROM public.agreements_on_file a WHERE a.kind IN ('person_agreement', 'company_agreement')),
  concat_ws(E'\n',
    'person_agreement|waiting|Employee handbook|Pat Tallman|helper|false',
    'company_agreement|signed|Master Services Agreement|Juniper Mechanical LLC|-|false',
    'person_agreement|signed|Master subcontract|Ortega Mechanical|sub|false'));
SELECT pp.same('a staff paper''s facts carry the signer kept on it', (SELECT facts->>'signer_name' FROM public.agreements_on_file WHERE source_id = '00000000-0000-0000-0000-000004030101'), 'Pat Tallman');
RESET ROLE;

-- 5 · Who reads what. The four roles read every row, as before. The estimator reads every kind of an outside company's
-- paper (the owner's call 9, migration *_estimator_reads_outside_papers).
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d3');
SET LOCAL ROLE authenticated;
SELECT pp.same('the assistant reads every paper', pp.rows(), '101,102,103,104,105,106,107,111,112,113,114,115,116,117,118,119,120');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d1');
SET LOCAL ROLE authenticated;
SELECT pp.same('a dev reads every paper', pp.rows(), '101,102,103,104,105,106,107,111,112,113,114,115,116,117,118,119,120');
SELECT pp.same('and every kind', pp.kinds(), 'company_agreement 1, customer_agreement 1, outside_agreement 2, person_agreement 2, supply_house_agreement 2, trade_agreement 1');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d2');
SET LOCAL ROLE authenticated;
SELECT pp.same('the owner reads every paper', pp.rows(), '101,102,103,104,105,106,107,111,112,113,114,115,116,117,118,119,120');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d4');
SET LOCAL ROLE authenticated;
SELECT pp.same('the controller reads every paper', pp.rows(), '101,102,103,104,105,106,107,111,112,113,114,115,116,117,118,119,120');
-- The gate's question is the estimator's alone: it says no to someone who reads every paper by another policy.
SELECT pp.same('the gate''s question says no to the controller for every paper', (SELECT count(*)::text FROM unnest(pp.all_papers()) x WHERE public.estimator_reads_paper(x)), '0');
RESET ROLE;

SELECT pp.as_user('00000000-0000-0000-0000-0000000403d5');
SET LOCAL ROLE authenticated;
-- 103, 104 and 107 the trade company's own agreement, W-9 and certificate; 111 to 114 a customer's, a supply house's two
-- and a trade company's; 116 the supply house's W-9; 118 the insurer's copy nobody sent; 119 the customer's
-- certificate. Not 101, 102, 105 or 106 (a person's, a W-9 and a certificate among them), nor 115, 117 or 120 (on no
-- list, a W-9 among them).
SELECT pp.same('an estimator reads every kind of an outside company''s paper and nothing else', pp.rows(), '103,104,107,111,112,113,114,116,118,119');
SELECT pp.same('an estimator''s lines are the outside companies''', pp.kinds(), 'company_agreement 1, customer_agreement 1, supply_house_agreement 2, trade_agreement 1');
SELECT pp.same('an estimator reads no person''s paper', (SELECT count(*)::text FROM public.person_contract_documents WHERE person_id IS NOT NULL OR (party_contact_id IS NULL AND company_id IS NULL)), '0');
SELECT pp.same('an estimator reads an outside company''s tax forms and certificates',
  (SELECT string_agg(right(id::text, 3) || ' ' || doc_type, ',' ORDER BY id) FROM public.person_contract_documents WHERE doc_type <> 'agreement'), '104 w9,107 coi,116 w9,119 coi');
SELECT pp.same('and no paper of a party on no list', (SELECT count(*)::text FROM public.person_contract_documents WHERE right(id::text, 3) IN ('115', '117', '120')), '0');
-- What the signed form's gate asks, one paper at a time: yes for exactly the papers the estimator reads.
SELECT pp.same('estimator_reads_paper says yes for exactly the papers an estimator reads',
  (SELECT coalesce(string_agg(right(x::text, 3), ',' ORDER BY x), 'none') FROM unnest(pp.all_papers()) x WHERE public.estimator_reads_paper(x)), pp.rows());
SELECT pp.same('and no for a paper that is not there', public.estimator_reads_paper('00000000-0000-0000-0000-00000403dead')::text, 'false');
SELECT pp.same('the paper''s side of the rule, asked of the columns: a person''s, a partner''s, a company''s, nobody''s',
  concat_ws(' ',
    public.paper_is_outside_company('00000000-0000-0000-0000-0000000403e1', NULL, NULL, NULL)::text,
    public.paper_is_outside_company(NULL, '00000000-0000-0000-0000-0000000403e1', '00000000-0000-0000-0000-0000000403b1', NULL)::text,
    public.paper_is_outside_company(NULL, NULL, '00000000-0000-0000-0000-0000000403b1', NULL)::text,
    public.paper_is_outside_company(NULL, NULL, NULL, NULL)::text),
  'false false true false');
SELECT pp.same('and a party''s: a customer''s contact, then one on no list',
  concat_ws(' ',
    public.paper_is_outside_company(NULL, NULL, NULL, pp.on('customer_id', '00000000-0000-0000-0000-0000000403c1'))::text,
    public.paper_is_outside_company(NULL, NULL, NULL, pp.by_email('noor@haddadeng.example'))::text),
  'true false');
SELECT pp.same('each line names its party for the estimator', (SELECT bool_and(with_name <> '')::text FROM public.agreements_on_file), 'true');
SELECT pp.refused('an estimator writes no paper', $q$SELECT pp.send('00000000-0000-0000-0000-000004030131', pp.by_email('noor@haddadeng.example'), 'X', 'D', 'unsent', NULL, NULL, NULL, NULL)$q$, 'row-level security');
-- An update of a row the estimator reads changes nothing: no write policy opens to them.
UPDATE public.person_contract_documents SET status = 'signed' WHERE id = '00000000-0000-0000-0000-000004030112';
DELETE FROM public.person_contract_documents WHERE id = '00000000-0000-0000-0000-000004030112';
RESET ROLE;
SELECT pp.same('and changes none', (SELECT status FROM public.person_contract_documents WHERE id = '00000000-0000-0000-0000-000004030112'), 'sent');

SELECT pp.as_user('00000000-0000-0000-0000-0000000403d9');
SET LOCAL ROLE authenticated;
SELECT pp.same('a digital twin, an estimator by role, reads no paper', pp.rows(), 'none');
SELECT pp.same('and the gate''s question says no for every paper', (SELECT count(*)::text FROM unnest(pp.all_papers()) x WHERE public.estimator_reads_paper(x)), '0');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403db');
SET LOCAL ROLE authenticated;
SELECT pp.same('an archived estimator reads no paper', pp.rows(), 'none');
SELECT pp.same('and the gate''s question says no for every paper', (SELECT count(*)::text FROM unnest(pp.all_papers()) x WHERE public.estimator_reads_paper(x)), '0');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d6');
SET LOCAL ROLE authenticated;
SELECT pp.same('a primary reads no paper', pp.rows(), 'none');
SELECT pp.same('and the gate''s question says no for every paper', (SELECT count(*)::text FROM unnest(pp.all_papers()) x WHERE public.estimator_reads_paper(x)), '0');
SELECT pp.same('and no line', pp.kinds(), 'none');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d7');
SET LOCAL ROLE authenticated;
SELECT pp.same('a superintendent reads no paper', pp.rows(), 'none');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d8');
SET LOCAL ROLE authenticated;
SELECT pp.same('a sub reads no paper, their own included', pp.rows(), 'none');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403da');
SET LOCAL ROLE authenticated;
SELECT pp.same('a training assistant reads what an assistant reads', pp.rows(), '101,102,103,104,105,106,107,111,112,113,114,115,116,117,118,119,120');
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
DECLARE n bigint;
BEGIN
  BEGIN
    SELECT count(*) INTO n FROM public.person_contract_documents;
  EXCEPTION WHEN insufficient_privilege THEN
    n := 0;
  END;
  IF n <> 0 THEN RAISE EXCEPTION 'a caller who is not signed in read % paper(s)', n; END IF;
  RAISE NOTICE 'ok: a caller who is not signed in reads no paper';
END $$;
SELECT pp.refused('a caller who is not signed in cannot ask the gate''s question', $q$SELECT public.estimator_reads_paper('00000000-0000-0000-0000-000004030104')$q$, 'permission denied');
SELECT pp.refused('nor the paper''s side of it', $q$SELECT public.paper_is_outside_company(NULL, NULL, '00000000-0000-0000-0000-0000000403b1', NULL)$q$, 'permission denied');
RESET ROLE;
-- The policy holds no kind of paper any more, both functions run as the caller, and neither is open to the public.
SELECT pp.same('the estimator''s policy names no kind of paper and asks the function',
  (SELECT (pg_get_expr(polqual, polrelid) NOT LIKE '%doc_type%')::text || ' ' || (pg_get_expr(polqual, polrelid) LIKE '%paper_is_outside_company(person_id, partnership_id, company_id, party_contact_id)%')::text
   FROM pg_policy WHERE polrelid = 'public.person_contract_documents'::regclass AND polname = 'person_contract_documents_estimator_outside'), 'true true');
SELECT pp.same('both functions run as the caller, with the search path pinned',
  (SELECT string_agg(proname || ' ' || prosecdef::text || ' ' || provolatile::text || ' ' || array_to_string(proconfig, ','), ' ; ' ORDER BY proname)
   FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('paper_is_outside_company', 'estimator_reads_paper')),
  'estimator_reads_paper false s search_path=public ; paper_is_outside_company false s search_path=public');
SELECT pp.same('and neither is open to a caller who is not signed in',
  concat_ws(' ', has_function_privilege('anon', 'public.estimator_reads_paper(uuid)', 'EXECUTE')::text, has_function_privilege('anon', 'public.paper_is_outside_company(uuid, uuid, uuid, uuid)', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.estimator_reads_paper(uuid)', 'EXECUTE')::text, has_function_privilege('authenticated', 'public.paper_is_outside_company(uuid, uuid, uuid, uuid)', 'EXECUTE')::text),
  'false false true true');

-- 6 · The paper follows its contact. Add to a list is Who is this?: Noor becomes a person at the customer, in place.
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d3');
SET LOCAL ROLE authenticated;
SELECT pp.same('Who is this? names Noor a person at the customer, on the contact she had',
  (public.name_contact(pp.by_email('noor@haddadeng.example'), 'customers', '00000000-0000-0000-0000-0000000403c1', 'customer', 'Noor Haddad') = pp.by_email('noor@haddadeng.example'))::text, 'true');
SELECT pp.same('her paper is the customer''s now, by the record''s own name',
  (SELECT concat_ws('|', kind, with_name, facts->>'party_kind', facts->>'signing_for') FROM public.agreements_on_file WHERE source_id = '00000000-0000-0000-0000-000004030115'),
  'customer_agreement|Ridgeway Builders|customer|Haddad Engineering');
RESET ROLE;
SELECT pp.same('and the paper kept its frozen name', pp.paper('00000000-0000-0000-0000-000004030115'), right(pp.by_email('noor@haddadeng.example')::text, 4) || '|true|Haddad Engineering|no person');
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d5');
SET LOCAL ROLE authenticated;
SELECT pp.same('the estimator reads her papers once she is at a customer, her W-9 among them', pp.rows(), '103,104,107,111,112,113,114,115,116,118,119,120');
SELECT pp.same('and the gate''s question follows', public.estimator_reads_paper('00000000-0000-0000-0000-000004030120')::text, 'true');
-- A fold, run by an estimator who may not write a paper: the other typed-in signer turns out to be the rep. The helper
-- is a definer, so the paper moves and the folded contact goes.
SELECT set_config('pp.was', pp.by_email('pat@elsewhere.example')::text, true);
SELECT pp.same('the estimator names the other one the rep, and the contact folds into the rep''s',
  public.name_contact(current_setting('pp.was')::uuid, 'supply_house_contacts', '00000000-0000-0000-0000-0000000403a3', 'supply_house')::text,
  pp.on('supply_house_contact_id', '00000000-0000-0000-0000-0000000403a3')::text);
RESET ROLE;
SELECT pp.same('the paper followed, under the rep''s stored name, with the name it had',
  pp.paper('00000000-0000-0000-0000-000004030117'), right(pp.on('supply_house_contact_id', '00000000-0000-0000-0000-0000000403a3')::text, 4) || '|true|Pat Tallman|no person');
SELECT pp.same('the folded contact is gone', (SELECT count(*)::text FROM public.contacts c WHERE c.id = current_setting('pp.was')::uuid), '0');
SELECT pp.same('and the rep''s contact kept the typed address', pp.who(pp.on('supply_house_contact_id', '00000000-0000-0000-0000-0000000403a3')), 'supply_house|rep|-|email lena@tallgrass.example,email pat@elsewhere.example,phone 2105550144');

-- A record deleted by a screen: its contact moves off the row first, and the paper never loses who it was with.
DELETE FROM public.customer_contact_persons WHERE id = '00000000-0000-0000-0000-0000000403c2';
DELETE FROM public.supply_houses WHERE id = '00000000-0000-0000-0000-0000000403a1';
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d3');
SET LOCAL ROLE authenticated;
SELECT pp.same('a person deleted from the customer leaves the paper with the customer',
  (SELECT concat_ws('|', kind, with_name, facts->>'signer_name') FROM public.agreements_on_file WHERE source_id = '00000000-0000-0000-0000-000004030111'), 'customer_agreement|Ridgeway Builders|Dana Ruiz');
SELECT pp.same('a supply house deleted leaves its papers on no list, by the name frozen on them',
  (SELECT string_agg(concat_ws('|', kind, with_name, facts->>'party_kind', facts->>'signer_name'), E'\n' ORDER BY at DESC) FROM public.agreements_on_file WHERE source_id IN ('00000000-0000-0000-0000-000004030112', '00000000-0000-0000-0000-000004030113', '00000000-0000-0000-0000-000004030117')),
  concat_ws(E'\n',
    'outside_agreement|Tallgrass Supply Co.|none|Lena Park',
    'outside_agreement|Tallgrass Supply Co.|none|Omar Reyes',
    'outside_agreement|Pat Tallman|none|Pat Tallman'));
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d5');
SET LOCAL ROLE authenticated;
SELECT pp.same('and the estimator no longer reads the ones on no list, the supply house''s W-9 among them', pp.rows(), '103,104,107,111,114,115,118,119,120');
SELECT pp.same('nor does the gate''s question open it', public.estimator_reads_paper('00000000-0000-0000-0000-000004030116')::text, 'false');
RESET ROLE;

-- 7 · The helper called by hand moves nothing for a twin, a training account, an archived account or a primary.
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d9');
SET LOCAL ROLE authenticated;
SELECT public.contacts_fold_papers(pp.on('gc_company_id', '00000000-0000-0000-0000-0000000403b1'), pp.on('customer_id', '00000000-0000-0000-0000-0000000403c1'));
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403da');
SET LOCAL ROLE authenticated;
SELECT public.contacts_fold_papers(pp.on('gc_company_id', '00000000-0000-0000-0000-0000000403b1'), pp.on('customer_id', '00000000-0000-0000-0000-0000000403c1'));
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403db');
SET LOCAL ROLE authenticated;
SELECT public.contacts_fold_papers(pp.on('gc_company_id', '00000000-0000-0000-0000-0000000403b1'), pp.on('customer_id', '00000000-0000-0000-0000-0000000403c1'));
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d6');
SET LOCAL ROLE authenticated;
SELECT public.contacts_fold_papers(pp.on('gc_company_id', '00000000-0000-0000-0000-0000000403b1'), pp.on('customer_id', '00000000-0000-0000-0000-0000000403c1'));
RESET ROLE;
SELECT pp.same('a twin, a training account, an archived account and a primary moved nothing',
  pp.paper('00000000-0000-0000-0000-000004030114'), right(pp.on('gc_company_id', '00000000-0000-0000-0000-0000000403b1')::text, 4) || '|true|Juniper Mechanical LLC|no person');
SET LOCAL ROLE anon;
SELECT pp.refused('a caller who is not signed in cannot call the helper', format($q$SELECT public.contacts_fold_papers(%L, %L)$q$, pp.on('gc_company_id', '00000000-0000-0000-0000-0000000403b1'), pp.on('customer_id', '00000000-0000-0000-0000-0000000403c1')), 'permission denied');
RESET ROLE;

-- 8 · The e-sign ledger takes an outside signer, and holds one audience check.
INSERT INTO public.esign_consents (record_type, record_id, consent_version, lang, audience, document_noun, clause_text)
  VALUES ('person_contract_document', '00000000-0000-0000-0000-000004030112', 2, 'en', 'outside', 'this agreement', 'the words they saw');
SELECT pp.refused('an audience nobody named', $q$INSERT INTO public.esign_consents (record_type, record_id, consent_version, lang, audience, document_noun, clause_text) VALUES ('person_contract_document', '00000000-0000-0000-0000-000004030112', 2, 'en', 'vendor', 'this agreement', 'words')$q$, 'esign_consents_audience_check');
SELECT pp.same('the ledger holds one audience check, with the four',
  (SELECT string_agg(pg_get_constraintdef(c.oid), ' ; ') FROM pg_constraint c WHERE c.conrelid = 'public.esign_consents'::regclass AND c.contype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%audience%'),
  'CHECK ((audience = ANY (ARRAY[''customer''::text, ''sub''::text, ''gc''::text, ''outside''::text])))');

DO $$ BEGIN RAISE NOTICE 'paper_party PASSED'; END $$;
ROLLBACK;
