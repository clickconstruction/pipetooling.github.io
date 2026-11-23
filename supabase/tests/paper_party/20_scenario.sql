-- Where an outside signer lives, the ground (migration *_paper_party, punch list #403): a paper names the contact of
-- the outside party it is with, and keeps who signs. The scenario, inside one transaction that rolls back:
--   * the door paper_party_contact finds or makes the contact of each kind of record a paper can be with, for the four
--     roles that send a paper and nobody else, and a named contact with no record is allowed and sits on no lane;
--   * a party's paper is filed under a name no person can have, keeps no roster person even when the party is named like
--     one, and takes its party back from that name; the two checks hold the shape both ways;
--   * Documents → Agreements lists a party's paper under one of four new kinds, by the record's own name, with who
--     signs in its facts, and never shows or searches the stored name; since migration *_agreements_every_party_paper
--     (the owner's first decision) it lists a party's paper of any kind and any state: a W-9 and a certificate say
--     their kind, a copy nobody sent reads not_sent, and a person's or a trade company's own tax form is still no line;
--   * Take back (v2.8348), the statement Documents → Agreements sends: it removes a party's paper that is out or was
--     never sent, never a signed one, and nothing for an estimator; the table's delete policy answers the office's four
--     roles, so the statement works for an assistant and the controller too, and the press being the owner's and a
--     dev's is the app's own rule; the copy under Sent copies stays;
--   * each role reads what it read before and no more, but the estimator, who reads every kind of an outside company's
--     paper, a W-9 and a certificate among them (migration *_estimator_reads_outside_papers, the owner's call 9), and
--     still no staff paper, no sub's own, no person's tax form and nobody on no list; a digital twin and an archived
--     account read none;
--   * estimator_reads_paper, which the signed form's gate asks, answers yes for exactly the papers an estimator reads,
--     and no for everyone who is not an estimator;
--   * the paper follows its contact through Who is this?, a fold, and a record deleted by a screen, where the frozen
--     name still says who it was with;
--   * since migration *_estimator_reach (the owner's second decision): a contact that holds a paper is named by the
--     four roles alone, in place, by a fold, or by a statement of the caller's own, and an estimator still names a
--     contact that holds none; an estimator reads the layout of a form an outside company's paper is filled on and
--     that paper's signature image, and a training estimator, a digital twin and everyone off the four roles read
--     neither;
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
  ('00000000-0000-0000-0000-0000000403db', 'gone@party.test'),
  ('00000000-0000-0000-0000-0000000403dc', 'trainee-estimator@party.test');
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
  ('00000000-0000-0000-0000-0000000403db', 'gone@party.test', 'Party Gone', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000403dc', 'trainee-estimator@party.test', 'Party Trainee Estimator', 'estimator', true, false)
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
-- Take back, as Documents → Agreements sends it (src/lib/documents/paperTakeBackIo.ts): one statement that asks for a
-- party's paper that is not signed and that no job requires. Run as the caller, so row security answers. How many went.
CREATE FUNCTION pp.take_back(p_id uuid) RETURNS text LANGUAGE sql AS $$
  WITH gone AS (
    DELETE FROM public.person_contract_documents
    WHERE id = p_id AND party_contact_id IS NOT NULL AND job_id IS NULL AND status IN ('unsent', 'sent')
    RETURNING id)
  SELECT count(*)::text FROM gone
$$;
-- The form layouts a caller reads, by the last two of each id, and the signature images, by the last three of the
-- paper each is kept under.
CREATE FUNCTION pp.layouts() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(right(t.id::text, 2), ',' ORDER BY t.id), 'none') FROM public.contract_form_templates t
  WHERE t.id::text LIKE '00000000-0000-0000-0000-0000040301%'
$$;
CREATE FUNCTION pp.images() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(right(split_part(o.name, '/', 1), 3), ',' ORDER BY o.name), 'none') FROM storage.objects o
  WHERE o.bucket_id = 'contract-signer-signatures'
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
-- The copy nobody sent was made on a day of its own, so its line has a day to sort and show.
UPDATE public.person_contract_documents SET created_at = '2026-11-11T15:00:00Z' WHERE id = '00000000-0000-0000-0000-000004030118';
RESET ROLE;

-- Three form layouts and four signature images, made as postgres (migration *_estimator_reach). f1 is the W-9 the
-- trade company's own (104) and the supply house's (116) are filled on. f2 is a staff form (101). f3 is a second W-9
-- layout, a teammate's own (105) and the one of someone on no list (120). A paper's kind matches its form's, so the
-- trigger that copies a form's kind changes none. The images are kept under 104, 105 and 120, and one under a folder
-- that is no paper's.
INSERT INTO public.contract_form_templates (id, name, pdf_storage_path, status, doc_type, published_at) VALUES
  ('00000000-0000-0000-0000-0000040301f1', 'Party bed W-9', 'bed/w9.pdf', 'published', 'w9', now()),
  ('00000000-0000-0000-0000-0000040301f2', 'Party bed staff form', 'bed/staff.pdf', 'published', 'agreement', now()),
  ('00000000-0000-0000-0000-0000040301f3', 'Party bed W-9, second layout', 'bed/w9b.pdf', 'published', 'w9', now());
UPDATE public.person_contract_documents SET form_template_id = '00000000-0000-0000-0000-0000040301f1' WHERE id IN ('00000000-0000-0000-0000-000004030104', '00000000-0000-0000-0000-000004030116');
UPDATE public.person_contract_documents SET form_template_id = '00000000-0000-0000-0000-0000040301f2' WHERE id = '00000000-0000-0000-0000-000004030101';
UPDATE public.person_contract_documents SET form_template_id = '00000000-0000-0000-0000-0000040301f3' WHERE id IN ('00000000-0000-0000-0000-000004030105', '00000000-0000-0000-0000-000004030120');
SELECT pp.same('a form on a paper changed no paper''s kind',
  (SELECT string_agg(right(id::text, 3) || ' ' || doc_type, ',' ORDER BY id) FROM public.person_contract_documents WHERE form_template_id IS NOT NULL), '101 agreement,104 w9,105 w9,116 w9,120 w9');
INSERT INTO storage.buckets (id, name, public) VALUES ('contract-signer-signatures', 'contract-signer-signatures', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('contract-signer-signatures', '00000000-0000-0000-0000-000004030104/signature.png'),
  ('contract-signer-signatures', '00000000-0000-0000-0000-000004030105/signature.png'),
  ('contract-signer-signatures', '00000000-0000-0000-0000-000004030120/signature.png'),
  ('contract-signer-signatures', 'gc-sows/00000000-0000-0000-0000-000004030104/signature.png');

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
-- Since *_agreements_every_party_paper a party's paper is a line whatever its kind and state: the W-9s (116, 120), the
-- customer's certificate (119, signed the same day as 111 and drawn above it by its id) and the copy nobody sent (118).
SELECT pp.same('the assistant reads a party''s papers as lines, newest first', pp.lines(), concat_ws(E'\n',
  'outside_agreement|waiting|W-9|Haddad Engineering|none|Noor Haddad|-|Haddad Engineering|-|2026-11-19',
  'outside_agreement|waiting|Mutual secrecy agreement|Haddad Engineering|none|Noor Haddad|Structural engineer|Haddad Engineering|-|2026-11-19',
  'supply_house_agreement|waiting|Mutual secrecy agreement|Tallgrass Supply Co.|supply_house|Lena Park|Branch manager|Tallgrass Supply Co.|-|2026-11-18',
  'customer_agreement|signed|Certificate of insurance|Ridgeway Builders|customer|Dana Ruiz|-|Ridgeway Builders|-|2026-11-17',
  'customer_agreement|signed|Site secrecy agreement|Ridgeway Builders|customer|Dana Ruiz|Project manager|Ridgeway Builders|Dana M. Ruiz|2026-11-17',
  'supply_house_agreement|waiting|W-9|Tallgrass Supply Co.|supply_house|Omar Reyes|-|Tallgrass Supply Co.|-|2026-11-15',
  'supply_house_agreement|waiting|Credit terms letter|Tallgrass Supply Co.|supply_house|Omar Reyes|Credit desk|Tallgrass Supply Co.|-|2026-11-15',
  'trade_agreement|signed|Subcontractor agreement|Juniper Mechanical LLC|trade|Marco Ibarra|Owner|Juniper Mechanical LLC|-|2026-11-14',
  'outside_agreement|waiting|Mutual secrecy agreement|Pat Tallman|none|Pat Tallman|-|-|-|2026-11-12',
  'supply_house_agreement|not_sent|Mutual secrecy agreement|Cedar Mutual Insurance|supply_house|-|-|-|-|2026-11-11'));
SELECT pp.same('every kind the assistant reads', pp.kinds(), 'company_agreement 1, customer_agreement 2, outside_agreement 3, person_agreement 2, supply_house_agreement 4, trade_agreement 1');
SELECT pp.same('a party''s W-9, its certificate and a copy nobody sent are lines, each with its state and its kind',
  (SELECT string_agg(concat_ws(' ', right(source_id::text, 3), state, facts->>'doc_type'), ',' ORDER BY source_id) FROM public.agreements_on_file
   WHERE source_id IN ('00000000-0000-0000-0000-000004030116', '00000000-0000-0000-0000-000004030118', '00000000-0000-0000-0000-000004030119', '00000000-0000-0000-0000-000004030120')),
  '116 waiting w9,118 not_sent agreement,119 signed coi,120 waiting w9');
SELECT pp.same('only a party''s line says its kind', (SELECT count(*)::text FROM public.agreements_on_file WHERE facts ? 'doc_type' AND NOT (facts ? 'party_kind')), '0');
SELECT pp.same('and every party''s line does', (SELECT bool_and(facts ? 'doc_type')::text FROM public.agreements_on_file WHERE facts ? 'party_kind'), 'true');
SELECT pp.same('not_sent is a party''s unsent paper and no other line', (SELECT string_agg(right(source_id::text, 3), ',' ORDER BY source_id) FROM public.agreements_on_file WHERE state = 'not_sent'), '118');
SELECT pp.same('a teammate''s W-9, a sub''s certificate and a trade company''s own W-9 and certificate are still no lines',
  (SELECT count(*)::text FROM public.agreements_on_file WHERE source_id IN ('00000000-0000-0000-0000-000004030104', '00000000-0000-0000-0000-000004030105', '00000000-0000-0000-0000-000004030106', '00000000-0000-0000-0000-000004030107')), '0');
SELECT pp.same('the find box finds a W-9 by those words', (SELECT string_agg(right(source_id::text, 3), ',' ORDER BY source_id) FROM public.agreements_on_file WHERE find_text ILIKE '%w9%'), '116,120');
SELECT pp.same('a certificate by its words', (SELECT string_agg(right(source_id::text, 3), ',' ORDER BY source_id) FROM public.agreements_on_file WHERE find_text ILIKE '%insurance certificate%'), '119');
SELECT pp.same('and an unsent paper by the words not sent', (SELECT string_agg(right(source_id::text, 3), ',' ORDER BY source_id) FROM public.agreements_on_file WHERE find_text ILIKE '%not sent%'), '118');
SELECT pp.same('a party''s line names no roster person', (SELECT string_agg(DISTINCT concat_ws('|', coalesce(person_id::text, '-'), coalesce(person_kind, '-')), ',') FROM public.agreements_on_file WHERE facts ? 'party_kind'), '-|-');
SELECT pp.same('the stored name is never shown or searched', (SELECT bool_or(find_text LIKE '%party:%' OR with_name LIKE 'party:%')::text FROM public.agreements_on_file), 'false');
SELECT pp.same('the line carries the party''s contact', (SELECT (facts->>'party_contact_id' = pp.by_email('noor@haddadeng.example')::text)::text FROM public.agreements_on_file WHERE source_id = '00000000-0000-0000-0000-000004030115'), 'true');
SELECT pp.same('an opened paper still carries when', (SELECT (facts ? 'signer_last_viewed_at')::text FROM public.agreements_on_file WHERE source_id = '00000000-0000-0000-0000-000004030113'), 'true');
SELECT pp.same('the find box finds a party by its signer', (SELECT string_agg(kind, ',' ORDER BY kind) FROM public.agreements_on_file WHERE find_text ILIKE '%omar reyes%'), 'supply_house_agreement,supply_house_agreement');
SELECT pp.same('by the business', (SELECT string_agg(kind, ',' ORDER BY kind) FROM public.agreements_on_file WHERE find_text ILIKE '%tallgrass%'), 'supply_house_agreement,supply_house_agreement,supply_house_agreement');
SELECT pp.same('by the words supply house', (SELECT count(*)::text FROM public.agreements_on_file WHERE find_text ILIKE '%supply house%'), '4');
SELECT pp.same('by the words not on a list', (SELECT count(*)::text FROM public.agreements_on_file WHERE find_text ILIKE '%not on a list%'), '3');
SELECT pp.same('and every outside company''s by those words', (SELECT string_agg(kind, ',' ORDER BY kind) FROM public.agreements_on_file WHERE find_text ILIKE '%outside company%'), 'customer_agreement,customer_agreement,outside_agreement,outside_agreement,outside_agreement,supply_house_agreement,supply_house_agreement,supply_house_agreement,supply_house_agreement');
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
SELECT pp.same('and every kind', pp.kinds(), 'company_agreement 1, customer_agreement 2, outside_agreement 3, person_agreement 2, supply_house_agreement 4, trade_agreement 1');
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
-- Their lines follow their rows: the supply house's W-9 (116), the insurer's unsent copy (118) and the customer's
-- certificate (119) are lines for them too now, and nobody's on no list is.
SELECT pp.same('an estimator''s lines are the outside companies''', pp.kinds(), 'company_agreement 1, customer_agreement 2, supply_house_agreement 4, trade_agreement 1');
SELECT pp.same('an estimator reads the unsent copy as not sent, and the W-9 by its kind',
  (SELECT string_agg(concat_ws(' ', right(source_id::text, 3), state, facts->>'doc_type'), ',' ORDER BY source_id) FROM public.agreements_on_file WHERE source_id IN ('00000000-0000-0000-0000-000004030116', '00000000-0000-0000-0000-000004030118')),
  '116 waiting w9,118 not_sent agreement');
SELECT pp.same('and no line of a party on no list, a W-9 among them', (SELECT count(*)::text FROM public.agreements_on_file WHERE kind = 'outside_agreement'), '0');
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
-- The signed record's two reads (migration *_estimator_reach): the layout of a form an outside company's paper is
-- filled on, and that paper's signature image. Not the staff form's, not the layout only a teammate's and a party on
-- no list are filled on, not their images, and not a file under a folder that is no paper's.
SELECT pp.same('an estimator reads the layout an outside company''s paper is filled on, and no other', pp.layouts(), 'f1');
SELECT pp.same('and the signature image of an outside company''s paper, and no other', pp.images(), '104');
SELECT pp.refused('an estimator writes no paper', $q$SELECT pp.send('00000000-0000-0000-0000-000004030131', pp.by_email('noor@haddadeng.example'), 'X', 'D', 'unsent', NULL, NULL, NULL, NULL)$q$, 'row-level security');
-- An update of a row the estimator reads changes nothing: no write policy opens to them.
UPDATE public.person_contract_documents SET status = 'signed' WHERE id = '00000000-0000-0000-0000-000004030112';
DELETE FROM public.person_contract_documents WHERE id = '00000000-0000-0000-0000-000004030112';
RESET ROLE;
SELECT pp.same('and changes none', (SELECT status FROM public.person_contract_documents WHERE id = '00000000-0000-0000-0000-000004030112'), 'sent');

-- 5b · Take back (v2.8348). Five papers with the insurer, written by the assistant: 141 out, 142 signed, 143 never
-- sent, 144 and 145 out. The copy of 141's email is under Sent copies, which names its paper with no key.
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d3');
SET LOCAL ROLE authenticated;
SELECT pp.send('00000000-0000-0000-0000-000004030141', pp.on('supply_house_id', '00000000-0000-0000-0000-0000000403a2'), 'Cedar Mutual Insurance', 'Paper to take back', 'sent', 'Iris Cho', NULL, 'iris@cedarmutual.example', 'Cedar Mutual Insurance', 'agreement', '2026-11-20T15:00:00Z');
SELECT pp.send('00000000-0000-0000-0000-000004030142', pp.on('supply_house_id', '00000000-0000-0000-0000-0000000403a2'), 'Cedar Mutual Insurance', 'Paper they signed', 'signed', 'Iris Cho', NULL, 'iris@cedarmutual.example', 'Cedar Mutual Insurance', 'agreement', '2026-11-20T15:00:00Z', '2026-11-21');
SELECT pp.send('00000000-0000-0000-0000-000004030143', pp.on('supply_house_id', '00000000-0000-0000-0000-0000000403a2'), 'Cedar Mutual Insurance', 'Paper nobody sent', 'unsent', NULL, NULL, NULL, NULL);
SELECT pp.send('00000000-0000-0000-0000-000004030144', pp.on('supply_house_id', '00000000-0000-0000-0000-0000000403a2'), 'Cedar Mutual Insurance', 'Paper the controller tries', 'sent', 'Iris Cho', NULL, 'iris@cedarmutual.example', 'Cedar Mutual Insurance', 'agreement', '2026-11-20T15:00:00Z');
SELECT pp.send('00000000-0000-0000-0000-000004030145', pp.on('supply_house_id', '00000000-0000-0000-0000-0000000403a2'), 'Cedar Mutual Insurance', 'Paper the assistant tries', 'sent', 'Iris Cho', NULL, 'iris@cedarmutual.example', 'Cedar Mutual Insurance', 'agreement', '2026-11-20T15:00:00Z');
RESET ROLE;
INSERT INTO public.sent_documents (kind, how, source_table, source_id) VALUES ('person_contract', 'email', 'person_contract_documents', '00000000-0000-0000-0000-000004030141');
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d5');
SET LOCAL ROLE authenticated;
SELECT pp.same('an estimator reads the paper and takes nothing back', pp.take_back('00000000-0000-0000-0000-000004030141'), '0');
RESET ROLE;
-- The table's delete policy answers the office's four roles (is_assistant() covers the controller, since
-- 20260714200000_dissolve_assistant_pay_linkage). So the statement works for the controller and an assistant too. The
-- press is the owner's and a dev's by the app's own rule (canTakeBackPapers), which is narrower than this.
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d4');
SET LOCAL ROLE authenticated;
SELECT pp.same('the database lets the controller take back a paper that is out', pp.take_back('00000000-0000-0000-0000-000004030144'), '1');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d3');
SET LOCAL ROLE authenticated;
SELECT pp.same('and an assistant', pp.take_back('00000000-0000-0000-0000-000004030145'), '1');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d2');
SET LOCAL ROLE authenticated;
SELECT pp.same('the owner takes back no signed paper: the statement asks for an unsigned one', pp.take_back('00000000-0000-0000-0000-000004030142'), '0');
SELECT pp.same('the owner takes back a paper that is out', pp.take_back('00000000-0000-0000-0000-000004030141'), '1');
SELECT pp.same('and a second press finds nothing to take', pp.take_back('00000000-0000-0000-0000-000004030141'), '0');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d1');
SET LOCAL ROLE authenticated;
SELECT pp.same('a dev takes back a paper that was never sent', pp.take_back('00000000-0000-0000-0000-000004030143'), '1');
RESET ROLE;
SELECT pp.same('the signed paper is kept, and the two taken back are gone',
  (SELECT string_agg(right(id::text, 3) || ' ' || status, ',' ORDER BY id) FROM public.person_contract_documents
   WHERE id IN ('00000000-0000-0000-0000-000004030141', '00000000-0000-0000-0000-000004030142', '00000000-0000-0000-0000-000004030143')), '142 signed');
SELECT pp.same('the copy of the email that went out stays under Sent copies',
  (SELECT count(*)::text FROM public.sent_documents WHERE source_table = 'person_contract_documents' AND source_id = '00000000-0000-0000-0000-000004030141'), '1');
SELECT pp.same('and the contact the paper was with is still there', (pp.on('supply_house_id', '00000000-0000-0000-0000-0000000403a2') IS NOT NULL)::text, 'true');
-- The section's own rows go, so the rest of the scenario reads the papers it read before.
DELETE FROM public.person_contract_documents WHERE id = '00000000-0000-0000-0000-000004030142';

SELECT pp.as_user('00000000-0000-0000-0000-0000000403d9');
SET LOCAL ROLE authenticated;
SELECT pp.same('a digital twin, an estimator by role, reads no paper', pp.rows(), 'none');
SELECT pp.same('no layout and no signature image', pp.layouts() || ' ' || pp.images(), 'none none');
SELECT pp.same('and the gate''s question says no for every paper', (SELECT count(*)::text FROM unnest(pp.all_papers()) x WHERE public.estimator_reads_paper(x)), '0');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403db');
SET LOCAL ROLE authenticated;
SELECT pp.same('an archived estimator reads no paper', pp.rows(), 'none');
SELECT pp.same('no layout and no signature image', pp.layouts() || ' ' || pp.images(), 'none none');
SELECT pp.same('and the gate''s question says no for every paper', (SELECT count(*)::text FROM unnest(pp.all_papers()) x WHERE public.estimator_reads_paper(x)), '0');
RESET ROLE;
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d6');
SET LOCAL ROLE authenticated;
SELECT pp.same('a primary reads no paper', pp.rows(), 'none');
SELECT pp.same('no layout and no signature image', pp.layouts() || ' ' || pp.images(), 'none none');
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
SELECT pp.same('every layout, under the table''s own policy, which this migration does not touch', pp.layouts(), 'f1,f2,f3');
RESET ROLE;
-- A training estimator reads the line and no more (migration *_estimator_reach): the rows an estimator reads, with
-- no layout and no signature image.
SELECT pp.as_user('00000000-0000-0000-0000-0000000403dc');
SET LOCAL ROLE authenticated;
SELECT pp.same('a training estimator reads the papers an estimator reads', pp.rows(), '103,104,107,111,112,113,114,116,118,119');
SELECT pp.same('and no layout and no signature image', pp.layouts() || ' ' || pp.images(), 'none none');
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

-- The two read rules of migration *_estimator_reach, as written: each asks for an estimator who is not in training,
-- and the image's asks the gate's own question. The guards' helper is closed to everyone signed in.
SELECT pp.same('the layout''s policy asks for an estimator, no twin, no training account, and an outside company''s paper',
  (SELECT concat_ws(' ', (q LIKE '%is_estimator()%')::text, (q LIKE '%is_digital_twin()%')::text, (q LIKE '%is_read_only()%')::text, (q LIKE '%paper_is_outside_company(%')::text)
   FROM (SELECT pg_get_expr(polqual, polrelid) AS q FROM pg_policy WHERE polrelid = 'public.contract_form_templates'::regclass AND polname = 'contract_form_templates_estimator_outside') x),
  'true true true true');
SELECT pp.same('the image''s policy names the bucket, refuses a training account and asks the gate''s question, for reading alone',
  (SELECT concat_ws(' ', (q LIKE '%contract-signer-signatures%')::text, (q LIKE '%is_read_only()%')::text, (q LIKE '%estimator_reads_paper(%')::text, polcmd::text)
   FROM (SELECT pg_get_expr(polqual, polrelid) AS q, polcmd FROM pg_policy WHERE polrelid = 'storage.objects'::regclass AND polname = 'contract_signer_signatures_estimator_outside') x),
  'true true true r');
SELECT pp.same('nobody signed in may ask whether a contact holds a paper',
  concat_ws(' ', has_function_privilege('anon', 'public.contact_holds_paper(uuid)', 'EXECUTE')::text, has_function_privilege('authenticated', 'public.contact_holds_paper(uuid)', 'EXECUTE')::text,
    has_function_privilege('service_role', 'public.contact_holds_paper(uuid)', 'EXECUTE')::text), 'false false true');

-- 6 · The paper follows its contact. Add to a list is Who is this?: Noor becomes a person at the customer, in place.
-- Naming a party who holds a paper is the four roles' (the owner's second decision, migration *_estimator_reach): an
-- estimator, who would read her papers once she is at a customer, is refused on every path, and still names someone
-- who holds none.
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d5');
SET LOCAL ROLE authenticated;
SELECT pp.refused('an estimator cannot say who a party on no list is once they hold a paper',
  format($q$SELECT public.name_contact(%L, 'customers', '00000000-0000-0000-0000-0000000403c1', 'customer', 'Noor Haddad')$q$, pp.by_email('noor@haddadeng.example')),
  'only the office says who they are');
SELECT pp.refused('nor name them a lead',
  format($q$SELECT public.name_contact(%L, NULL, NULL, 'lead', 'Noor Haddad')$q$, pp.by_email('noor@haddadeng.example')),
  'only the office says who they are');
SELECT pp.refused('nor write it on the contact with a statement of their own',
  format($q$UPDATE public.contacts SET kind = 'customer', customer_id = '00000000-0000-0000-0000-0000000403c1' WHERE id = %L$q$, pp.by_email('noor@haddadeng.example')),
  'only the office says who they are');
-- What is not a naming still passes for them: what she goes by.
UPDATE public.contacts SET goes_by = 'Noor' WHERE id = pp.by_email('noor@haddadeng.example');
SELECT public.contact_make_for_channel('email', 'nopaper@elsewhere.example');
SELECT pp.same('an estimator still names someone who holds no paper',
  (public.name_contact(pp.by_email('nopaper@elsewhere.example'), 'customers', '00000000-0000-0000-0000-0000000403c1', 'customer', 'Quinn Abara') = pp.by_email('nopaper@elsewhere.example'))::text, 'true');
RESET ROLE;
SELECT pp.same('Noor is still on no list, with the goes-by the estimator gave her',
  pp.who(pp.by_email('noor@haddadeng.example')) || '|' || (SELECT goes_by FROM public.contacts WHERE id = pp.by_email('noor@haddadeng.example')), 'unknown|no record|Noor Haddad|email noor@haddadeng.example|Noor');
SELECT pp.same('and the one with no paper is at the customer', pp.who(pp.by_email('nopaper@elsewhere.example')), 'customer|customer|Quinn Abara|email nopaper@elsewhere.example');
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
SELECT pp.same('the layout her W-9 is filled on reads now, and its signature image', pp.layouts() || ' ' || pp.images(), 'f1,f3 104,120');
-- A fold: the other typed-in signer turns out to be the rep, whose contact is there already. An estimator is refused
-- it too, since the folded contact is on no list and holds a paper, and nothing moves. The assistant runs it: the
-- helper is a definer, so the paper moves and the folded contact goes.
SELECT set_config('pp.was', pp.by_email('pat@elsewhere.example')::text, true);
SELECT pp.refused('an estimator cannot fold a party on no list who holds a paper into a record',
  format($q$SELECT public.name_contact(%L, 'supply_house_contacts', '00000000-0000-0000-0000-0000000403a3', 'supply_house')$q$, current_setting('pp.was')),
  'only the office says who they are');
SELECT pp.refused('nor run the fold by itself',
  format($q$SELECT public.contacts_fold(%L, %L)$q$, current_setting('pp.was'), pp.on('supply_house_contact_id', '00000000-0000-0000-0000-0000000403a3')),
  'only the office says who they are');
SELECT pp.refused('nor ask the helper to carry the paper by itself',
  format($q$SELECT public.contacts_fold_papers(%L, %L)$q$, current_setting('pp.was'), pp.on('supply_house_contact_id', '00000000-0000-0000-0000-0000000403a3')),
  'only the office says who they are');
-- A fold between two outside companies' contacts is no naming, and the helper carries its papers for an estimator as
-- before: the customer's certificate (119) goes to the trade company's contact. It is put back as postgres.
SELECT public.contacts_fold_papers(pp.on('customer_id', '00000000-0000-0000-0000-0000000403c1'), pp.on('gc_company_id', '00000000-0000-0000-0000-0000000403b1'));
RESET ROLE;
SELECT pp.same('the helper carried a paper between two outside companies for the estimator',
  pp.paper('00000000-0000-0000-0000-000004030119'), right(pp.on('gc_company_id', '00000000-0000-0000-0000-0000000403b1')::text, 4) || '|true|Ridgeway Builders|no person');
UPDATE public.person_contract_documents SET party_contact_id = pp.on('customer_id', '00000000-0000-0000-0000-0000000403c1'), person_name = 'party:' || pp.on('customer_id', '00000000-0000-0000-0000-0000000403c1')::text
  WHERE id = '00000000-0000-0000-0000-000004030119';
SELECT pp.same('the refused folds moved nothing, and the contact is still there',
  pp.paper('00000000-0000-0000-0000-000004030117') || ' ' || pp.who(current_setting('pp.was')::uuid),
  right(current_setting('pp.was'), 4) || '|true|Pat Tallman|no person unknown|no record|Pat Tallman|email pat@elsewhere.example');
SELECT pp.as_user('00000000-0000-0000-0000-0000000403d3');
SET LOCAL ROLE authenticated;
SELECT pp.same('the assistant names the other one the rep, and the contact folds into the rep''s',
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
