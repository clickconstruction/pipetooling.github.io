-- The draws fix (migration *_flow_draws_requested, after Messages cut 4): the facts list draw_requested just before
-- draw_approved; the trade flow's draws step is finished by draw_requested and draw_paid, with one History line for the
-- change; the migration once more at the -- @rerun line (the bed script streams it in there, as a second push would)
-- leaves an office's edit to the step alone and writes no second line; and a flow seeded afresh draws the step the same
-- way. The fixture is made as postgres; everything rolls back. Raises on the first failed assertion; ends with
-- "flow_draws PASSED". See scripts/pgtest-flow-draws.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA fdr;
CREATE FUNCTION fdr.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION fdr.draws() RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws(' | ', array_to_string(s.facts, ','), s.join_word, array_to_string(s.papers, ','), s.loop_words, s.loop_ends)
  FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id
  WHERE f.kind = 'trade' AND s.step_key = 'draws'
$$;
CREATE FUNCTION fdr.lines() RETURNS text LANGUAGE sql AS $$
  SELECT count(*)::text || ' · ' || coalesce(string_agg(h.what || ' by ' || h.by_name, '; '), '')
  FROM public.flow_step_history h JOIN public.flows f ON f.id = h.flow_id
  WHERE f.kind = 'trade' AND h.step_key = 'draws'
$$;

-- 1 · The facts a step picks from list draw_requested just before draw_approved.
SELECT fdr.same('draw_requested is a fact, just before draw_approved',
  (SELECT array_to_string(x[array_position(x, 'sow_signed'):array_position(x, 'draw_paid')], ',') FROM (SELECT public.flow_fact_ids() AS x) f),
  'sow_signed,draw_requested,draw_approved,draw_paid');
SELECT fdr.same('a step may pick it', public.flow_facts_ok(ARRAY['draw_requested', 'draw_paid'])::text, 'true');

-- 2 · The trade flow's draws step reads their pay application in, then its payment, with one History line.
SELECT fdr.same('the draws step', fdr.draws(), 'draw_requested,draw_paid | and | waiver | each draw | next');
SELECT fdr.same('one History line for it', fdr.lines(), '1 · Draws: + their pay application is in by The app');

-- 3 · An office's edit stays the office's: the migration once more changes nothing and writes no second line.
UPDATE public.flow_steps s SET facts = ARRAY['draw_paid', 'draw_approved']::text[]
  FROM public.flows f WHERE f.id = s.flow_id AND f.kind = 'trade' AND s.step_key = 'draws';
-- @rerun
SELECT fdr.same('an office edit stays', fdr.draws(), 'draw_paid,draw_approved | and | waiver | each draw | next');
SELECT fdr.same('still one History line', split_part(fdr.lines(), ' · ', 1), '1');

-- 4 · A flow seeded afresh draws the step the same way, and a second seed adds nothing.
DELETE FROM public.flows WHERE kind = 'trade';
SELECT fdr.same('the seed adds the trade flow''s nine steps', public.flows_seed()::text, '9');
SELECT fdr.same('a fresh draws step', fdr.draws(), 'draw_requested,draw_paid | and | waiver | each draw | next');
SELECT fdr.same('a second seed adds nothing', public.flows_seed()::text, '0');

DO $$ BEGIN RAISE NOTICE 'flow_draws PASSED'; END $$;
ROLLBACK;
