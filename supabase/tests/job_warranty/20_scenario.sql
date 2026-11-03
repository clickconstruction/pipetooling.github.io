-- The warranty in place of a contract (migration *_job_warranty, the owner's call of 2026-11-02): a job_contracts row is
-- our contract or the warranty the office sends a homeowner instead, and the residential flow reads the warranty as an
-- aside step. The scenario, inside one transaction that rolls back: a row from before the column reads as a contract;
-- a kind the app does not know and initials that are not a list are refused; one live agreement per job holds across
-- the kinds; the job's feed says Warranty where it said Contract; warranty_signed sits after estimate_approved in the
-- facts and warranty after estimate in the papers, and a step may pick them; the residential flow has the Warranty step
-- aside at the end of its lane, with the loop, the paper and the reminder as seed.ts draws it; the migration once more
-- at the -- @rerun line (the bed script streams it in there, as a second push would) adds no second step and leaves an
-- office edit alone; and a flow seeded afresh has twelve steps. The fixture is made as postgres; everything rolls back.
-- Raises on the first failed assertion; ends with "job_warranty PASSED". See scripts/pgtest-job-warranty.sh. Never
-- against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA jwb;
CREATE FUNCTION jwb.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION jwb.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- The job's feed for one agreement, oldest first: event type and its words.
CREATE FUNCTION jwb.feed(p_contract uuid) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(e.event_type || ': ' || e.summary, ' | ' ORDER BY e.occurred_at, e.event_type)
  FROM public.job_activity_events e WHERE e.detail ->> 'contract_id' = p_contract::text
$$;
-- The residential Warranty step in one line, as the residential bed reads a step.
CREATE FUNCTION jwb.step(p_key text) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', s.position, s.phase, s.who, array_to_string(s.facts, ','), array_to_string(s.papers, ','),
    coalesce(s.loop_words, '-'), coalesce(s.loop_ends, '-'), s.aside, coalesce(s.nudge_days::text, '-'), coalesce(s.nudge_how, '-'),
    coalesce(s.nudge_send, '-'), s.usual, coalesce(s.later_en, '-'), s.name, s.name_es)
  FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = 'residential' AND s.step_key = p_key
$$;
CREATE FUNCTION jwb.steps() RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = 'residential'
$$;

-- The fixture: the office's master (a customer's master must be a master technician or a dev), a homeowner, her water
-- heater job and a second job.
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000e1', 'master@warranty.test');
INSERT INTO public.users (id, email, name, role) VALUES ('00000000-0000-0000-0000-0000000000e1', 'master@warranty.test', 'Bed Master', 'master_technician');
INSERT INTO public.customers (id, name, customer_type, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'Dana Whitfield', 'residential', '00000000-0000-0000-0000-0000000000e1');
INSERT INTO public.jobs_ledger (id, hcp_number, job_name, customer_name, customer_id, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-0000000b0001', '1312', 'Water heater', 'Dana Whitfield', '00000000-0000-0000-0000-0000000000d1', 'customer', 1850, 0, 'waiting'),
  ('00000000-0000-0000-0000-0000000b0002', '1313', 'Hose bib', 'Dana Whitfield', '00000000-0000-0000-0000-0000000000d1', 'customer', 400, 0, 'waiting');

-- 1 · The kind: a row from before the column is a contract; the app's two kinds and nothing else; initials are a list.
INSERT INTO public.job_contracts (id, job_id, status, template_name) VALUES
  ('00000000-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000b0002', 'draft', NULL);
SELECT jwb.same('a row from before the column reads as a contract',
  (SELECT kind || '|' || coalesce(initials::text, 'null') FROM public.job_contracts WHERE id = '00000000-0000-0000-0000-0000000c0001'), 'contract|null');
SELECT jwb.refused('a kind the app does not know',
  $q$INSERT INTO public.job_contracts (job_id, kind, status) VALUES ('00000000-0000-0000-0000-0000000b0001', 'lease', 'draft')$q$, 'job_contracts_kind_known');
SELECT jwb.refused('initials that are not a list',
  $q$INSERT INTO public.job_contracts (job_id, kind, status, initials) VALUES ('00000000-0000-0000-0000-0000000b0001', 'warranty', 'draft', '{"DW": true}'::jsonb)$q$, 'job_contracts_initials_list');

-- 2 · A warranty on the water heater job, sent and then signed: one live agreement per job across the kinds, and the
-- feed says Warranty.
INSERT INTO public.job_contracts (id, job_id, kind, status, template_name, recipient_email, sent_at, last_sent_at, send_count) VALUES
  ('00000000-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-0000000b0001', 'warranty', 'sent', NULL, 'dana@example.test', '2026-11-02T15:00:00Z', '2026-11-02T15:00:00Z', 1);
SELECT jwb.refused('a contract while the warranty is out: one live agreement per job',
  $q$INSERT INTO public.job_contracts (job_id, kind, status) VALUES ('00000000-0000-0000-0000-0000000b0001', 'contract', 'draft')$q$, 'job_contracts_one_live_per_job_idx');
UPDATE public.job_contracts SET first_viewed_at = '2026-11-02T16:00:00Z', view_count = 1 WHERE id = '00000000-0000-0000-0000-0000000c0002';
UPDATE public.job_contracts SET status = 'signed', signed_at = '2026-11-02T17:00:00Z', signer_printed_name = 'Dana Whitfield', signer_mode = 'type',
  signer_consented_at = '2026-11-02T17:00:00Z',
  initials = '[{"line": "The work listed above is the work I asked for at this address.", "initials": "DW"}]'::jsonb
  WHERE id = '00000000-0000-0000-0000-0000000c0002';
SELECT jwb.same('the feed says Warranty where it said Contract', jwb.feed('00000000-0000-0000-0000-0000000c0002'),
  'contract_sent: Warranty sent to dana@example.test — Warranty | contract_viewed: Warranty opened by the customer | contract_signed: Warranty signed by Dana Whitfield — Warranty');
SELECT jwb.same('the initials are kept as a list of lines', (SELECT jsonb_array_length(initials)::text || ' ' || (initials -> 0 ->> 'initials') FROM public.job_contracts WHERE id = '00000000-0000-0000-0000-0000000c0002'), '1 DW');
-- A contract's feed keeps its words.
UPDATE public.job_contracts SET status = 'sent', recipient_email = 'dana@example.test', sent_at = '2026-11-02T15:30:00Z', last_sent_at = '2026-11-02T15:30:00Z', send_count = 1
  WHERE id = '00000000-0000-0000-0000-0000000c0001';
SELECT jwb.same('a contract''s feed keeps its words', jwb.feed('00000000-0000-0000-0000-0000000c0001'), 'contract_sent: Contract sent to dana@example.test — Contract');

-- 3 · The facts and the papers a step picks from.
SELECT jwb.same('warranty_signed sits after estimate_approved',
  (SELECT array_to_string(x[array_position(x, 'estimate_approved'):array_position(x, 'estimate_approved') + 2], ',') FROM (SELECT public.flow_fact_ids() AS x) f),
  'estimate_approved,warranty_signed,working');
SELECT jwb.same('warranty sits after estimate, before the bill',
  (SELECT array_to_string(x[array_length(x, 1) - 2:], ',') FROM (SELECT public.flow_paper_ids() AS x) p), 'estimate,warranty,bill');
SELECT jwb.same('a step may pick them', concat_ws('|', public.flow_facts_ok(ARRAY['warranty_signed'])::text, public.flow_papers_ok(ARRAY['warranty'])::text), 'true|true');

-- 4 · The Warranty step on the residential flow prod already has: aside, last in the lane, a loop per warranty, the
-- paper, the reminder off until the owner turns it on.
SELECT jwb.same('twelve steps on the residential flow', jwb.steps(), '12');
SELECT jwb.same('the Warranty step as seed.ts draws it', jwb.step('warranty_paper'),
  '11|pricing|them|warranty_signed|warranty|each warranty|rounds|true|2|text|app|2|If we send you a warranty to sign.|Warranty|Garantía');
SELECT jwb.same('the owner''s switch does not name it',
  coalesce((SELECT (NULLIF(value_text, '')::jsonb -> 'residential') ? 'warranty_paper' FROM public.app_settings WHERE key = 'messages_nudge_app_sends_v1'), false)::text, 'false');

-- 5 · The migration once more: no second step, an office edit left alone.
UPDATE public.flow_steps s SET usual = 5 FROM public.flows f WHERE f.id = s.flow_id AND f.kind = 'residential' AND s.step_key = 'warranty_paper';
-- @rerun
SELECT jwb.same('still twelve steps', jwb.steps(), '12');
SELECT jwb.same('an office edit stays', split_part(jwb.step('warranty_paper'), '|', 12), '5');
SELECT jwb.same('the kind column is still there, the row still a warranty', (SELECT kind FROM public.job_contracts WHERE id = '00000000-0000-0000-0000-0000000c0002'), 'warranty');

-- 6 · A flow seeded afresh has the twelve steps.
DELETE FROM public.flows WHERE kind = 'residential';
SELECT jwb.same('the seed adds the residential flow''s twelve steps', public.flows_seed()::text, '12');
SELECT jwb.same('a fresh Warranty step', jwb.step('warranty_paper'),
  '11|pricing|them|warranty_signed|warranty|each warranty|rounds|true|2|text|app|2|If we send you a warranty to sign.|Warranty|Garantía');

DO $$ BEGIN RAISE NOTICE 'job_warranty PASSED'; END $$;
ROLLBACK;
