-- Documents → Agreements' one list (migrations *_agreements_on_file, *_agreements_on_file_gc and
-- *_agreements_job_papers, punch list #376 and papers before a job opens): the
-- view answers a job's contract, a warranty, a GC's own paper, a signed paper over several jobs, a person's agreement,
-- a sub work order and GC mode's three (our contract with the owner, a trade's statement of work, a trade company's
-- agreement) as one shape, under each table's own row security. The scenario, inside one transaction that rolls back: the office reads every row
-- in the order the page draws them, with the right state, name, party, job and day; a paper filed over three jobs is one
-- line that a covered job's number still finds; drafts, unsent papers and papers that are not agreements are absent; the
-- facts carry each kind's own columns and no amount; and each role reads only what its tables allow, so an estimator
-- reads work orders alone, a primary and a superintendent nothing, a sub their own work order, and a caller who is not
-- signed in nothing. Every name, job and date is made up. The fixture is made as postgres; reads run as each user.
-- Raises on the first failed assertion; ends with "agreements_on_file PASSED". See scripts/pgtest-agreements-on-file.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000376d1', 'dev@agreements.test'),
  ('00000000-0000-0000-0000-0000000376d2', 'master@agreements.test'),
  ('00000000-0000-0000-0000-0000000376d3', 'assistant@agreements.test'),
  ('00000000-0000-0000-0000-0000000376d4', 'controller@agreements.test'),
  ('00000000-0000-0000-0000-0000000376d5', 'estimator@agreements.test'),
  ('00000000-0000-0000-0000-0000000376d6', 'primary@agreements.test'),
  ('00000000-0000-0000-0000-0000000376d7', 'super@agreements.test'),
  ('00000000-0000-0000-0000-0000000376d8', 'sub@agreements.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000376d1', 'dev@agreements.test', 'Agreements Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000376d2', 'master@agreements.test', 'Agreements Master', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000376d3', 'assistant@agreements.test', 'Agreements Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000376d4', 'controller@agreements.test', 'Agreements Controller', 'controller', false, false),
  ('00000000-0000-0000-0000-0000000376d5', 'estimator@agreements.test', 'Agreements Estimator', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000376d6', 'primary@agreements.test', 'Agreements Primary', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000376d7', 'super@agreements.test', 'Agreements Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000376d8', 'sub@agreements.test', 'Ortega Mechanical', 'subcontractor', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000376f9', 'Agreements Bed Plumbing');
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000000376c1', 'Harlan Pierce', '00000000-0000-0000-0000-0000000376d2'),
  ('00000000-0000-0000-0000-0000000376c2', 'Ridgeway Builders', '00000000-0000-0000-0000-0000000376d2'),
  ('00000000-0000-0000-0000-0000000376c3', 'Dalton Property Group', '00000000-0000-0000-0000-0000000376d2');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, job_address, customer_name, customer_id, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000000376b1', '00000000-0000-0000-0000-0000000376d2', '00000000-0000-0000-0000-0000000376f9', '2418', 'Pierce kitchen repipe', '410 Maple St', 'Harlan Pierce', '00000000-0000-0000-0000-0000000376c1', 'customer', 100, 0, 'waiting'),
  ('00000000-0000-0000-0000-0000000376b2', '00000000-0000-0000-0000-0000000376d2', '00000000-0000-0000-0000-0000000376f9', '2391', 'Cedar Bluff Lofts', '1200 Quarry Rd', 'Dalton Property Group', '00000000-0000-0000-0000-0000000376c3', 'customer', 100, 0, 'waiting'),
  ('00000000-0000-0000-0000-0000000376b3', '00000000-0000-0000-0000-0000000376d2', '00000000-0000-0000-0000-0000000376f9', '2377', 'Dalton duplex A', '1 Elm Row', 'Dalton Property Group', '00000000-0000-0000-0000-0000000376c3', 'customer', 100, 0, 'waiting'),
  ('00000000-0000-0000-0000-0000000376b4', '00000000-0000-0000-0000-0000000376d2', '00000000-0000-0000-0000-0000000376f9', '2378', 'Dalton duplex B', '3 Elm Row', 'Dalton Property Group', '00000000-0000-0000-0000-0000000376c3', 'customer', 100, 0, 'waiting'),
  ('00000000-0000-0000-0000-0000000376b5', '00000000-0000-0000-0000-0000000376d2', '00000000-0000-0000-0000-0000000376f9', '2379', 'Dalton duplex C', '5 Elm Row', 'Dalton Property Group', '00000000-0000-0000-0000-0000000376c3', 'customer', 100, 0, 'waiting');
-- Cedar Bluff Lofts has a GC, whose own paper we signed.
UPDATE public.jobs_ledger SET gc_customer_id = '00000000-0000-0000-0000-0000000376c2' WHERE id = '00000000-0000-0000-0000-0000000376b2';

-- Job papers. a1 out to be signed, a2 voided, a3 a draft, a4 a GC's own paper, a5 to a7 one signed paper over three
-- jobs, a8 a warranty signed late in the evening, Chicago time, of the 13th (the 14th in UTC).
INSERT INTO public.job_contracts (id, job_id, kind, status, template_name, recipient_email, sent_at, last_sent_at, send_count, view_count, sent_channel, created_at) VALUES
  ('00000000-0000-0000-0000-0000000376a1', '00000000-0000-0000-0000-0000000376b1', 'contract', 'sent', 'Residential plumbing contract', 'harlan@example.test', '2026-11-16T15:00:00Z', '2026-11-17T15:00:00Z', 2, 3, 'link', '2026-11-15T15:00:00Z');
INSERT INTO public.job_contracts (id, job_id, kind, status, template_name, voided_at, created_at) VALUES
  ('00000000-0000-0000-0000-0000000376a2', '00000000-0000-0000-0000-0000000376b1', 'contract', 'voided', 'Residential plumbing contract', '2026-10-15T20:00:00Z', '2026-10-10T15:00:00Z');
INSERT INTO public.job_contracts (id, job_id, kind, status, template_name, created_at) VALUES
  ('00000000-0000-0000-0000-0000000376a3', '00000000-0000-0000-0000-0000000376b3', 'contract', 'draft', 'A draft nobody sent', '2026-10-10T15:00:00Z');
INSERT INTO public.job_contracts (id, job_id, kind, status, paper_title, our_signer_name, our_signed_on, relied_on_on, relied_on_what, created_at) VALUES
  ('00000000-0000-0000-0000-0000000376a4', '00000000-0000-0000-0000-0000000376b2', 'their_paper', 'signed', 'Subcontract Agreement, Ridgeway form', 'Dana Whitlock', '2026-11-10', '2026-11-12', 'their notice to proceed', '2026-11-10T22:00:00Z');
INSERT INTO public.job_contracts (id, job_id, kind, status, signer_mode, signed_at, signer_printed_name, paper_upload_path, covers_group_id, created_at) VALUES
  ('00000000-0000-0000-0000-0000000376a5', '00000000-0000-0000-0000-0000000376b3', 'contract', 'signed', 'paper', '2026-10-30T12:00:00Z', 'D. Dalton', '376/paper.pdf', '00000000-0000-0000-0000-0000000376e0', '2026-10-31T15:00:00Z'),
  ('00000000-0000-0000-0000-0000000376a6', '00000000-0000-0000-0000-0000000376b4', 'contract', 'signed', 'paper', '2026-10-30T12:00:00Z', 'D. Dalton', '376/paper.pdf', '00000000-0000-0000-0000-0000000376e0', '2026-10-31T15:00:01Z'),
  ('00000000-0000-0000-0000-0000000376a7', '00000000-0000-0000-0000-0000000376b5', 'contract', 'signed', 'paper', '2026-10-30T12:00:00Z', 'D. Dalton', '376/paper.pdf', '00000000-0000-0000-0000-0000000376e0', '2026-10-31T15:00:02Z');
INSERT INTO public.job_contracts (id, job_id, kind, status, template_name, signer_mode, signed_at, signer_printed_name, created_at) VALUES
  ('00000000-0000-0000-0000-0000000376a8', '00000000-0000-0000-0000-0000000376b1', 'warranty', 'signed', 'One-year workmanship warranty', 'type', '2026-11-14T04:30:00Z', 'Harlan Pierce', '2026-11-12T15:00:00Z');

-- People and their papers. e1 sent and opened, e2 signed and since replaced by e3, e4 a partner's, e5 a W-9 and e6 an
-- unsent agreement, which are no lines of the list.
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  ('00000000-0000-0000-0000-000000037601', '00000000-0000-0000-0000-0000000376d2', 'helper', 'Marcus Hale', NULL),
  ('00000000-0000-0000-0000-000000037602', '00000000-0000-0000-0000-0000000376d2', 'sub', 'Ortega Mechanical', '00000000-0000-0000-0000-0000000376d8'),
  ('00000000-0000-0000-0000-000000037603', '00000000-0000-0000-0000-0000000376d2', 'sub', 'Bryce Tolland', NULL),
  ('00000000-0000-0000-0000-000000037604', '00000000-0000-0000-0000-0000000376d2', 'sub', 'Tall Pine Excavating', NULL),
  ('00000000-0000-0000-0000-000000037605', '00000000-0000-0000-0000-0000000376d2', 'sub', 'Granite Core Drilling', NULL);
INSERT INTO public.partnerships (id, person_id) VALUES ('00000000-0000-0000-0000-000000037609', '00000000-0000-0000-0000-000000037603');
INSERT INTO public.person_contract_documents (id, person_name, person_id, document_name, contract_lineage_id, lineage_version, status, doc_type, sent_at, signer_last_viewed_at, signed_at, partnership_id, supersedes_person_contract_document_id) VALUES
  ('00000000-0000-0000-0000-0000003760e1', 'Marcus Hale', '00000000-0000-0000-0000-000000037601', 'Tool and vehicle use agreement', gen_random_uuid(), 1, 'sent', 'agreement', '2026-11-12T15:00:00Z', '2026-11-13T15:00:00Z', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-0000003760e2', 'Ortega Mechanical', '00000000-0000-0000-0000-000000037602', 'Master subcontract', '00000000-0000-0000-0000-0000003760ee', 1, 'signed', 'agreement', '2026-03-01T15:00:00Z', NULL, '2026-03-02', NULL, NULL),
  ('00000000-0000-0000-0000-0000003760e3', 'Ortega Mechanical', '00000000-0000-0000-0000-000000037602', 'Master subcontract', '00000000-0000-0000-0000-0000003760ee', 2, 'signed', 'agreement', '2026-11-05T15:00:00Z', NULL, '2026-11-06', NULL, '00000000-0000-0000-0000-0000003760e2'),
  ('00000000-0000-0000-0000-0000003760e4', 'Bryce Tolland', '00000000-0000-0000-0000-000000037603', 'Referral partner agreement', gen_random_uuid(), 1, 'signed', 'agreement', '2026-10-27T15:00:00Z', NULL, '2026-10-28', '00000000-0000-0000-0000-000000037609', NULL),
  ('00000000-0000-0000-0000-0000003760e5', 'Marcus Hale', '00000000-0000-0000-0000-000000037601', 'W-9', gen_random_uuid(), 1, 'signed', 'w9', NULL, NULL, '2026-10-01', NULL, NULL),
  ('00000000-0000-0000-0000-0000003760e6', 'Marcus Hale', '00000000-0000-0000-0000-000000037601', 'An agreement nobody sent', gen_random_uuid(), 1, 'unsent', 'agreement', NULL, NULL, NULL, NULL, NULL);

-- Work orders. f1 signed, f2 out with days left, f3 an offer that ran out long ago, f4 declined, f5 a draft, f6 cancelled.
INSERT INTO public.step_commitments (id, job_id, person_id, display_name, amount, status, record_id, offered_at, offer_expires_at, signed_at, declined_at, updated_at) VALUES
  ('00000000-0000-0000-0000-0000003760f1', '00000000-0000-0000-0000-0000000376b2', '00000000-0000-0000-0000-000000037602', 'Ortega Mechanical', 100, 'accepted', 'WO-2391-01', '2026-11-12T15:00:00Z', NULL, '2026-11-14T15:00:00Z', NULL, '2026-11-14T15:00:00Z'),
  ('00000000-0000-0000-0000-0000003760f2', '00000000-0000-0000-0000-0000000376b1', '00000000-0000-0000-0000-000000037604', 'Tall Pine Excavating', 100, 'offered', 'WO-2418-01', '2026-11-05T15:00:00Z', (now() AT TIME ZONE 'America/Chicago')::date + 5, NULL, NULL, '2026-11-05T15:00:00Z'),
  ('00000000-0000-0000-0000-0000003760f3', '00000000-0000-0000-0000-0000000376b1', '00000000-0000-0000-0000-000000037605', 'Granite Core Drilling', 100, 'offered', 'WO-2418-02', '2020-01-05T15:00:00Z', '2020-01-20', NULL, NULL, '2020-01-05T15:00:00Z'),
  ('00000000-0000-0000-0000-0000003760f4', '00000000-0000-0000-0000-0000000376b3', '00000000-0000-0000-0000-000000037605', 'Granite Core Drilling', 100, 'declined', 'WO-2377-01', '2026-10-05T15:00:00Z', NULL, NULL, '2026-10-09T15:00:00Z', '2026-10-09T15:00:00Z'),
  ('00000000-0000-0000-0000-0000003760f5', '00000000-0000-0000-0000-0000000376b4', '00000000-0000-0000-0000-000000037604', 'Tall Pine Excavating', NULL, 'draft', NULL, NULL, NULL, NULL, NULL, '2026-10-09T15:00:00Z'),
  ('00000000-0000-0000-0000-0000003760f6', '00000000-0000-0000-0000-0000000376b5', '00000000-0000-0000-0000-000000037604', 'Tall Pine Excavating', 100, 'cancelled', 'WO-2379-01', '2026-08-20T15:00:00Z', NULL, NULL, NULL, '2026-09-01T15:00:00Z');

-- GC mode. Westfield Clinic is a GC project: our contract went to its owner twice (the second send, a new price, is the
-- one they signed), Electrical's statement of work is out to Brightline Electric, Plumbing's is still a draft, and
-- Brightline signed our master agreement.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000000376c4', 'Westfield Clinic Partners', '00000000-0000-0000-0000-0000000376d2');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-00000376a0a0', 'Westfield Clinic', '00000000-0000-0000-0000-0000000376c4');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-00000376a0a0', 'building');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, budget, ours) VALUES
  ('00000000-0000-0000-0000-00000376a0b1', '00000000-0000-0000-0000-00000376a0a0', 'Electrical', 0, 100, false),
  ('00000000-0000-0000-0000-00000376a0b2', '00000000-0000-0000-0000-00000376a0a0', 'Plumbing', 1, 100, false);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-00000376a0c1', 'Brightline Electric', '{Electrical}'),
  ('00000000-0000-0000-0000-00000376a0c2', 'Draft Only Plumbing', '{Plumbing}');
INSERT INTO public.gc_invites (id, package_id, company_id, status) VALUES
  ('00000000-0000-0000-0000-00000376a0d1', '00000000-0000-0000-0000-00000376a0b1', '00000000-0000-0000-0000-00000376a0c1', 'bid'),
  ('00000000-0000-0000-0000-00000376a0d2', '00000000-0000-0000-0000-00000376a0b2', '00000000-0000-0000-0000-00000376a0c2', 'bid');
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-00000376a0e1', '00000000-0000-0000-0000-00000376a0b1', '00000000-0000-0000-0000-00000376a0d1', '00000000-0000-0000-0000-00000376a0c1', 'sent', 100, DATE '2026-09-24', NULL),
  ('00000000-0000-0000-0000-00000376a0e2', '00000000-0000-0000-0000-00000376a0b2', '00000000-0000-0000-0000-00000376a0d2', '00000000-0000-0000-0000-00000376a0c2', 'draft', 100, NULL, NULL);
INSERT INTO public.person_contract_documents (id, person_name, document_name, contract_lineage_id, lineage_version, status, doc_type, signed_at) VALUES
  ('00000000-0000-0000-0000-00000376a0f1', 'gc-company:00000000-0000-0000-0000-00000376a0c1', 'Master Services Agreement', gen_random_uuid(), 1, 'signed', 'agreement', '2026-09-18');
INSERT INTO public.gc_owner_contract_sends (id, project_id, customer_id, first, sent_on, sign_by, worth, file_path, file_name, file_sha256, signed_on, signer_printed_name, signer_consented_at, created_at) VALUES
  ('00000000-0000-0000-0000-00000376a071', '00000000-0000-0000-0000-00000376a0a0', '00000000-0000-0000-0000-0000000376c4', true, DATE '2026-09-20', DATE '2026-09-27', '{"gc": 100}'::jsonb, '376/contract-1.pdf', 'contract-1.pdf', repeat('ab', 32), NULL, NULL, NULL, '2026-09-20T15:00:00Z'),
  ('00000000-0000-0000-0000-00000376a072', '00000000-0000-0000-0000-00000376a0a0', '00000000-0000-0000-0000-0000000376c4', false, DATE '2026-09-25', DATE '2026-10-02', '{"gc": 200}'::jsonb, '376/contract-2.pdf', 'contract-2.pdf', repeat('ab', 32), DATE '2026-09-30', 'W. Clinic', '2026-09-30T15:00:00Z', '2026-09-25T15:00:00Z');

CREATE SCHEMA aof;
CREATE FUNCTION aof.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION aof.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The list as the page reads it, newest first: kind, state, name, party, job number, more jobs, person kind, day.
CREATE FUNCTION aof.list() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(concat_ws('|', a.kind, a.state, nullif(a.paper_name, ''), a.with_name, coalesce(a.job_hcp_number, '-'), a.more_jobs::text, coalesce(a.person_kind, '-'), a.at_day::text), E'\n' ORDER BY a.at DESC, a.id DESC), '')
  FROM public.agreements_on_file a
  WHERE a.kind NOT IN ('owner_contract', 'sow', 'company_agreement')
$$;
-- GC mode's lines, newest first: kind, state, name, party, project, day.
CREATE FUNCTION aof.gc_list() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(concat_ws('|', a.kind, a.state, coalesce(nullif(a.paper_name, ''), '-'), a.with_name, coalesce(a.job_name, '-'), a.at_day::text), E'\n' ORDER BY a.at DESC, a.id DESC), '')
  FROM public.agreements_on_file a
  WHERE a.kind IN ('owner_contract', 'sow', 'company_agreement')
$$;
CREATE FUNCTION aof.kinds() RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(x.kind || ' ' || x.n::text, ', ' ORDER BY x.kind), 'none')
  FROM (SELECT kind, count(*) AS n FROM public.agreements_on_file GROUP BY kind) x
$$;
GRANT USAGE ON SCHEMA aof TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA aof TO authenticated, anon;

-- 1 · The view runs as its reader.
SELECT aof.same('the view is security_invoker', (SELECT reloptions::text FROM pg_class WHERE oid = 'public.agreements_on_file'::regclass), '{security_invoker=true}');

-- 2 · The office reads every agreement, newest first.
SELECT aof.as_user('00000000-0000-0000-0000-0000000376d3');
SET LOCAL ROLE authenticated;
SELECT aof.same('the assistant reads the whole list of the first six kinds', aof.list(), concat_ws(E'\n',
  'job_contract|waiting|Residential plumbing contract|Harlan Pierce|2418|0|-|2026-11-16',
  'work_order|signed|WO-2391-01|Ortega Mechanical|2391|0|-|2026-11-14',
  'job_warranty|signed|One-year workmanship warranty|Harlan Pierce|2418|0|-|2026-11-13',
  'person_agreement|waiting|Tool and vehicle use agreement|Marcus Hale|-|0|helper|2026-11-12',
  'their_paper|signed|Subcontract Agreement, Ridgeway form|Ridgeway Builders|2391|0|-|2026-11-10',
  'person_agreement|signed|Master subcontract|Ortega Mechanical|-|0|sub|2026-11-06',
  'work_order|waiting|WO-2418-01|Tall Pine Excavating|2418|0|-|2026-11-05',
  'job_contract|signed|Dalton Property Group|2377|2|-|2026-10-30',
  'partner_agreement|signed|Referral partner agreement|Bryce Tolland|-|0|sub|2026-10-28',
  'job_contract|ended|Residential plumbing contract|Harlan Pierce|2418|0|-|2026-10-15',
  'work_order|ended|WO-2377-01|Granite Core Drilling|2377|0|-|2026-10-09',
  'work_order|ended|WO-2379-01|Tall Pine Excavating|2379|0|-|2026-09-01',
  'person_agreement|ended|Master subcontract|Ortega Mechanical|-|0|sub|2026-03-02',
  'work_order|ended|WO-2418-02|Granite Core Drilling|2418|0|-|2020-01-20'));

-- 3 · Drafts, an unsent paper and a W-9 are no lines.
SELECT aof.same('a draft contract, a draft work order, an unsent paper and a W-9 are absent',
  (SELECT count(*)::text FROM public.agreements_on_file WHERE source_id IN (
    '00000000-0000-0000-0000-0000000376a3', '00000000-0000-0000-0000-0000003760f5', '00000000-0000-0000-0000-0000003760e6', '00000000-0000-0000-0000-0000003760e5')), '0');

-- 4 · One paper over three jobs is one line, named by the first job filed, and a covered job's number still finds it.
SELECT aof.same('the paper over three jobs is one line on the first job',
  (SELECT string_agg(source_id::text || ' ' || more_jobs::text, ', ') FROM public.agreements_on_file WHERE kind = 'job_contract' AND state = 'signed'),
  '00000000-0000-0000-0000-0000000376a5 2');
SELECT aof.same('the find box reaches a covered job by its number', (SELECT string_agg(kind, ',' ORDER BY kind) FROM public.agreements_on_file WHERE find_text ILIKE '%j2378%'), 'job_contract');
SELECT aof.same('the find box reaches a job by its name', (SELECT string_agg(kind, ',' ORDER BY kind) FROM public.agreements_on_file WHERE find_text ILIKE '%cedar%'), 'their_paper,work_order');
SELECT aof.same('the find box reaches a person', (SELECT string_agg(kind, ',' ORDER BY kind) FROM public.agreements_on_file WHERE find_text ILIKE '%ortega%'), 'person_agreement,person_agreement,work_order');
SELECT aof.same('two words narrow together', (SELECT string_agg(kind, ',' ORDER BY kind) FROM public.agreements_on_file WHERE find_text ILIKE '%ortega%' AND find_text ILIKE '%wo-2391%'), 'work_order');
SELECT aof.same('find_text is lower case', (SELECT bool_and(find_text = lower(find_text))::text FROM public.agreements_on_file), 'true');

-- 5 · The facts carry each kind's own columns, without the empty ones, and no amount.
SELECT aof.same('a sent contract counts its sends and opens', (SELECT concat_ws('|', facts->>'status', facts->>'send_count', facts->>'view_count', facts->>'sent_channel', (facts ? 'voided_at')::text) FROM public.agreements_on_file WHERE source_id = '00000000-0000-0000-0000-0000000376a1'), 'sent|2|3|link|false');
SELECT aof.same('a filed paper says it has a scan', (SELECT concat_ws('|', facts->>'signer_mode', facts->>'has_upload') FROM public.agreements_on_file WHERE source_id = '00000000-0000-0000-0000-0000000376a5'), 'paper|true');
SELECT aof.same('their paper says who signed for us and what they relied on', (SELECT concat_ws('|', facts->>'our_signer_name', facts->>'our_signed_on', facts->>'relied_on_what', (facts ? 'their_signed_on')::text) FROM public.agreements_on_file WHERE source_id = '00000000-0000-0000-0000-0000000376a4'), 'Dana Whitlock|2026-11-10|their notice to proceed|false');
SELECT aof.same('a replaced agreement says so, and the one that replaced it does not', (SELECT string_agg(coalesce(facts->>'replaced', 'no'), ',' ORDER BY at) FROM public.agreements_on_file WHERE paper_name = 'Master subcontract'), 'true,no');
SELECT aof.same('an opened paper carries when', (SELECT (facts ? 'signer_last_viewed_at')::text FROM public.agreements_on_file WHERE source_id = '00000000-0000-0000-0000-0000003760e1'), 'true');
SELECT aof.same('a work order carries its offer', (SELECT concat_ws('|', facts->>'status', (facts ? 'offer_expires_at')::text, (facts ? 'offered_at')::text) FROM public.agreements_on_file WHERE source_id = '00000000-0000-0000-0000-0000003760f3'), 'offered|true|true');
SELECT aof.same('no row carries an amount', (SELECT bool_or(facts ? 'amount' OR facts ? 'revenue' OR facts ? 'price')::text FROM public.agreements_on_file), 'false');

SELECT aof.same('the assistant reads a trade company''s agreement and none of GC mode''s money papers', aof.kinds(), 'company_agreement 1, job_contract 3, job_warranty 1, partner_agreement 1, person_agreement 3, their_paper 1, work_order 5');

-- 6 · The chips ask by state: an offer that ran out is ended, one with days left waits.
SELECT aof.same('three wait on a signature', (SELECT string_agg(source_id::text, ',' ORDER BY at DESC) FROM public.agreements_on_file WHERE state = 'waiting'),
  '00000000-0000-0000-0000-0000000376a1,00000000-0000-0000-0000-0000003760e1,00000000-0000-0000-0000-0000003760f2');
RESET ROLE;

-- 7 · Each role reads what its tables allow.
SELECT aof.as_user('00000000-0000-0000-0000-0000000376d1');
SET LOCAL ROLE authenticated;
SELECT aof.same('a dev reads every kind', aof.kinds(), 'company_agreement 1, job_contract 3, job_warranty 1, owner_contract 1, partner_agreement 1, person_agreement 3, sow 1, their_paper 1, work_order 5');
-- GC mode's three. The owner contract is one line, its newest send; a draft statement of work is no line; a company's
-- paper is named by the company, never by the name it is filed under.
SELECT aof.same('a dev reads GC mode''s three lines', aof.gc_list(), concat_ws(E'\n',
  'owner_contract|signed|-|Westfield Clinic Partners|Westfield Clinic|2026-09-30',
  'sow|waiting|Statement of work · Electrical|Brightline Electric|Westfield Clinic|2026-09-24',
  'company_agreement|signed|Master Services Agreement|Brightline Electric|-|2026-09-18'));
SELECT aof.same('the owner contract''s line is its newest send', (SELECT string_agg(source_id::text, ',') FROM public.agreements_on_file WHERE kind = 'owner_contract'), '00000000-0000-0000-0000-00000376a072');
SELECT aof.same('a draft statement of work is absent', (SELECT count(*)::text FROM public.agreements_on_file WHERE source_id = '00000000-0000-0000-0000-00000376a0e2'), '0');
SELECT aof.same('the find box reaches a GC project by its name', (SELECT string_agg(kind, ',' ORDER BY kind) FROM public.agreements_on_file WHERE find_text ILIKE '%westfield%'), 'owner_contract,sow');
SELECT aof.same('the find box reaches a trade company', (SELECT string_agg(kind, ',' ORDER BY kind) FROM public.agreements_on_file WHERE find_text ILIKE '%brightline%'), 'company_agreement,sow');
SELECT aof.same('the name a company''s paper is filed under is never shown or searched', (SELECT bool_or(find_text LIKE '%gc-company%' OR with_name LIKE 'gc-company%')::text FROM public.agreements_on_file), 'false');
SELECT aof.same('GC mode''s facts carry dates and no price', (SELECT string_agg(kind || ' ' || (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(facts) k), ' | ' ORDER BY kind) FROM public.agreements_on_file WHERE kind IN ('owner_contract', 'sow')), 'owner_contract sent_on,sign_by,signed_on | sow sent_on,status');
RESET ROLE;
SELECT aof.as_user('00000000-0000-0000-0000-0000000376d2');
SET LOCAL ROLE authenticated;
SELECT aof.same('the owner reads every kind but the owner contract, a dev''s', aof.kinds(), 'company_agreement 1, job_contract 3, job_warranty 1, partner_agreement 1, person_agreement 3, sow 1, their_paper 1, work_order 5');
RESET ROLE;
SELECT aof.as_user('00000000-0000-0000-0000-0000000376d4');
SET LOCAL ROLE authenticated;
SELECT aof.same('the controller reads what the owner reads', aof.kinds(), 'company_agreement 1, job_contract 3, job_warranty 1, partner_agreement 1, person_agreement 3, sow 1, their_paper 1, work_order 5');
RESET ROLE;

SELECT aof.as_user('00000000-0000-0000-0000-0000000376d5');
SET LOCAL ROLE authenticated;
SELECT aof.same('an estimator reads work orders and nothing else', aof.kinds(), 'work_order 5');
RESET ROLE;

SELECT aof.as_user('00000000-0000-0000-0000-0000000376d6');
SET LOCAL ROLE authenticated;
SELECT aof.same('a primary reads no agreement', aof.kinds(), 'none');
RESET ROLE;
SELECT aof.as_user('00000000-0000-0000-0000-0000000376d7');
SET LOCAL ROLE authenticated;
SELECT aof.same('a superintendent on none of the jobs reads no agreement', aof.kinds(), 'none');
RESET ROLE;

SELECT aof.as_user('00000000-0000-0000-0000-0000000376d8');
SET LOCAL ROLE authenticated;
-- The sub is on no crew, so the job's own row is closed to them: the left join keeps the work order and leaves the job blank.
SELECT aof.same('a sub reads their own work order, without the job they cannot read, and no paper of anyone', aof.list(), 'work_order|signed|WO-2391-01|Ortega Mechanical|-|0|-|2026-11-14');
RESET ROLE;

-- Not signed in: refused outright, or no row at all, whichever the grants of the day give.
SET LOCAL ROLE anon;
DO $$
DECLARE n bigint;
BEGIN
  BEGIN
    SELECT count(*) INTO n FROM public.agreements_on_file;
  EXCEPTION WHEN insufficient_privilege THEN
    n := 0;
  END;
  IF n <> 0 THEN RAISE EXCEPTION 'a caller who is not signed in read % agreement(s)', n; END IF;
  RAISE NOTICE 'ok: a caller who is not signed in reads no agreement';
END $$;
RESET ROLE;

-- Papers before a job opens (migration *_agreements_job_papers): a person's copy of a paper a job requires is a line
-- with its job and the paper's own name, whatever its form's kind, and the find box finds it by the job.
INSERT INTO public.job_required_papers (id, job_id, paper_name, body_html, required_at) VALUES
  ('00000000-0000-0000-0000-0000003760f1', '00000000-0000-0000-0000-0000000376b2', 'Site rules and photo policy', '<p>No photos past the gate.</p>', '2026-11-14T15:00:00Z'),
  ('00000000-0000-0000-0000-0000003760f2', '00000000-0000-0000-0000-0000000376b2', 'Ridgeway Builders NDA', '<p>Keep it quiet.</p>', '2026-11-14T15:00:01Z');
-- Marcus signed the site rules, filed as a form of the kind 'other'; Ortega opened the NDA and has not signed it.
INSERT INTO public.person_contract_documents (id, person_name, person_id, document_name, contract_lineage_id, lineage_version, status, doc_type, sent_at, signed_at, job_id, job_required_paper_id) VALUES
  ('00000000-0000-0000-0000-0000003760e8', 'Marcus Hale', '00000000-0000-0000-0000-000000037601', 'Site rules and photo policy (job 2391)', gen_random_uuid(), 1, 'signed', 'other', '2026-11-15T15:00:00Z', '2026-11-15', '00000000-0000-0000-0000-0000000376b2', '00000000-0000-0000-0000-0000003760f1'),
  ('00000000-0000-0000-0000-0000003760e9', 'Ortega Mechanical', '00000000-0000-0000-0000-000000037602', 'Ridgeway Builders NDA (job 2391)', gen_random_uuid(), 1, 'sent', 'agreement', '2026-11-16T15:00:00Z', NULL, '00000000-0000-0000-0000-0000000376b2', '00000000-0000-0000-0000-0000003760f2');
SELECT aof.as_user('00000000-0000-0000-0000-0000000376d3');
SET LOCAL ROLE authenticated;
SELECT aof.same('the office reads each job paper with its job and its own name',
  (SELECT string_agg(concat_ws('|', a.kind, a.state, a.paper_name, a.with_name, a.job_hcp_number, a.job_name, a.job_address, a.person_kind, a.at_day::text), E'\n' ORDER BY a.at DESC, a.id DESC)
   FROM public.agreements_on_file a WHERE a.source_id IN ('00000000-0000-0000-0000-0000003760e8', '00000000-0000-0000-0000-0000003760e9')),
  'person_agreement|waiting|Ridgeway Builders NDA|Ortega Mechanical|2391|Cedar Bluff Lofts|1200 Quarry Rd|sub|2026-11-16' || E'\n' ||
  'person_agreement|signed|Site rules and photo policy|Marcus Hale|2391|Cedar Bluff Lofts|1200 Quarry Rd|helper|2026-11-15');
SELECT aof.same('the line carries the job''s id', (SELECT (a.job_id = '00000000-0000-0000-0000-0000000376b2')::text FROM public.agreements_on_file a WHERE a.source_id = '00000000-0000-0000-0000-0000003760e8'), 'true');
SELECT aof.same('the find box finds a job paper by the job''s number, name and the words job paper',
  (SELECT concat_ws('|', (position('j2391' IN a.find_text) > 0)::text, (position('cedar bluff lofts' IN a.find_text) > 0)::text, (position('job paper' IN a.find_text) > 0)::text) FROM public.agreements_on_file a WHERE a.source_id = '00000000-0000-0000-0000-0000003760e8'),
  'true|true|true');
SELECT aof.same('a person''s paper with no job still has none', (SELECT concat_ws('|', coalesce(a.job_id::text, '-'), coalesce(a.job_hcp_number, '-'), a.paper_name) FROM public.agreements_on_file a WHERE a.source_id = '00000000-0000-0000-0000-0000003760e1'), '-|-|Tool and vehicle use agreement');
RESET ROLE;
SELECT aof.as_user('00000000-0000-0000-0000-0000000376d6');
SET LOCAL ROLE authenticated;
SELECT aof.same('a primary still reads no person''s paper, a job paper included', (SELECT count(*)::text FROM public.agreements_on_file a WHERE a.kind = 'person_agreement'), '0');
RESET ROLE;
SELECT aof.as_user('00000000-0000-0000-0000-0000000376d8');
SET LOCAL ROLE authenticated;
SELECT aof.same('the sub reads no job paper, not even their own', (SELECT count(*)::text FROM public.agreements_on_file a WHERE a.kind = 'person_agreement'), '0');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'agreements_on_file PASSED'; END $$;
ROLLBACK;
