-- A trade partner company's own papers from its portal (P5b-m, the Portal lane): the files ledger takes a certificate
-- on no job, and the three verbs the service role calls with the link's company first: gc_trade_coi files a
-- certificate from the company's own upload, gc_trade_vetting_form writes the form of a company new to us, and
-- gc_trade_paper_open opens a master agreement the office sent or a W-9 (copied once from the Contract Book's W-9
-- form) to sign. The fixture is made as postgres; the verbs run as the service role; everything rolls back. Raises on
-- the first failed assertion; ends with "gc_portal_p5b PASSED". See scripts/pgtest-gc-portal-p5b.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-00000000fbd1', 'dev@p5b.test');
INSERT INTO public.users (id, email, name, role) VALUES ('00000000-0000-0000-0000-00000000fbd1', 'dev@p5b.test', 'P5b Dev', 'dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- The Contract Book: the Subs packet's master agreement and W-9, and a staff W-9 that comes first in its own packet,
-- which a trade's W-9 must never copy.
INSERT INTO public.contract_templates (id, name) VALUES
  ('00000000-0000-0000-0000-00000000fba1', 'P5b bed Subs'),
  ('00000000-0000-0000-0000-00000000fba2', 'P5b bed Staff');
INSERT INTO public.contract_form_templates (id, name, pdf_storage_path, status, doc_type, published_at) VALUES
  ('00000000-0000-0000-0000-00000000fbf1', 'P5b bed W-9', 'bed/w9.pdf', 'published', 'w9', now());
INSERT INTO public.contract_template_documents (id, template_id, document_name, book_body_html, book_body_format, canonical_document_url, audience, sequence_order) VALUES
  ('00000000-0000-0000-0000-00000000fbb1', '00000000-0000-0000-0000-00000000fba1', 'Master Subcontract Agreement', '<p>Terms.</p>', 'html', 'https://example.test/msa.pdf', 'sub', 1);
INSERT INTO public.contract_template_documents (id, template_id, document_name, form_template_id, audience, sequence_order) VALUES
  ('00000000-0000-0000-0000-00000000fbb0', '00000000-0000-0000-0000-00000000fba2', 'W-9 for staff', '00000000-0000-0000-0000-00000000fbf1', 'staff', 0),
  ('00000000-0000-0000-0000-00000000fbb2', '00000000-0000-0000-0000-00000000fba1', 'W-9', '00000000-0000-0000-0000-00000000fbf1', 'sub', 2);

-- Bright Line is new to us, Level Line is known (no vetting status), Dim Line was declined. A building project for the
-- ledger's CHECKs.
INSERT INTO public.gc_companies (id, name, trades, vetting_status) VALUES
  ('00000000-0000-0000-0000-00000000fb11', 'P5b Bright Line', '{Electrical}', 'new'),
  ('00000000-0000-0000-0000-00000000fb12', 'P5b Level Line', '{Electrical}', NULL),
  ('00000000-0000-0000-0000-00000000fb13', 'P5b Dim Line', '{Electrical}', 'declined');
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-00000000fbc1', 'P5b Test Owner', '00000000-0000-0000-0000-00000000fbd1');
INSERT INTO public.projects (id, name, customer_id) VALUES ('00000000-0000-0000-0000-00000000fba9', 'P5b test clinic', '00000000-0000-0000-0000-00000000fbc1');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-00000000fba9', 'building');

-- Bright Line's master agreement, sent by the office with a token of its own; Level Line's, signed; Dim Line's, a copy
-- the office made and never sent.
INSERT INTO public.person_contract_documents (id, person_name, company_id, document_name, doc_type, status, sent_at, contract_lineage_id, lineage_version, public_token_hash, public_token_expires_at) VALUES
  ('00000000-0000-0000-0000-00000000fb61', 'gc-company:00000000-0000-0000-0000-00000000fb11', '00000000-0000-0000-0000-00000000fb11', 'Master Subcontract Agreement', 'agreement', 'sent', TIMESTAMPTZ '2026-10-08 15:00+00', gen_random_uuid(), 1, repeat('0', 64), now() + interval '10 days'),
  ('00000000-0000-0000-0000-00000000fb62', 'gc-company:00000000-0000-0000-0000-00000000fb12', '00000000-0000-0000-0000-00000000fb12', 'Master Subcontract Agreement', 'agreement', 'signed', TIMESTAMPTZ '2026-10-01 15:00+00', gen_random_uuid(), 1, NULL, NULL),
  ('00000000-0000-0000-0000-00000000fb63', 'gc-company:00000000-0000-0000-0000-00000000fb13', '00000000-0000-0000-0000-00000000fb13', 'Master Subcontract Agreement', 'agreement', 'unsent', NULL, gen_random_uuid(), 1, NULL, NULL);

-- Bright Line owes its insurance certificate and its W-9.
INSERT INTO public.gc_trade_promises (company_id, kind, what, due_on, source) VALUES
  ('00000000-0000-0000-0000-00000000fb11', 'insurance', 'their insurance certificate', public.app_today() + 7, 'office'),
  ('00000000-0000-0000-0000-00000000fb11', 'w9', 'their W-9', public.app_today() + 7, 'office');

-- Certificates uploaded from the portal, on no job (as P5b-2's kind file writes them): two of Bright Line's, one
-- already filed; and Level Line's.
INSERT INTO public.gc_trade_files (id, company_id, project_id, package_id, purpose, record_id, name, mime, bytes, drive_file_id, drive_url) VALUES
  ('00000000-0000-0000-0000-00000000fb51', '00000000-0000-0000-0000-00000000fb11', NULL, NULL, 'coi', NULL, 'certificate.pdf', 'application/pdf', 204800, 'drv-coi', 'https://drive.google.com/file/d/drv-coi/view'),
  ('00000000-0000-0000-0000-00000000fb52', '00000000-0000-0000-0000-00000000fb11', NULL, NULL, 'coi', '00000000-0000-0000-0000-00000000fbee', 'old.pdf', 'application/pdf', 1000, 'drv-old', 'https://drive.google.com/file/d/drv-old/view'),
  ('00000000-0000-0000-0000-00000000fb53', '00000000-0000-0000-0000-00000000fb12', NULL, NULL, 'coi', NULL, 'theirs.pdf', 'application/pdf', 1000, 'drv-theirs', 'https://drive.google.com/file/d/drv-theirs/view');

CREATE SCHEMA p5b;
CREATE FUNCTION p5b.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A verb refused with exactly this key and these words; its writes go with the refusal (a subtransaction).
CREATE FUNCTION p5b.refused(label text, stmt text, want_key text, want_words text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_state text;
  v_words text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_words = PG_EXCEPTION_DETAIL;
    IF v_state IS DISTINCT FROM 'P0001' OR SQLERRM IS DISTINCT FROM want_key OR v_words IS DISTINCT FROM want_words THEN
      RAISE EXCEPTION E'% was refused another way.\n--- got ---\n% % / %\n--- want ---\nP0001 % / %', label, v_state, SQLERRM, v_words, want_key, want_words;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- A statement the database itself refuses, by its SQLSTATE.
CREATE FUNCTION p5b.refused_code(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE IS DISTINCT FROM want THEN RAISE EXCEPTION '% was refused as % (%), not %', label, SQLSTATE, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
GRANT USAGE ON SCHEMA p5b TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA p5b TO service_role;

-- 1. The three verbs are the service role's alone.
SELECT p5b.same('the three verbs are the service role''s alone',
  (SELECT string_agg(f || ':' || has_function_privilege('anon', f, 'EXECUTE') || '/' || has_function_privilege('authenticated', f, 'EXECUTE') || '/' || has_function_privilege('service_role', f, 'EXECUTE'), ',') FROM unnest(ARRAY[
    'public.gc_trade_coi(uuid, date, text)', 'public.gc_trade_vetting_form(uuid, text, text, integer, text, text)',
    'public.gc_trade_paper_open(uuid, text, text, timestamptz)']) f),
  'public.gc_trade_coi(uuid, date, text):false/false/true,public.gc_trade_vetting_form(uuid, text, text, integer, text, text):false/false/true,public.gc_trade_paper_open(uuid, text, text, timestamptz):false/false/true');

-- 2. The files ledger: a certificate is on no job, and every other file is on one.
SELECT p5b.same('a certificate with no project is kept', (SELECT count(*)::text FROM public.gc_trade_files WHERE purpose = 'coi' AND project_id IS NULL), '3');
SELECT p5b.refused_code('a certificate on a job',
  $$INSERT INTO public.gc_trade_files (company_id, project_id, purpose, name, mime, bytes, drive_file_id, drive_url) VALUES ('00000000-0000-0000-0000-00000000fb11', '00000000-0000-0000-0000-00000000fba9', 'coi', 'c.pdf', 'application/pdf', 10, 'x', 'https://x')$$, '23514');
SELECT p5b.refused_code('a quote''s file on no job',
  $$INSERT INTO public.gc_trade_files (company_id, project_id, purpose, name, mime, bytes, drive_file_id, drive_url) VALUES ('00000000-0000-0000-0000-00000000fb11', NULL, 'quote', 'q.pdf', 'application/pdf', 10, 'x', 'https://x')$$, '23514');
SELECT p5b.refused_code('a purpose the ledger does not know',
  $$INSERT INTO public.gc_trade_files (company_id, project_id, purpose, name, mime, bytes, drive_file_id, drive_url) VALUES ('00000000-0000-0000-0000-00000000fb11', NULL, 'w9', 'w.pdf', 'application/pdf', 10, 'x', 'https://x')$$, '23514');
SELECT p5b.same('the ledger''s two CHECKs are validated',
  (SELECT string_agg(conname || ':' || convalidated, ',' ORDER BY conname) FROM pg_constraint WHERE conrelid = 'public.gc_trade_files'::regclass AND conname IN ('gc_trade_files_purpose_known', 'gc_trade_files_job_or_company')),
  'gc_trade_files_job_or_company:true,gc_trade_files_purpose_known:true');

SET LOCAL ROLE service_role;

-- 3. gc_trade_coi: its refusals in order, then Bright Line's certificate filed from its own upload.
SELECT p5b.refused('a link that is not https, first',
  $$SELECT public.gc_trade_coi('00000000-0000-0000-0000-00000000fb99', NULL, 'http://drive.google.com/x')$$,
  'badRequest', 'A file''s link is an https link.');
SELECT p5b.refused('a company that is not there',
  $$SELECT public.gc_trade_coi('00000000-0000-0000-0000-00000000fb99', public.app_today() + 365, 'https://drive.google.com/file/d/drv-coi/view')$$,
  'notFound', 'No company with that id.');
SELECT p5b.refused('no day',
  $$SELECT public.gc_trade_coi('00000000-0000-0000-0000-00000000fb11', NULL, 'https://drive.google.com/file/d/drv-coi/view')$$,
  'coiDayNeeded', 'Say the day the policy runs out.');
SELECT p5b.refused('a certificate that runs out today',
  $$SELECT public.gc_trade_coi('00000000-0000-0000-0000-00000000fb11', public.app_today(), 'https://drive.google.com/file/d/drv-coi/view')$$,
  'coiPast', 'The day the policy runs out has passed.');
SELECT p5b.refused('a day more than three years out',
  $$SELECT public.gc_trade_coi('00000000-0000-0000-0000-00000000fb11', public.app_today() + 1097, 'https://drive.google.com/file/d/drv-coi/view')$$,
  'coiTooFar', 'The day the policy runs out is more than three years away.');
SELECT p5b.refused('no link',
  $$SELECT public.gc_trade_coi('00000000-0000-0000-0000-00000000fb11', public.app_today() + 365, NULL)$$,
  'certNeeded', 'A certificate is a file the company uploaded from its portal.');
SELECT p5b.refused('a typed link',
  $$SELECT public.gc_trade_coi('00000000-0000-0000-0000-00000000fb11', public.app_today() + 365, 'https://example.test/coi.pdf')$$,
  'certNeeded', 'A certificate is a file the company uploaded from its portal.');
SELECT p5b.refused('another company''s upload',
  $$SELECT public.gc_trade_coi('00000000-0000-0000-0000-00000000fb11', public.app_today() + 365, 'https://drive.google.com/file/d/drv-theirs/view')$$,
  'certNeeded', 'A certificate is a file the company uploaded from its portal.');
SELECT p5b.refused('an upload already filed',
  $$SELECT public.gc_trade_coi('00000000-0000-0000-0000-00000000fb11', public.app_today() + 365, 'https://drive.google.com/file/d/drv-old/view')$$,
  'certNeeded', 'A certificate is a file the company uploaded from its portal.');
SELECT p5b.same('no refusal wrote a paper', (SELECT count(*)::text FROM public.person_contract_documents WHERE doc_type = 'coi'), '0');

-- Each verb runs in its own statement, its id kept with \gset: a statement cannot see the rows its own call wrote.
SELECT public.gc_trade_coi('00000000-0000-0000-0000-00000000fb11', public.app_today() + 365, ' https://drive.google.com/file/d/drv-coi/view ') AS coi_id \gset
SELECT p5b.same('the certificate is a signed coi paper of the company''s, with its day and link',
  (SELECT concat_ws(' | ', person_name, document_name, doc_type, status, (signed_at = public.app_today())::text, (expires_at = public.app_today() + 365)::text, url, coalesce(person_id::text, 'no person'))
   FROM public.person_contract_documents WHERE id = :'coi_id'),
  'gc-company:00000000-0000-0000-0000-00000000fb11 | COI (from their portal) | coi | signed | true | true | https://drive.google.com/file/d/drv-coi/view | no person');
SELECT p5b.same('the upload is tied to the paper, and no other file is',
  ((SELECT record_id FROM public.gc_trade_files WHERE id = '00000000-0000-0000-0000-00000000fb51') = :'coi_id')::text || ' | ' ||
  ((SELECT record_id FROM public.gc_trade_files WHERE id = '00000000-0000-0000-0000-00000000fb53') IS NULL)::text,
  'true | true');
SELECT p5b.same('the insurance promise is kept, the W-9''s is not',
  (SELECT string_agg(kind || ' ' || (kept_on IS NOT NULL), ',' ORDER BY kind) FROM public.gc_trade_promises WHERE company_id = '00000000-0000-0000-0000-00000000fb11'),
  'insurance true,w9 false');
SELECT p5b.refused('the same upload twice',
  $$SELECT public.gc_trade_coi('00000000-0000-0000-0000-00000000fb11', public.app_today() + 365, 'https://drive.google.com/file/d/drv-coi/view')$$,
  'certNeeded', 'A certificate is a file the company uploaded from its portal.');

-- 4. gc_trade_vetting_form: only a company still new, every line, then a second send replacing the first.
SELECT p5b.refused('a company that is not there',
  $$SELECT public.gc_trade_vetting_form('00000000-0000-0000-0000-00000000fb99', 'TECL 12345', 'Acme, $1M', 5, 'Ann 555-0101', 'Two clinics')$$,
  'notFound', 'No company with that id.');
SELECT p5b.refused('a company we know',
  $$SELECT public.gc_trade_vetting_form('00000000-0000-0000-0000-00000000fb12', 'TECL 12345', 'Acme, $1M', 5, 'Ann 555-0101', 'Two clinics')$$,
  'vetDecided', 'The office has decided on this company.');
SELECT p5b.refused('a company declined',
  $$SELECT public.gc_trade_vetting_form('00000000-0000-0000-0000-00000000fb13', 'TECL 12345', 'Acme, $1M', 5, 'Ann 555-0101', 'Two clinics')$$,
  'vetDecided', 'The office has decided on this company.');
SELECT p5b.refused('a blank line',
  $$SELECT public.gc_trade_vetting_form('00000000-0000-0000-0000-00000000fb11', '  ', 'Acme, $1M', 5, 'Ann 555-0101', 'Two clinics')$$,
  'formIncomplete', 'Every line of the form is needed.');
SELECT p5b.refused('no years',
  $$SELECT public.gc_trade_vetting_form('00000000-0000-0000-0000-00000000fb11', 'TECL 12345', 'Acme, $1M', NULL, 'Ann 555-0101', 'Two clinics')$$,
  'formIncomplete', 'Every line of the form is needed.');
SELECT p5b.refused('years below zero',
  $$SELECT public.gc_trade_vetting_form('00000000-0000-0000-0000-00000000fb11', 'TECL 12345', 'Acme, $1M', -1, 'Ann 555-0101', 'Two clinics')$$,
  'formIncomplete', 'Every line of the form is needed.');
SELECT p5b.refused('a line over 2,000 characters',
  $$SELECT public.gc_trade_vetting_form('00000000-0000-0000-0000-00000000fb11', 'TECL 12345', 'Acme, $1M', 5, 'Ann 555-0101', repeat('x', 2001))$$,
  'tooLong', 'A line is over 2,000 characters, or the years over 200.');
SELECT p5b.refused('years over 200',
  $$SELECT public.gc_trade_vetting_form('00000000-0000-0000-0000-00000000fb11', 'TECL 12345', 'Acme, $1M', 201, 'Ann 555-0101', 'Two clinics')$$,
  'tooLong', 'A line is over 2,000 characters, or the years over 200.');
SELECT p5b.same('no refusal wrote a form', (SELECT count(*)::text FROM public.gc_company_vetting_forms), '0');
SELECT p5b.same('Bright Line''s form is sent today',
  (SELECT (public.gc_trade_vetting_form('00000000-0000-0000-0000-00000000fb11', ' TECL 12345 ', 'Acme, $1M', 5, 'Ann 555-0101', 'Two clinics') = public.app_today())::text), 'true');
SELECT p5b.same('the form is kept trimmed',
  (SELECT concat_ws(' | ', license, insurance, years_in_business, reference_list, past_jobs, (sent_on = public.app_today())::text) FROM public.gc_company_vetting_forms WHERE company_id = '00000000-0000-0000-0000-00000000fb11'),
  'TECL 12345 | Acme, $1M | 5 | Ann 555-0101 | Two clinics | true');
SELECT public.gc_trade_vetting_form('00000000-0000-0000-0000-00000000fb11', 'TECL 99999', 'Acme, $2M', 6, 'Bo 555-0102', 'Three clinics') AS resent \gset
SELECT p5b.same('a second send replaces the first',
  (SELECT count(*) || ' | ' || min(license) || ' | ' || min(years_in_business) FROM public.gc_company_vetting_forms WHERE company_id = '00000000-0000-0000-0000-00000000fb11'),
  '1 | TECL 99999 | 6');
SELECT p5b.same('the office''s decision is untouched', (SELECT vetting_status FROM public.gc_companies WHERE id = '00000000-0000-0000-0000-00000000fb11'), 'new');

-- 5. gc_trade_paper_open: the master agreement the office sent, and a W-9 copied once from the Book.
SELECT p5b.refused('a paper that is not msa or w9',
  $$SELECT public.gc_trade_paper_open('00000000-0000-0000-0000-00000000fb11', 'coi', repeat('ab', 32), now() + interval '14 days')$$,
  'badRequest', 'A paper is msa or w9, with a token hash and a later expiry.');
SELECT p5b.refused('a hash that is not 64 hex',
  $$SELECT public.gc_trade_paper_open('00000000-0000-0000-0000-00000000fb11', 'msa', 'xyz', now() + interval '14 days')$$,
  'badRequest', 'A paper is msa or w9, with a token hash and a later expiry.');
SELECT p5b.refused('an expiry gone by',
  $$SELECT public.gc_trade_paper_open('00000000-0000-0000-0000-00000000fb11', 'msa', repeat('ab', 32), now() - interval '1 minute')$$,
  'badRequest', 'A paper is msa or w9, with a token hash and a later expiry.');
SELECT p5b.refused('a company that is not there',
  $$SELECT public.gc_trade_paper_open('00000000-0000-0000-0000-00000000fb99', 'msa', repeat('ab', 32), now() + interval '14 days')$$,
  'notFound', 'No company with that id.');
SELECT p5b.refused('a master agreement the office made and never sent',
  $$SELECT public.gc_trade_paper_open('00000000-0000-0000-0000-00000000fb13', 'msa', repeat('ab', 32), now() + interval '14 days')$$,
  'msaNotSent', 'The office has not sent the master agreement.');
SELECT p5b.refused('a master agreement signed already',
  $$SELECT public.gc_trade_paper_open('00000000-0000-0000-0000-00000000fb12', 'msa', repeat('ab', 32), now() + interval '14 days')$$,
  'alreadySigned', 'The company has signed this paper.');

SELECT public.gc_trade_paper_open('00000000-0000-0000-0000-00000000fb11', 'msa', repeat('ab', 32), now() + interval '14 days') AS msa_id \gset
SELECT p5b.same('the sent master agreement opens with the new token, the office''s day kept',
  (SELECT concat_ws(' | ', (id = '00000000-0000-0000-0000-00000000fb61')::text, status, (public_token_hash = repeat('ab', 32))::text, (public_token_expires_at > now() + interval '13 days')::text, (sent_at = TIMESTAMPTZ '2026-10-08 15:00+00')::text)
   FROM public.person_contract_documents WHERE id = :'msa_id'),
  'true | sent | true | true | true');

SELECT public.gc_trade_paper_open('00000000-0000-0000-0000-00000000fb11', 'w9', repeat('cd', 32), now() + interval '14 days') AS w9_id \gset
SELECT p5b.same('a W-9 with none is copied from the Subs packet''s W-9, stamped by the form trigger, and sent',
  (SELECT concat_ws(' | ', person_name, coalesce(person_id::text, 'no person'), document_name, doc_type, (form_template_id = '00000000-0000-0000-0000-00000000fbf1')::text,
     (applied_contract_template_document_id = '00000000-0000-0000-0000-00000000fbb2')::text, status, (sent_at IS NOT NULL)::text, (public_token_hash = repeat('cd', 32))::text)
   FROM public.person_contract_documents WHERE id = :'w9_id'),
  'gc-company:00000000-0000-0000-0000-00000000fb11 | no person | W-9 | w9 | true | true | sent | true | true');
SELECT public.gc_trade_paper_open('00000000-0000-0000-0000-00000000fb11', 'w9', repeat('ef', 32), now() + interval '14 days') AS w9_again \gset
SELECT p5b.same('a second press opens the same W-9 with the newest token',
  (:'w9_again' = :'w9_id')::text || ' | ' ||
  (SELECT count(*)::text FROM public.person_contract_documents WHERE company_id = '00000000-0000-0000-0000-00000000fb11' AND doc_type = 'w9') || ' | ' ||
  (SELECT (public_token_hash = repeat('ef', 32))::text FROM public.person_contract_documents WHERE id = :'w9_id'),
  'true | 1 | true');

RESET ROLE;
-- The company signs its W-9 (as accept-contract writes it): the W-9 promise is kept, and the W-9 opens no more.
UPDATE public.person_contract_documents SET status = 'signed', signed_at = public.app_today() WHERE id = :'w9_id';
SELECT p5b.same('the signed W-9 keeps its promise',
  (SELECT (kept_on IS NOT NULL)::text FROM public.gc_trade_promises WHERE company_id = '00000000-0000-0000-0000-00000000fb11' AND kind = 'w9'), 'true');
-- The Book with no W-9 for subs (only the staff one).
UPDATE public.contract_template_documents SET audience = 'staff' WHERE id = '00000000-0000-0000-0000-00000000fbb2';
SET LOCAL ROLE service_role;
SELECT p5b.refused('a W-9 signed already',
  $$SELECT public.gc_trade_paper_open('00000000-0000-0000-0000-00000000fb11', 'w9', repeat('ab', 32), now() + interval '14 days')$$,
  'alreadySigned', 'The company has signed this paper.');
SELECT p5b.refused('no W-9 form for subs in the Book',
  $$SELECT public.gc_trade_paper_open('00000000-0000-0000-0000-00000000fb12', 'w9', repeat('ab', 32), now() + interval '14 days')$$,
  'noW9Form', 'The Contract Book has no W-9 form for subs.');
SELECT p5b.same('no refusal copied a W-9', (SELECT count(*)::text FROM public.person_contract_documents WHERE company_id = '00000000-0000-0000-0000-00000000fb12' AND doc_type = 'w9'), '0');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_portal_p5b PASSED'; END $$;
ROLLBACK;
