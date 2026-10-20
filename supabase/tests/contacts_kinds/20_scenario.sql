-- Messages, residential R0's SQL (migration *_contacts_seven_kinds, and *_contacts_team_kind since v2.5546): eight kinds of contact. The seeds give the roster's
-- subs, the supply houses' counters and their reps a contact each, once; a row says one kind on its own record; Who is
-- this? names a lead with no record, points a lead at its Prospects row and re-points a lead who books to the customer,
-- names a candidate, a sub, a rep and a second person at a supply house, and refuses a record of another kind;
-- Follow up's badge leaves out supply houses and candidates; a sub and a supply house make a trade partner's promises;
-- a candidate reads only to a dev and the hiring board;
-- deleting a Prospects row, a candidate, a rep or a supply house keeps every thread; and a roster person's contact
-- follows the roster's kind. Presses run as each user through RLS; the fixture and the messages are made as postgres,
-- standing in for the screens and the service role; everything rolls back. Raises on the first failed assertion; ends
-- with "contacts_kinds PASSED". See scripts/pgtest-contacts-kinds.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office: a dev, an estimator off the hiring board, an assistant on it; a superintendent outside the office.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'dev@kinds.test'),
  ('00000000-0000-0000-0000-0000000007d2', 'estimator@kinds.test'),
  ('00000000-0000-0000-0000-0000000007d3', 'assistant@kinds.test'),
  ('00000000-0000-0000-0000-0000000007d4', 'super@kinds.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, team_prospects_access) VALUES
  ('00000000-0000-0000-0000-0000000007d1', 'dev@kinds.test', 'Kinds Dev', 'dev', false, false, false),
  ('00000000-0000-0000-0000-0000000007d2', 'estimator@kinds.test', 'Kinds Estimator', 'estimator', false, false, false),
  ('00000000-0000-0000-0000-0000000007d3', 'assistant@kinds.test', 'Kinds Assistant', 'assistant', false, false, true),
  ('00000000-0000-0000-0000-0000000007d4', 'super@kinds.test', 'Kinds Super', 'superintendent', false, false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, team_prospects_access = EXCLUDED.team_prospects_access;

-- A homeowner; a sub and a helper on the roster; two leads on Prospects; a candidate on the hiring board; a supply house
-- with two reps, an archived one and the jobs side's shortlist row; an insurer.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000000007c1', 'Kins Ramos', '00000000-0000-0000-0000-0000000007d1');
INSERT INTO public.people (id, master_user_id, kind, name, phone, email) VALUES
  ('00000000-0000-0000-0000-0000000007b1', '00000000-0000-0000-0000-0000000007d1', 'sub', 'Kins Sub', '(210) 555-0701', 'sub@kins.example'),
  ('00000000-0000-0000-0000-0000000007b2', '00000000-0000-0000-0000-0000000007d1', 'helper', 'Kins Helper', '(210) 555-0702', NULL),
  ('00000000-0000-0000-0000-0000000007b3', '00000000-0000-0000-0000-0000000007d1', 'assistant', 'Kins Office', NULL, NULL);
INSERT INTO public.prospects (id, master_user_id, created_by, contact_name, company_name) VALUES
  ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007d1', '00000000-0000-0000-0000-0000000007d1', 'Kevin Lead', NULL),
  ('00000000-0000-0000-0000-0000000007e2', '00000000-0000-0000-0000-0000000007d1', '00000000-0000-0000-0000-0000000007d1', 'Lena Lead', NULL);
INSERT INTO public.team_prospects (id, master_user_id, created_by, name, phone_number) VALUES
  ('00000000-0000-0000-0000-0000000007f1', '00000000-0000-0000-0000-0000000007d1', '00000000-0000-0000-0000-0000000007d1', 'Cal Candidate', '(210) 555-0703');
INSERT INTO public.supply_houses (id, name, phone, vendor_kind) VALUES
  ('00000000-0000-0000-0000-0000000007a1', 'Kins Supply', '(210) 555-0704', 'supply_house'),
  ('00000000-0000-0000-0000-0000000007a2', 'Kins Insurance', '(210) 555-0705', 'insurer');
INSERT INTO public.supply_house_contacts (id, supply_house_id, label, name, email, phone, archived_at) VALUES
  ('00000000-0000-0000-0000-0000000007a3', '00000000-0000-0000-0000-0000000007a1', 'Ray', 'Ray Counter', 'ray@kinssupply.example', '(210) 555-0706', NULL),
  ('00000000-0000-0000-0000-0000000007a4', '00000000-0000-0000-0000-0000000007a1', 'Rita', 'Rita Rep', 'rita@kinssupply.example', NULL, NULL),
  ('00000000-0000-0000-0000-0000000007a5', NULL, 'Shortlist', NULL, 'list@kinssupply.example', NULL, NULL),
  ('00000000-0000-0000-0000-0000000007a6', '00000000-0000-0000-0000-0000000007a1', 'Old', 'Old Rep', 'old@kinssupply.example', NULL, now());

CREATE SCHEMA mk;
CREATE FUNCTION mk.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION mk.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION mk.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- Who a contact is, in one line: its kind, the record and the name it carries. Read as postgres, past every policy.
CREATE FUNCTION mk.who(p_contact uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce((SELECT concat_ws('|', kind,
    CASE WHEN customer_id IS NOT NULL THEN 'customer ' || right(customer_id::text, 3)
         WHEN customer_contact_person_id IS NOT NULL THEN 'person ' || right(customer_contact_person_id::text, 3)
         WHEN gc_company_id IS NOT NULL THEN 'company ' || right(gc_company_id::text, 3)
         WHEN gc_company_person_id IS NOT NULL THEN 'trade person ' || right(gc_company_person_id::text, 3)
         WHEN person_id IS NOT NULL THEN 'roster ' || right(person_id::text, 3)
         WHEN prospect_id IS NOT NULL THEN 'prospect ' || right(prospect_id::text, 3)
         WHEN supply_house_id IS NOT NULL THEN 'house ' || right(supply_house_id::text, 3)
         WHEN supply_house_contact_id IS NOT NULL THEN 'rep ' || right(supply_house_contact_id::text, 3)
         WHEN team_prospect_id IS NOT NULL THEN 'candidate ' || right(team_prospect_id::text, 3)
         ELSE 'no record' END,
    coalesce(name, '-'))
  FROM public.contacts WHERE id = p_contact), 'gone')
$$;
-- A contact's thread, oldest first, by body, past every policy.
CREATE FUNCTION mk.thread(p_contact uuid) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT coalesce(string_agg(body, ' / ' ORDER BY at), '') FROM public.messages WHERE contact_id = p_contact
$$;
-- The contact on a record, past every policy.
CREATE FUNCTION mk.on(p_column text, p_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v uuid;
BEGIN
  EXECUTE format('SELECT id FROM public.contacts WHERE %I = $1 AND name IS NULL', p_column) INTO v USING p_id;
  RETURN v;
END $$;
GRANT USAGE ON SCHEMA mk TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mk TO anon, authenticated;

-- 1 · The seeds: the roster's sub and its two teammates (v2.5546; the helper got none before), the supply house's counter
-- and its two reps, each once; the insurer, the archived rep and the shortlist row get none.
SELECT mk.same('the roster gives its sub and its two teammates a contact', public.contacts_subs_from_roster()::text, '3');
SELECT mk.same('and nobody the second time', public.contacts_subs_from_roster()::text, '0');
SELECT mk.same('the supply house gives its counter and two reps a contact', public.contacts_from_supply_houses()::text, '3');
SELECT mk.same('and nobody the second time', public.contacts_from_supply_houses()::text, '0');
SELECT mk.same('who each one is',
  (SELECT string_agg(mk.who(id), ', ' ORDER BY mk.who(id)) FROM public.contacts),
  'sub|roster 7b1|-, supply_house|house 7a1|-, supply_house|rep 7a3|-, supply_house|rep 7a4|-, team|roster 7b2|-, team|roster 7b3|-');
SELECT mk.same('their numbers and addresses, as the roster and the RFQ desk hold them',
  (SELECT string_agg(mk.who(contact_id) || ' ' || kind || ' ' || key, ', ' ORDER BY mk.who(contact_id), kind, key) FROM public.contact_channels),
  'sub|roster 7b1|- email sub@kins.example, sub|roster 7b1|- phone 2105550701, supply_house|house 7a1|- phone 2105550704, supply_house|rep 7a3|- email ray@kinssupply.example, supply_house|rep 7a3|- phone 2105550706, supply_house|rep 7a4|- email rita@kinssupply.example, team|roster 7b2|- phone 2105550702');

CREATE TEMP TABLE ids AS SELECT
  mk.on('person_id', '00000000-0000-0000-0000-0000000007b1') AS sub,
  mk.on('person_id', '00000000-0000-0000-0000-0000000007b2') AS helper,
  mk.on('person_id', '00000000-0000-0000-0000-0000000007b3') AS office,
  mk.on('supply_house_id', '00000000-0000-0000-0000-0000000007a1') AS counter,
  mk.on('supply_house_contact_id', '00000000-0000-0000-0000-0000000007a3') AS ray,
  mk.on('supply_house_contact_id', '00000000-0000-0000-0000-0000000007a4') AS rita;
GRANT SELECT ON ids TO authenticated;

-- 2 · What a row may say.
SELECT mk.refused('a kind we do not have', $q$INSERT INTO public.contacts (kind) VALUES ('vendor')$q$, 'contacts_kind_known');
SELECT mk.refused('a lead is on Prospects or on nothing', $q$INSERT INTO public.contacts (kind, customer_id) VALUES ('lead', '00000000-0000-0000-0000-0000000007c1')$q$, 'contacts_one_record');
SELECT mk.refused('one record, not two', $q$INSERT INTO public.contacts (kind, supply_house_id, supply_house_contact_id) VALUES ('supply_house', '00000000-0000-0000-0000-0000000007a2', '00000000-0000-0000-0000-0000000007a5')$q$, 'contacts_one_record');
SELECT mk.refused('a Prospects row is a lead', $q$INSERT INTO public.contacts (kind, prospect_id) VALUES ('customer', '00000000-0000-0000-0000-0000000007e1')$q$, 'contacts_kind_record');
SELECT mk.refused('a supply house is a supply house', $q$INSERT INTO public.contacts (kind, supply_house_id) VALUES ('trade', '00000000-0000-0000-0000-0000000007a2')$q$, 'contacts_kind_record');
SELECT mk.refused('a hiring board row is a candidate', $q$INSERT INTO public.contacts (kind, team_prospect_id) VALUES ('trade', '00000000-0000-0000-0000-0000000007f1')$q$, 'contacts_kind_record');
SELECT mk.refused('a candidate is on the hiring board', $q$INSERT INTO public.contacts (kind, person_id) VALUES ('candidate', '00000000-0000-0000-0000-0000000007b2')$q$, 'contacts_kind_record');
SELECT mk.refused('a sub is on the roster', $q$INSERT INTO public.contacts (kind, customer_id) VALUES ('sub', '00000000-0000-0000-0000-0000000007c1')$q$, 'contacts_kind_record');
SELECT mk.refused('a teammate is on the roster', $q$INSERT INTO public.contacts (kind) VALUES ('team')$q$, 'contacts_kind_record');
SELECT mk.refused('a roster row is a sub or a teammate, never a trade partner', $q$INSERT INTO public.contacts (kind, person_id) VALUES ('trade', '00000000-0000-0000-0000-0000000007b2')$q$, 'contacts_kind_record');
SELECT mk.refused('a rep is one contact', $q$INSERT INTO public.contacts (kind, supply_house_contact_id) VALUES ('supply_house', '00000000-0000-0000-0000-0000000007a3')$q$, 'contacts_supply_house_contact_once');
SELECT mk.refused('a supply house''s counter is one contact', $q$INSERT INTO public.contacts (kind, supply_house_id) VALUES ('supply_house', '00000000-0000-0000-0000-0000000007a1')$q$, 'contacts_supply_house_once');

-- 3 · Numbers nobody knows, and their lines (as the service role makes them).
INSERT INTO public.contacts (id, kind) VALUES
  ('00000000-0000-0000-0000-000000007011', 'unknown'),
  ('00000000-0000-0000-0000-000000007013', 'unknown'),
  ('00000000-0000-0000-0000-000000007014', 'unknown'),
  ('00000000-0000-0000-0000-000000007015', 'unknown'),
  ('00000000-0000-0000-0000-000000007016', 'unknown'),
  ('00000000-0000-0000-0000-000000007017', 'unknown'),
  ('00000000-0000-0000-0000-000000007018', 'unknown'),
  ('00000000-0000-0000-0000-000000007019', 'unknown'),
  ('00000000-0000-0000-0000-00000000701a', 'unknown'),
  ('00000000-0000-0000-0000-00000000701b', 'unknown'),
  ('00000000-0000-0000-0000-00000000701c', 'unknown'),
  ('00000000-0000-0000-0000-00000000701d', 'unknown');
INSERT INTO public.contact_channels (contact_id, kind, value) VALUES
  ('00000000-0000-0000-0000-000000007011', 'phone', '(210) 555-0711'),
  ('00000000-0000-0000-0000-000000007013', 'phone', '210-555-0703'),
  ('00000000-0000-0000-0000-000000007014', 'phone', '(210) 555-0714'),
  ('00000000-0000-0000-0000-000000007015', 'phone', '(210) 555-0715'),
  ('00000000-0000-0000-0000-000000007016', 'phone', '(210) 555-0716'),
  ('00000000-0000-0000-0000-000000007017', 'phone', '(210) 555-0717'),
  ('00000000-0000-0000-0000-000000007018', 'phone', '(210) 555-0718'),
  ('00000000-0000-0000-0000-00000000701d', 'phone', '(210) 555-0790');
INSERT INTO public.messages (contact_id, channel_id, channel, direction, at, body)
SELECT ch.contact_id, ch.id, 'text', 'in', now() - v.ago, v.body
FROM (VALUES
  ('00000000-0000-0000-0000-000000007011'::uuid, interval '5 hours', 'Hi, my water heater is leaking.'),
  ('00000000-0000-0000-0000-000000007013'::uuid, interval '4 hours', 'Looking for work as a helper.'),
  ('00000000-0000-0000-0000-000000007014'::uuid, interval '3 hours', 'On my way.'),
  ('00000000-0000-0000-0000-000000007015'::uuid, interval '2 hours', 'Price on the 2210 request attached.'),
  ('00000000-0000-0000-0000-000000007016'::uuid, interval '90 minutes', 'Your order is ready.'),
  ('00000000-0000-0000-0000-000000007017'::uuid, interval '1 hour', 'My husband texted you too.'),
  ('00000000-0000-0000-0000-000000007018'::uuid, interval '30 minutes', 'Will call desk.')
) AS v(contact_id, ago, body)
JOIN public.contact_channels ch ON ch.contact_id = v.contact_id;

-- 4 · Who is this? The assistant, on the hiring board, names the leads, the candidate and the supply house's people.
SELECT mk.as_user('00000000-0000-0000-0000-0000000007d3');
SET LOCAL ROLE authenticated;
SELECT mk.same('Kevin is a lead with no record, under the name his text gave',
  (SELECT public.name_contact('00000000-0000-0000-0000-000000007011', NULL, NULL, 'lead', ' Kevin '))::text, '00000000-0000-0000-0000-000000007011');
SELECT mk.same('who Kevin is', mk.who('00000000-0000-0000-0000-000000007011'), 'lead|no record|Kevin');
SELECT mk.refused('a lead is not made a lead twice', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000007011', NULL, NULL, 'lead', 'Kev')$q$, 'only when added to Prospects');
SELECT mk.same('Add to Prospects points Kevin at his row and keeps his thread',
  (SELECT public.name_contact('00000000-0000-0000-0000-000000007011', 'prospects', '00000000-0000-0000-0000-0000000007e1', 'lead'))::text, '00000000-0000-0000-0000-000000007011');
SELECT mk.same('who Kevin is now, named by his row',
  concat_ws('|', mk.who('00000000-0000-0000-0000-000000007011'), public.contact_display_name('00000000-0000-0000-0000-000000007011'), mk.thread('00000000-0000-0000-0000-000000007011')),
  'lead|prospect 7e1|-|Kevin Lead|Hi, my water heater is leaking.');
SELECT mk.refused('a lead on Prospects is not moved to another row', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000007011', 'prospects', '00000000-0000-0000-0000-0000000007e2', 'lead')$q$, 'namedAlready');
SELECT mk.refused('a lead is not named a supply house', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000007011', 'supply_houses', '00000000-0000-0000-0000-0000000007a1', 'supply_house')$q$, 'namedAlready');
SELECT public.name_contact('00000000-0000-0000-0000-00000000701a', NULL, NULL, 'lead', 'Lena');
SELECT public.name_contact('00000000-0000-0000-0000-00000000701a', 'prospects', '00000000-0000-0000-0000-0000000007e2', 'lead');
SELECT mk.same('Lena is a lead on her row', mk.who('00000000-0000-0000-0000-00000000701a'), 'lead|prospect 7e2|-');
SELECT mk.same('the candidate''s text is the candidate',
  (SELECT public.name_contact('00000000-0000-0000-0000-000000007013', 'team_prospects', '00000000-0000-0000-0000-0000000007f1', 'candidate'))::text, '00000000-0000-0000-0000-000000007013');
SELECT mk.same('who the candidate is', concat_ws('|', mk.who('00000000-0000-0000-0000-000000007013'), public.contact_display_name('00000000-0000-0000-0000-000000007013')),
  'candidate|candidate 7f1|-|Cal Candidate');
SELECT mk.same('Ray''s other phone folds into Ray, the rep', (SELECT public.name_contact('00000000-0000-0000-0000-000000007015', 'supply_house_contacts', '00000000-0000-0000-0000-0000000007a3', 'supply_house') = ray FROM ids)::text, 'true');
SELECT mk.same('his line is his, and the empty contact is gone',
  (SELECT concat_ws('|', mk.who('00000000-0000-0000-0000-000000007015'), mk.thread(ray), public.contact_display_name(ray)) FROM ids),
  'gone|Price on the 2210 request attached.|Ray Counter');
SELECT mk.same('Dina keeps her own contact on the supply house, under her own name',
  (SELECT public.name_contact('00000000-0000-0000-0000-000000007016', 'supply_houses', '00000000-0000-0000-0000-0000000007a1', 'supply_house', 'Dina'))::text, '00000000-0000-0000-0000-000000007016');
SELECT mk.same('who Dina is', mk.who('00000000-0000-0000-0000-000000007016'), 'supply_house|house 7a1|Dina');
SELECT mk.same('the house''s own name, in another case, is its counter', (SELECT public.name_contact('00000000-0000-0000-0000-000000007018', 'supply_houses', '00000000-0000-0000-0000-0000000007a1', 'supply_house', ' kins SUPPLY ') = counter FROM ids)::text, 'true');
SELECT mk.same('the counter''s line and name', (SELECT concat_ws('|', mk.thread(counter), public.contact_display_name(counter)) FROM ids), 'Will call desk.|Kins Supply');
-- What is refused.
SELECT mk.refused('a hiring board row is not a customer', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000007019', 'team_prospects', '00000000-0000-0000-0000-0000000007f1', 'customer')$q$, 'kindDoesNotFit');
SELECT mk.refused('a Prospects row is not a customer', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000007019', 'prospects', '00000000-0000-0000-0000-0000000007e1', 'customer')$q$, 'kindDoesNotFit');
SELECT mk.refused('a rep is not a trade partner', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000007019', 'supply_house_contacts', '00000000-0000-0000-0000-0000000007a3', 'trade')$q$, 'kindDoesNotFit');
SELECT mk.refused('only a lead goes with no record', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000007019', NULL, NULL, 'customer')$q$, 'recordNeeded');
SELECT mk.refused('a record needs its id', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000007019', 'supply_house_contacts', NULL, 'supply_house')$q$, 'recordNeeded');
SELECT mk.refused('nobody on Prospects with that id', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000007019', 'prospects', gen_random_uuid(), 'lead')$q$, 'recordNotFound');
SELECT mk.refused('a kind we do not have', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000007019', 'supply_houses', '00000000-0000-0000-0000-0000000007a1', 'vendor')$q$, 'kindNeeded');
RESET ROLE;

-- 5 · The dev names the roster and the customer: the sub, the helper, and Kevin when he books.
SELECT mk.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;
SELECT mk.same('the sub''s other number folds into the sub', (SELECT public.name_contact('00000000-0000-0000-0000-000000007014', 'people', '00000000-0000-0000-0000-0000000007b1', 'sub') = sub FROM ids)::text, 'true');
SELECT mk.same('the sub''s line is the sub''s', (SELECT mk.thread(sub) FROM ids), 'On my way.');
SELECT mk.refused('a helper on the roster is not a sub', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000007019', 'people', '00000000-0000-0000-0000-0000000007b2', 'sub')$q$, 'kindDoesNotFit');
SELECT mk.refused('a customer is not a lead', $q$SELECT public.name_contact('00000000-0000-0000-0000-000000007019', 'customers', '00000000-0000-0000-0000-0000000007c1', 'lead')$q$, 'kindDoesNotFit');
SELECT mk.refused('a helper on the roster is not a trade partner (v2.5546)', $q$SELECT public.name_contact('00000000-0000-0000-0000-00000000701b', 'people', '00000000-0000-0000-0000-0000000007b2', 'trade')$q$, 'kindDoesNotFit');
SELECT mk.refused('nor a customer', $q$SELECT public.name_contact('00000000-0000-0000-0000-00000000701b', 'people', '00000000-0000-0000-0000-0000000007b2', 'customer')$q$, 'kindDoesNotFit');
SELECT mk.refused('a sub is not a teammate', $q$SELECT public.name_contact('00000000-0000-0000-0000-00000000701b', 'people', '00000000-0000-0000-0000-0000000007b1', 'team')$q$, 'kindDoesNotFit');
SELECT mk.same('the helper''s other number folds into the helper, one of our own team', (SELECT public.name_contact('00000000-0000-0000-0000-00000000701b', 'people', '00000000-0000-0000-0000-0000000007b2', 'team') = helper FROM ids)::text, 'true');
SELECT mk.same('the helper is one of our own team, and the roster keeps the number it had',
  (SELECT concat_ws('|', mk.who(helper), (SELECT phone FROM public.people WHERE id = '00000000-0000-0000-0000-0000000007b2')) FROM ids), 'team|roster 7b2|-|(210) 555-0702');
SELECT mk.same('the office person''s number folds into them too', (SELECT public.name_contact('00000000-0000-0000-0000-00000000701d', 'people', '00000000-0000-0000-0000-0000000007b3', 'team') = office FROM ids)::text, 'true');
SELECT mk.same('and the roster, which had none, learned it', (SELECT phone FROM public.people WHERE id = '00000000-0000-0000-0000-0000000007b3'), '(210) 555-0790');
SELECT mk.same('Kevin books: the lead is the customer now, his thread whole',
  (SELECT public.name_contact('00000000-0000-0000-0000-000000007011', 'customers', '00000000-0000-0000-0000-0000000007c1', 'customer'))::text, '00000000-0000-0000-0000-000000007011');
SELECT mk.same('who Kevin is when he books', concat_ws('|', mk.who('00000000-0000-0000-0000-000000007011'), mk.thread('00000000-0000-0000-0000-000000007011')),
  'customer|customer 7c1|-|Hi, my water heater is leaking.');
SELECT public.name_contact('00000000-0000-0000-0000-000000007017', NULL, NULL, 'lead', 'Rosa');
SELECT mk.same('a second lead who books as the same customer folds into Kevin''s contact',
  (SELECT public.name_contact('00000000-0000-0000-0000-000000007017', 'customers', '00000000-0000-0000-0000-0000000007c1', 'customer'))::text, '00000000-0000-0000-0000-000000007011');
SELECT mk.same('both lines are on the customer, and the second lead is gone',
  concat_ws('|', mk.who('00000000-0000-0000-0000-000000007017'), mk.thread('00000000-0000-0000-0000-000000007011')),
  'gone|Hi, my water heater is leaking. / My husband texted you too.');
SELECT public.name_contact('00000000-0000-0000-0000-00000000701c', NULL, NULL, 'lead', 'Theo');
SELECT mk.refused('a lead is not named a trade partner', $q$SELECT public.name_contact('00000000-0000-0000-0000-00000000701c', 'people', '00000000-0000-0000-0000-0000000007b2', 'trade')$q$, 'namedAlready');
RESET ROLE;

-- 6 · Follow up's badge leaves out the supply house's three and the candidate: of six people waiting on us, it counts
-- the customer and the sub.
SELECT mk.same('six people wait on us', (SELECT count(*) FROM public.contacts WHERE state = 'waiting')::text, '6');
SELECT mk.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;
SELECT mk.same('the badge counts two', public.follow_up_count()::text, '2');
RESET ROLE;

-- 7 · The candidate door: a dev and the hiring board read the candidate, their number and their line; the estimator
-- off the board reads none of them, and so ties nothing of theirs. Everyone in the office reads the rest.
CREATE TEMP TABLE lines AS SELECT
  (SELECT id FROM public.messages WHERE body = 'Looking for work as a helper.') AS candidate_line;
GRANT SELECT ON lines TO authenticated;
CREATE FUNCTION mk.reads() RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|',
    (SELECT count(*) FROM public.contacts WHERE kind = 'candidate'),
    (SELECT count(*) FROM public.contact_channels WHERE key = '2105550703'),
    (SELECT count(*) FROM public.messages WHERE body = 'Looking for work as a helper.'),
    (SELECT count(*) FROM public.contacts WHERE kind IN ('lead', 'customer', 'sub', 'supply_house')),
    (SELECT count(*) FROM public.messages WHERE body = 'Price on the 2210 request attached.'))
$$;
GRANT EXECUTE ON FUNCTION mk.reads() TO authenticated;
SELECT mk.as_user('00000000-0000-0000-0000-0000000007d2');
SET LOCAL ROLE authenticated;
SELECT mk.same('the estimator off the board reads no candidate', mk.reads(), '0|0|0|8|1');
SELECT mk.refused('and ties none of their lines', $q$SELECT public.tie_message((SELECT candidate_line FROM lines), NULL, NULL)$q$, 'notFound');
RESET ROLE;
SELECT mk.as_user('00000000-0000-0000-0000-0000000007d3');
SET LOCAL ROLE authenticated;
SELECT mk.same('the assistant on the board reads the candidate', mk.reads(), '1|1|1|8|1');
RESET ROLE;
SELECT mk.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;
SELECT mk.same('the dev reads the candidate', mk.reads(), '1|1|1|8|1');
RESET ROLE;
SELECT mk.as_user('00000000-0000-0000-0000-0000000007d4');
SET LOCAL ROLE authenticated;
SELECT mk.same('a superintendent outside the office reads nothing', mk.reads(), '0|0|0|0|0');
RESET ROLE;

-- 7b · The promises each kind makes are the screen's (promiseChoices): a sub and a supply house make a trade partner's,
-- and a day heard on a candidate's line is no line of the estimator's off the board.
INSERT INTO public.message_promises (message_id, day)
SELECT id, current_date + 1 FROM public.messages
WHERE body IN ('On my way.', 'Price on the 2210 request attached.', 'Looking for work as a helper.');
SELECT mk.as_user('00000000-0000-0000-0000-0000000007d1');
SET LOCAL ROLE authenticated;
SELECT public.write_down((SELECT id FROM public.messages WHERE body = 'On my way.'), 'start');
SELECT mk.refused('a supply house promises no payment', $q$SELECT public.write_down((SELECT id FROM public.messages WHERE body = 'Price on the 2210 request attached.'), 'payment')$q$, 'That is not a promise a trade partner makes.');
SELECT public.write_down((SELECT id FROM public.messages WHERE body = 'Price on the 2210 request attached.'), 'quote');
RESET ROLE;
SELECT mk.same('the sub''s start and the house''s quote are written down',
  (SELECT string_agg(m.body || ' ' || p.kind || coalesce(' ' || p.writes, ''), ', ' ORDER BY m.body)
   FROM public.message_promises p JOIN public.messages m ON m.id = p.message_id WHERE p.state = 'written'),
  'On my way. start start, Price on the 2210 request attached. quote');
SELECT mk.as_user('00000000-0000-0000-0000-0000000007d2');
SET LOCAL ROLE authenticated;
SELECT mk.refused('the estimator off the board writes nothing down on a candidate''s line', $q$SELECT public.write_down((SELECT candidate_line FROM lines), 'quote')$q$, 'No day was heard on that line.');
SELECT mk.refused('nor calls it just talk', $q$SELECT public.write_down((SELECT candidate_line FROM lines), NULL)$q$, 'No day was heard on that line.');
RESET ROLE;

-- 8 · The screens delete a Prospects row, a candidate, a rep and the supply house: every thread stays.
DELETE FROM public.prospects WHERE id = '00000000-0000-0000-0000-0000000007e2';
SELECT mk.same('Lena stays a lead with no record, under her Prospects name', mk.who('00000000-0000-0000-0000-00000000701a'), 'lead|no record|Lena Lead');
DELETE FROM public.team_prospects WHERE id = '00000000-0000-0000-0000-0000000007f1';
SELECT mk.same('the candidate is a number again, keeping the name and the line',
  concat_ws('|', mk.who('00000000-0000-0000-0000-000000007013'), mk.thread('00000000-0000-0000-0000-000000007013')),
  'unknown|no record|Cal Candidate|Looking for work as a helper.');
DELETE FROM public.supply_house_contacts WHERE id = '00000000-0000-0000-0000-0000000007a4';
SELECT mk.same('Rita moves onto her house under her name', (SELECT mk.who(rita) FROM ids), 'supply_house|house 7a1|Rita Rep');
DELETE FROM public.supply_houses WHERE id = '00000000-0000-0000-0000-0000000007a1';
SELECT mk.same('the house goes, and its reps with it: each of the five is a number again, keeping the name and the lines',
  (SELECT concat_ws(', ', mk.who(counter) || ' ' || mk.thread(counter), mk.who(ray) || ' ' || mk.thread(ray), mk.who(rita),
     mk.who('00000000-0000-0000-0000-000000007016') || ' ' || mk.thread('00000000-0000-0000-0000-000000007016')) FROM ids),
  'unknown|no record|Kins Supply Will call desk., unknown|no record|Ray Counter Price on the 2210 request attached., unknown|no record|Rita Rep, unknown|no record|Dina Your order is ready.');

-- 9 · A roster person's contact follows the roster: the helper becomes a sub and the sub a helper.
UPDATE public.people SET kind = 'sub' WHERE id = '00000000-0000-0000-0000-0000000007b2';
UPDATE public.people SET kind = 'helper' WHERE id = '00000000-0000-0000-0000-0000000007b1';
SELECT mk.same('two contacts change kind', public.contacts_subs_from_roster()::text, '2');
SELECT mk.same('the new sub is a sub with the roster''s number, the old one a teammate (v2.5546)',
  (SELECT concat_ws(', ', mk.who(helper),
     (SELECT string_agg(key, ',' ORDER BY key) FROM public.contact_channels WHERE contact_id = helper), mk.who(sub)) FROM ids),
  'sub|roster 7b2|-, 2105550702, team|roster 7b1|-');

DO $$ BEGIN RAISE NOTICE 'contacts_kinds PASSED'; END $$;
ROLLBACK;
