-- The stage a line's name reads as (punch list #397 PR 6, migration *_stage_kind_one_rule):
-- stage_checklist_kind_of answers every row of STAGE_NAME_TABLE (src/lib/jobs/stageNameTable.ts) as the app's
-- stageRank does. The app's unit test checks that each row of that table has its line here, so the two
-- cannot drift. Nothing is written. Raises on the first failed assertion; ends with "stage_kind PASSED".
-- See scripts/pgtest-stage-kind.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA sk;
CREATE FUNCTION sk.same(p_name text, p_got text, p_want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_got IS DISTINCT FROM p_want THEN
    RAISE EXCEPTION 'FAILED: % reads %, wanted %', quote_literal(p_name), COALESCE(p_got, 'NULL'), COALESCE(p_want, 'NULL');
  END IF;
  RAISE NOTICE 'ok: % reads %', quote_literal(p_name), COALESCE(p_got, 'no stage');
END $$;

SELECT sk.same('Underground', public.stage_checklist_kind_of('Underground'), NULL);
SELECT sk.same('Under slab plumbing', public.stage_checklist_kind_of('Under slab plumbing'), NULL);
SELECT sk.same('Pre-pour', public.stage_checklist_kind_of('Pre-pour'), NULL);
SELECT sk.same('Rough In', public.stage_checklist_kind_of('Rough In'), 'rough_in');
SELECT sk.same('ROUGH-IN', public.stage_checklist_kind_of('ROUGH-IN'), 'rough_in');
SELECT sk.same('Rough-in plumbing, 2nd floor', public.stage_checklist_kind_of('Rough-in plumbing, 2nd floor'), 'rough_in');
SELECT sk.same('Top Out', public.stage_checklist_kind_of('Top Out'), 'top_out');
SELECT sk.same('Top-out, sewer line, water line', public.stage_checklist_kind_of('Top-out, sewer line, water line'), 'top_out');
SELECT sk.same('topout', public.stage_checklist_kind_of('topout'), 'top_out');
SELECT sk.same('Stack out', public.stage_checklist_kind_of('Stack out'), 'top_out');
SELECT sk.same('Trim Set', public.stage_checklist_kind_of('Trim Set'), 'trim_set');
SELECT sk.same('Trim out', public.stage_checklist_kind_of('Trim out'), 'trim_set');
SELECT sk.same('Finish', public.stage_checklist_kind_of('Finish'), 'trim_set');
SELECT sk.same('Final', public.stage_checklist_kind_of('Final'), NULL);
SELECT sk.same('Final invoice', public.stage_checklist_kind_of('Final invoice'), NULL);
SELECT sk.same('Punch', public.stage_checklist_kind_of('Punch'), NULL);
SELECT sk.same('Stage 2 — Top Out', public.stage_checklist_kind_of('Stage 2 — Top Out'), 'top_out');
SELECT sk.same('Phase 1: Rough In', public.stage_checklist_kind_of('Phase 1: Rough In'), 'rough_in');
SELECT sk.same('3. Trim Set', public.stage_checklist_kind_of('3. Trim Set'), 'trim_set');
SELECT sk.same('Set trim', public.stage_checklist_kind_of('Set trim'), 'trim_set');
SELECT sk.same('set trim', public.stage_checklist_kind_of('set trim'), 'trim_set');
SELECT sk.same('Rough in and underground', public.stage_checklist_kind_of('Rough in and underground'), 'rough_in');
SELECT sk.same('Trim and final', public.stage_checklist_kind_of('Trim and final'), 'trim_set');
SELECT sk.same('Rough in, top out and trim. Water heater included.', public.stage_checklist_kind_of('Rough in, top out and trim. Water heater included.'), NULL);
SELECT sk.same('Rough and top out', public.stage_checklist_kind_of('Rough and top out'), NULL);
SELECT sk.same('Top out and trim', public.stage_checklist_kind_of('Top out and trim'), NULL);
SELECT sk.same('Final invoice, materials for the top-out', public.stage_checklist_kind_of('Final invoice, materials for the top-out'), NULL);
SELECT sk.same('Installed shower trim and reset toilet', public.stage_checklist_kind_of('Installed shower trim and reset toilet'), NULL);
SELECT sk.same('Half bath trim out', public.stage_checklist_kind_of('Half bath trim out'), NULL);
SELECT sk.same('Trip charge for a dry run to start rough in', public.stage_checklist_kind_of('Trip charge for a dry run to start rough in'), NULL);
SELECT sk.same('Bid price', public.stage_checklist_kind_of('Bid price'), NULL);
SELECT sk.same('Job total (migrated)', public.stage_checklist_kind_of('Job total (migrated)'), NULL);
SELECT sk.same('Per plans', public.stage_checklist_kind_of('Per plans'), NULL);
SELECT sk.same('Change order: chip and move manifold', public.stage_checklist_kind_of('Change order: chip and move manifold'), NULL);
SELECT sk.same('Permit', public.stage_checklist_kind_of('Permit'), NULL);
SELECT sk.same('Laptop', public.stage_checklist_kind_of('Laptop'), NULL);
SELECT sk.same('', public.stage_checklist_kind_of(''), NULL);

-- Whitespace around a name, and no name at all.
SELECT sk.same('  Rough In  ', public.stage_checklist_kind_of(E' \tRough In \n'), 'rough_in');
SELECT sk.same('(null)', public.stage_checklist_kind_of(NULL), NULL);

DO $$ BEGIN RAISE NOTICE 'stage_kind PASSED'; END $$;
ROLLBACK;
