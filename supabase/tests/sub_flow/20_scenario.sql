-- The sub's flow (migration *_sub_flow, residential R8 · 12, PR 1 of 3, after the residential flow): six flows, the
-- sub one with its five steps in one Per job lane as SEED_FLOWS.sub draws them (src/lib/flows/seed.ts); Said yes a
-- fork whose no ends the lane, and no step with a reminder; the six sub facts last in flow_fact_ids(); the residential
-- flow untouched; the migration once more at the -- @rerun line (the bed script streams it in there, as a second push
-- would) leaves an office's edit alone; and a flow seeded afresh adds the five steps once. The fixture is made as
-- postgres; everything rolls back. Raises on the first failed assertion; ends with "sub_flow PASSED". See
-- scripts/pgtest-sub-flow.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA sfl;
CREATE FUNCTION sfl.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A kind's steps in order: lane and id.
CREATE FUNCTION sfl.order(p_kind text) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(s.lane || '.' || s.step_key, ' ' ORDER BY s.lane, s.position)
  FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = p_kind
$$;
-- One sub step in one line: where it sits, whose it is, what finishes it, how it repeats, its reminder, its words.
CREATE FUNCTION sfl.step(p_key text) RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', s.position, s.phase, s.who, array_to_string(s.facts, ','), array_to_string(s.papers, ','),
    coalesce(s.loop_words, '-'), coalesce(s.loop_ends, '-'), coalesce(s.nudge_days::text, '-'), coalesce(s.nudge_how, '-'),
    coalesce(s.nudge_send, '-'), coalesce(s.nudge_day_fact, '-'), s.usual, coalesce(s.owed_words, '-'), s.name, s.name_es)
  FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = 'sub' AND s.step_key = p_key
$$;
CREATE FUNCTION sfl.steps(p_kind text) RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = p_kind
$$;

-- 1 · Six flows; the sub one in one Per job lane, Asked to Paid.
SELECT sfl.same('six flows, the sub one among them',
  (SELECT string_agg(kind || ':' || name, ', ' ORDER BY kind COLLATE "C") FROM public.flows),
  'arch:Architect flow, customer:Customer flow, residential:Residential customer flow, sub:Sub flow, trade:Trade partner flow, unknown:The flow');
SELECT sfl.same('five steps in one Per job lane', sfl.order('sub'),
  'per_job.asked per_job.yes per_job.onsite per_job.done per_job.paid');
SELECT sfl.same('Asked: ours, the work order',
  sfl.step('asked'), '0|pricing|us|sub_asked||-|-|-|-|-|-|1|the work order|Asked|Ofrecido');
SELECT sfl.same('Said yes: theirs, a yes or a no',
  sfl.step('yes'), '1|pricing|them|sub_said_yes,sub_declined||-|-|-|-|-|-|1|-|Said yes|Aceptó');
SELECT sfl.same('On site: theirs',
  sfl.step('onsite'), '2|building|them|sub_on_site||-|-|-|-|-|-|3|-|On site|En obra');
SELECT sfl.same('Done: theirs',
  sfl.step('done'), '3|building|them|sub_done||-|-|-|-|-|-|5|-|Done|Terminado');
SELECT sfl.same('Paid: ours, their pay, last',
  sfl.step('paid'), '4|building|us|sub_paid||-|-|-|-|-|-|7|their pay|Paid|Pagado');
SELECT sfl.same('Said yes is the one fork, either fact finishing it',
  (SELECT string_agg(s.step_key || ':' || s.join_word, ',' ORDER BY s.position) FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id
   WHERE f.kind = 'sub' AND s.fork), 'yes:or');
SELECT sfl.same('no step carries a reminder',
  (SELECT count(*) FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = 'sub' AND s.nudge_days IS NOT NULL)::text, '0');
SELECT sfl.same('the seats are the office''s to set',
  (SELECT count(*) FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = 'sub' AND s.seat_user_id IS NOT NULL)::text, '0');

-- 2 · The facts a step picks from.
SELECT sfl.same('the six sub facts come last, after review_asked',
  (SELECT array_to_string(x[array_position(x, 'review_asked'):], ',') FROM (SELECT public.flow_fact_ids() AS x) f),
  'review_asked,sub_asked,sub_said_yes,sub_declined,sub_on_site,sub_done,sub_paid');
SELECT sfl.same('a step may pick them', public.flow_facts_ok(ARRAY['sub_asked', 'sub_declined', 'sub_paid'])::text, 'true');
SELECT sfl.same('and still the residential ones', public.flow_facts_ok(ARRAY['booked', 'review_asked'])::text, 'true');

-- 3 · The residential flow is as its own migration left it.
SELECT sfl.same('the residential flow keeps its eleven steps', sfl.steps('residential'), '11');

-- 4 · An office's edit stays the office's: the migration once more changes nothing.
UPDATE public.flow_steps s SET usual = 4 FROM public.flows f WHERE f.id = s.flow_id AND f.kind = 'sub' AND s.step_key = 'asked';
-- @rerun
SELECT sfl.same('an office edit stays', split_part(sfl.step('asked'), '|', 12), '4');
SELECT sfl.same('still five steps', sfl.steps('sub'), '5');

-- 5 · A flow seeded afresh adds the five steps once.
DELETE FROM public.flows WHERE kind = 'sub';
SELECT sfl.same('the seed adds the sub flow''s five steps', public.flows_seed()::text, '5');
SELECT sfl.same('a fresh Paid step', sfl.step('paid'), '4|building|us|sub_paid||-|-|-|-|-|-|7|their pay|Paid|Pagado');
SELECT sfl.same('a second seed adds nothing', public.flows_seed()::text, '0');

DO $$ BEGIN RAISE NOTICE 'sub_flow PASSED'; END $$;
ROLLBACK;
