-- The Portal's P5c-m: the two CHECKs it widens. gc_trade_messages takes the two closeout kinds and the punch kind beside
-- every kind it took before, esign_consents takes the trade's two record types beside every type it took before, an unknown one is still
-- refused, and both CHECKs are validated. The fixture is made as postgres; everything rolls back. Raises on the first
-- failed assertion; ends with "gc_portal_p5 PASSED". See scripts/pgtest-gc-portal-p5.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA gp5;
CREATE FUNCTION gp5.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION gp5.refused_code(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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

INSERT INTO public.gc_companies (id, name, trades) VALUES ('00000000-0000-0000-0000-0000000005c1', 'P5 Test Electric', '{Electrical}');

-- 0 · Both CHECKs are there and validated.
SELECT gp5.same('the message kind CHECK is validated', (
  SELECT convalidated::text FROM pg_constraint WHERE conname = 'gc_trade_messages_kind_known' AND conrelid = 'public.gc_trade_messages'::regclass), 'true');
SELECT gp5.same('the ledger record type CHECK is validated', (
  SELECT convalidated::text FROM pg_constraint WHERE conname = 'esign_consents_record_type_check' AND conrelid = 'public.esign_consents'::regclass), 'true');

-- 1 · Every kind a company's message took before, and the three new ones.
INSERT INTO public.gc_trade_messages (company_id, kind, mail_group, msg_key, subject, sent_on)
SELECT '00000000-0000-0000-0000-0000000005c1', k, 'pay', 'p5:' || k, 'P5 bed', DATE '2026-10-10'
FROM unnest(ARRAY['invite', 'nudge', 'plans', 'bidTab', 'msa', 'sow', 'start', 'less', 'change', 'paid', 'answer',
  'coi', 'closed', 'vetted', 'preBid', 'changeAsk', 'backCharge', 'dates', 'startSoon', 'paper', 'accepted', 'finalIn',
  'punch']) AS k;
SELECT gp5.same('a message of every known kind is kept, the three new ones among them', (
  SELECT count(*)::text || ' ' || count(*) FILTER (WHERE kind IN ('accepted', 'finalIn', 'punch'))::text
  FROM public.gc_trade_messages WHERE company_id = '00000000-0000-0000-0000-0000000005c1'), '23 3');
SELECT gp5.refused_code('a message of an unknown kind', $q$INSERT INTO public.gc_trade_messages (company_id, kind, mail_group, msg_key, subject, sent_on)
  VALUES ('00000000-0000-0000-0000-0000000005c1', 'warranty', 'job', 'p5:warranty', 'P5 bed', DATE '2026-10-10')$q$, '23514');
SELECT gp5.refused_code('its other CHECKs are as they were: an unknown group', $q$INSERT INTO public.gc_trade_messages (company_id, kind, mail_group, msg_key, subject, sent_on)
  VALUES ('00000000-0000-0000-0000-0000000005c1', 'accepted', 'money', 'p5:group', 'P5 bed', DATE '2026-10-10')$q$, '23514');

-- 2 · Every record type the ledger took before, and the trade's two.
INSERT INTO public.esign_consents (record_type, record_id, consent_version, lang, audience, document_noun, clause_text, printed_name, method)
SELECT t, gen_random_uuid(), 2, 'en', 'sub', 'this paper', 'I agree to sign electronically.', 'P5 Bed', 'type'
FROM unnest(ARRAY['estimate', 'job_contract', 'person_contract_document', 'step_commitment', 'bid_proposal_room',
  'lien_owner_record_request', 'gc_sow', 'gc_draw', 'gc_trade_change']) AS t;
SELECT gp5.same('a ledger row of every known record type is kept, the trade''s two among them', (
  SELECT count(*)::text || ' ' || count(*) FILTER (WHERE record_type IN ('gc_draw', 'gc_trade_change'))::text
  FROM public.esign_consents WHERE printed_name = 'P5 Bed'), '9 2');
SELECT gp5.refused_code('a ledger row of an unknown record type', $q$INSERT INTO public.esign_consents (record_type, record_id, consent_version, lang, audience, document_noun, clause_text)
  VALUES ('gc_punch', gen_random_uuid(), 2, 'en', 'sub', 'this paper', 'I agree to sign electronically.')$q$, '23514');

DO $$ BEGIN RAISE NOTICE 'gc_portal_p5 PASSED'; END $$;
ROLLBACK;
