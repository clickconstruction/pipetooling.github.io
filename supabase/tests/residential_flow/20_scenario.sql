-- The residential customer's flow (migration *_residential_flow, residential R4 · 1 of 4, after Messages cut 4): six
-- flows (the sub's seeded by *_sub_flow), the residential one with its eleven steps in one Per job lane as SEED_FLOWS.residential draws them
-- (src/lib/flows/seed.ts); Approved and Paid carry the app's reminders and no other step has one; the eleven facts come
-- last in flow_fact_ids() and the estimate and the bill last in flow_paper_ids(); a sub flow is allowed and an unknown
-- kind refused; the migration once more at the -- @rerun line (the bed script streams it in there, as a second push
-- would) leaves an office's edit alone; and a flow seeded afresh adds the eleven steps once. The fixture is made as
-- postgres; everything rolls back. Raises on the first failed assertion; ends with "residential_flow PASSED". See
-- scripts/pgtest-residential-flow.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA rfl;
CREATE FUNCTION rfl.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION rfl.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- The residential flow's steps in order: lane and id.
CREATE FUNCTION rfl.order() RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(s.lane || '.' || s.step_key, ' ' ORDER BY s.lane, s.position)
  FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = 'residential'
$$;
-- One residential step in one line: where it sits, whose it is, what finishes it, how it repeats, its reminder, its
-- words.
CREATE FUNCTION rfl.step(p_key text) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', s.position, s.phase, s.who, array_to_string(s.facts, ','), array_to_string(s.papers, ','),
    coalesce(s.loop_words, '-'), coalesce(s.loop_ends, '-'), coalesce(s.nudge_days::text, '-'), coalesce(s.nudge_how, '-'),
    coalesce(s.nudge_send, '-'), coalesce(s.nudge_day_fact, '-'), s.usual, coalesce(s.owed_words, '-'), s.name, s.name_es)
  FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = 'residential' AND s.step_key = p_key
$$;
CREATE FUNCTION rfl.steps() RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = 'residential'
$$;

-- 1 · Five flows; the residential one in one Per job lane, Booked to Review asked.
SELECT rfl.same('six flows, the residential one among them',
  (SELECT string_agg(kind || ':' || name, ', ' ORDER BY kind COLLATE "C") FROM public.flows),
  'arch:Architect flow, customer:Customer flow, residential:Residential customer flow, sub:Sub flow, trade:Trade partner flow, unknown:The flow');
SELECT rfl.same('eleven steps in one Per job lane', rfl.order(),
  'per_job.booked per_job.onway per_job.arrived per_job.found per_job.estimate per_job.approved per_job.working per_job.done per_job.billed per_job.paid per_job.review');
SELECT rfl.same('Booked: ours, the day we come',
  rfl.step('booked'), '0|setup|us|booked||-|-|-|-|-|-|1|the day we come|Booked|Agendado');
SELECT rfl.same('Estimate sent: ours, the estimate, no reminder',
  rfl.step('estimate'), '4|pricing|us|estimate_sent|estimate|-|-|-|-|-|-|1|the estimate|Estimate sent|Presupuesto enviado');
SELECT rfl.same('Approved: theirs, the app''s text after a quiet day',
  rfl.step('approved'), '5|pricing|them|estimate_approved||-|-|1|text|app|-|3|-|Approved|Aprobado');
SELECT rfl.same('Billed: ours, once per bill, no reminder',
  rfl.step('billed'), '8|building|us|billed|bill|each bill|rounds|-|-|-|-|2|the bill|Billed|Facturado');
SELECT rfl.same('Paid: theirs, once per bill, the app''s text at pay by',
  rfl.step('paid'), '9|building|them|paid||each bill|rounds|0|text|app|pay_by|14|-|Paid|Pagado');
SELECT rfl.same('Review asked: ours, last, no reminder',
  rfl.step('review'), '10|building|us|review_asked||-|-|-|-|-|-|2|a review link|Review asked|Reseña pedida');
SELECT rfl.same('only Approved and Paid carry a reminder',
  (SELECT string_agg(s.step_key, ',' ORDER BY s.position) FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id
   WHERE f.kind = 'residential' AND s.nudge_days IS NOT NULL), 'approved,paid');
SELECT rfl.same('the seats are the office''s to set',
  (SELECT count(*) FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = 'residential' AND s.seat_user_id IS NOT NULL)::text, '0');

-- 2 · The facts and the papers a step picks from.
SELECT rfl.same('the eleven facts come last, after named',
  (SELECT array_to_string(x[array_position(x, 'named'):], ',') FROM (SELECT public.flow_fact_ids() AS x) f),
  'named,booked,on_way,arrived,found,estimate_sent,estimate_approved,working,done,billed,paid,review_asked');
SELECT rfl.same('the estimate and the bill are the last papers',
  (SELECT array_to_string(x[array_length(x, 1) - 1:], ',') FROM (SELECT public.flow_paper_ids() AS x) p), 'estimate,bill');
SELECT rfl.same('a step may pick them', concat_ws('|',
  public.flow_facts_ok(ARRAY['booked', 'review_asked'])::text, public.flow_papers_ok(ARRAY['estimate', 'bill'])::text), 'true|true');

-- 3 · The kinds a flow is for.
-- The sub flow's own migration (*_sub_flow) seeds it, so it is here already; its own bed reads it step by step.
SELECT rfl.same('a sub flow is allowed', (SELECT count(*) FROM public.flows WHERE kind = 'sub')::text, '1');
SELECT rfl.refused('a kind the app does not know', $q$INSERT INTO public.flows (kind, name) VALUES ('vendor', 'Vendor flow')$q$, 'flows_kind_known');

-- 4 · An office's edit stays the office's: the migration once more changes nothing.
UPDATE public.flow_steps s SET usual = 5 FROM public.flows f WHERE f.id = s.flow_id AND f.kind = 'residential' AND s.step_key = 'booked';
-- @rerun
SELECT rfl.same('an office edit stays', split_part(rfl.step('booked'), '|', 12), '5');
SELECT rfl.same('still eleven steps', rfl.steps(), '11');

-- 5 · A flow seeded afresh adds the eleven steps once.
DELETE FROM public.flows WHERE kind = 'residential';
SELECT rfl.same('the seed adds the residential flow''s eleven steps', public.flows_seed()::text, '11');
SELECT rfl.same('a fresh Paid step', rfl.step('paid'), '9|building|them|paid||each bill|rounds|0|text|app|pay_by|14|-|Paid|Pagado');
SELECT rfl.same('a second seed adds nothing', public.flows_seed()::text, '0');

DO $$ BEGIN RAISE NOTICE 'residential_flow PASSED'; END $$;
ROLLBACK;
