-- Award and the statement of work (v2.4934, the Board's B6-a): the leveled total in SQL against the
-- numbers leveledTotal gives on the same rows, the award gate in canAward's words, and the statement of
-- work drafted as sowFromBid draws it. src/lib/gc/awardSql.test.ts builds the same rows for the kernels
-- and reads the numbers and words below from this file, so the two copies cannot drift. Presses run
-- as a dev through RLS; the fixture is made as postgres; everything rolls back. Raises on the first
-- failed assertion; ends with "gc_award PASSED". See scripts/pgtest-gc-award.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000006d1', 'dev@award.test'), ('00000000-0000-0000-0000-0000000006d2', 'estimator@award.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000006d1', 'dev@award.test', 'Award Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000006d2', 'estimator@award.test', 'Award Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- The clinic, bidding, with two sets of plans: Sitework (two lines, one Known exclusion), Concrete, and
-- Plumbing, which is ours. A second project, lost, with one trade.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000006c1', 'Award Test Owner', '00000000-0000-0000-0000-0000000006d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000006a1', 'Award test clinic', '00000000-0000-0000-0000-0000000006c1'),
  ('00000000-0000-0000-0000-0000000006a2', 'Award test lost job', '00000000-0000-0000-0000-0000000006c1');
INSERT INTO public.gc_projects (project_id, stage, lost_on) VALUES
  ('00000000-0000-0000-0000-0000000006a1', 'bidding', NULL),
  ('00000000-0000-0000-0000-0000000006a2', 'bidding', DATE '2026-10-07');
INSERT INTO public.gc_plan_sets (project_id, rev, label, issued_on) VALUES
  ('00000000-0000-0000-0000-0000000006a1', 0, 'Bid set', DATE '2026-10-01'),
  ('00000000-0000-0000-0000-0000000006a1', 1, 'Addendum 1', DATE '2026-10-05');
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, budget, ours) VALUES
  ('00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006a1', 'Sitework', 0, 60000, false),
  ('00000000-0000-0000-0000-0000000006b2', '00000000-0000-0000-0000-0000000006a1', 'Concrete', 1, 84000, false),
  ('00000000-0000-0000-0000-0000000006b3', '00000000-0000-0000-0000-0000000006a1', 'Plumbing', 2, 30000, true),
  ('00000000-0000-0000-0000-0000000006b4', '00000000-0000-0000-0000-0000000006a2', 'Sitework', 0, 20000, false);
INSERT INTO public.gc_scope_items (id, package_id, position, label) VALUES
  ('00000000-0000-0000-0000-0000000006e1', '00000000-0000-0000-0000-0000000006b1', 0, 'Clearing and grading'),
  ('00000000-0000-0000-0000-0000000006e2', '00000000-0000-0000-0000-0000000006b1', 1, 'Paving'),
  ('00000000-0000-0000-0000-0000000006e3', '00000000-0000-0000-0000-0000000006b2', 0, 'Foundations');
INSERT INTO public.gc_scope_exclusions (package_id, position, label, by) VALUES
  ('00000000-0000-0000-0000-0000000006b1', 0, 'Permits & fees', 'the owner');

-- The companies: one we know, one new to us with no form, one approved up to $50,000, one declined.
INSERT INTO public.gc_companies (id, name, trades, vetting_status, vetting_limit, vetting_note) VALUES
  ('00000000-0000-0000-0000-000000000611', 'Lonestar Earthworks', '{Sitework}', NULL, NULL, ''),
  ('00000000-0000-0000-0000-000000000612', 'Hillside Excavation', '{Sitework}', 'new', NULL, ''),
  ('00000000-0000-0000-0000-000000000613', 'Capped Concrete', '{Concrete}', 'approved', 50000, ''),
  ('00000000-0000-0000-0000-000000000614', 'Gone Grading', '{Sitework}', 'declined', NULL, 'no insurance');

-- The asks. Lonestar's carries the office's numbers: a plug on paving, a cover on two exclusions (one of
-- them the Known "Permits & fees", which does not count), and an alternate taken.
INSERT INTO public.gc_invites (id, package_id, company_id, status, plugs, exclusion_covers, taken_alternates) VALUES
  ('00000000-0000-0000-0000-000000000621', '00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-000000000611', 'bid',
     '{"00000000-0000-0000-0000-0000000006e2": 9000}', '{"Dewatering": 2500, "Permits and fees": 999}', '{Thicker base}'),
  ('00000000-0000-0000-0000-000000000622', '00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-000000000612', 'bid', '{}', '{}', '{}'),
  ('00000000-0000-0000-0000-000000000623', '00000000-0000-0000-0000-0000000006b2', '00000000-0000-0000-0000-000000000613', 'bid', '{}', '{}', '{}'),
  ('00000000-0000-0000-0000-000000000624', '00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-000000000614', 'bid', '{}', '{}', '{}'),
  ('00000000-0000-0000-0000-000000000625', '00000000-0000-0000-0000-0000000006b4', '00000000-0000-0000-0000-000000000611', 'bid', '{}', '{}', '{}'),
  ('00000000-0000-0000-0000-000000000626', '00000000-0000-0000-0000-0000000006b2', '00000000-0000-0000-0000-000000000611', 'invited', '{}', '{}', '{}');

-- The quotes. Lonestar's older $58,000 is replaced by $52,000, which leaves paving out, offers two
-- alternates and names three exclusions (one with a unit price) and its own schedule of values.
INSERT INTO public.gc_quotes (invite_id, amount, based_on_rev, includes, alternates, exclusions, sov, source, created_at) VALUES
  ('00000000-0000-0000-0000-000000000621', 58000, 0, '{"00000000-0000-0000-0000-0000000006e1": "yes", "00000000-0000-0000-0000-0000000006e2": "yes"}', '[]', NULL, NULL, 'trade', TIMESTAMPTZ '2026-10-03 10:00Z'),
  ('00000000-0000-0000-0000-000000000621', 52000, 1, '{"00000000-0000-0000-0000-0000000006e1": "yes", "00000000-0000-0000-0000-0000000006e2": "no"}',
     '[{"label": "Thicker base", "amount": 3000}, {"label": "Night work", "amount": 4000}]',
     '[{"name": "Dewatering"}, {"name": "Permits and fees"}, {"name": "Rock", "unitPrice": {"amount": 38, "unit": "cy"}}]',
     '[{"label": "Mobilize", "amount": 5000}, {"label": "Grading", "amount": 47000}]', 'trade', TIMESTAMPTZ '2026-10-05 10:00Z'),
  ('00000000-0000-0000-0000-000000000622', 60000, 1, '{"00000000-0000-0000-0000-0000000006e1": "yes", "00000000-0000-0000-0000-0000000006e2": "yes"}', '[]', NULL, NULL, 'trade', TIMESTAMPTZ '2026-10-06 10:00Z'),
  ('00000000-0000-0000-0000-000000000623', 61200, 1, '{"00000000-0000-0000-0000-0000000006e3": "yes"}', '[]', NULL, NULL, 'office', TIMESTAMPTZ '2026-10-06 11:00Z'),
  ('00000000-0000-0000-0000-000000000624', 40000, 1, '{"00000000-0000-0000-0000-0000000006e1": "yes", "00000000-0000-0000-0000-0000000006e2": "yes"}', '[]', NULL, NULL, 'trade', TIMESTAMPTZ '2026-10-06 12:00Z'),
  ('00000000-0000-0000-0000-000000000625', 18000, 0, '{}', '[]', NULL, NULL, 'trade', TIMESTAMPTZ '2026-10-06 13:00Z');

CREATE SCHEMA gat;
CREATE FUNCTION gat.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with exactly these words; its writes go with the refusal (a subtransaction).
CREATE FUNCTION gat.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM IS DISTINCT FROM want THEN RAISE EXCEPTION E'% was refused with other words.\n--- got ---\n%\n--- want ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- A statement the database itself refuses, by its SQLSTATE (which constraint fires first is the planner's).
CREATE FUNCTION gat.refused_code(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION gat.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT USAGE ON SCHEMA gat TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gat TO authenticated;

-- 0 · Who may award: an estimator reads the trades since door 2, and is refused in words before any write.
SELECT gat.as_user('00000000-0000-0000-0000-0000000006d2');
SET LOCAL ROLE authenticated;
SELECT gat.refused('an estimator, until call W', $q$SELECT public.gc_award('00000000-0000-0000-0000-000000000621')$q$,
  'Only a dev awards a trade while GC mode is built.');
RESET ROLE;

SELECT gat.as_user('00000000-0000-0000-0000-0000000006d1');
SET LOCAL ROLE authenticated;

-- 1 · The leveled total. Each line reads "leveled <ask>: <amount>" for the parity test.
-- leveled lonestar: 66500 (52,000 + the 9,000 plug on paving + the 3,000 alternate + the 2,500 cover)
SELECT gat.same('leveled lonestar', public.gc_leveled_total('00000000-0000-0000-0000-000000000621')::text, '66500');
-- leveled hillside: 60000
SELECT gat.same('leveled hillside', public.gc_leveled_total('00000000-0000-0000-0000-000000000622')::text, '60000');
-- leveled capped: 61200
SELECT gat.same('leveled capped', public.gc_leveled_total('00000000-0000-0000-0000-000000000623')::text, '61200');
SELECT gat.same('no quote, no number', coalesce(public.gc_leveled_total('00000000-0000-0000-0000-000000000626')::text, 'null'), 'null');

-- 2 · The gate, in canAward's words. Each refusal reads "refused <ask>: <words>" for the parity test.
-- refused hillside: Hillside Excavation is not vetted yet. They have not sent their form.
SELECT gat.refused('a company new to us', $q$SELECT public.gc_award('00000000-0000-0000-0000-000000000622')$q$,
  'Hillside Excavation is not vetted yet. They have not sent their form.');
-- refused capped: Capped Concrete is approved up to $50,000. This award is $61,200.
SELECT gat.refused('over the approved limit', $q$SELECT public.gc_award('00000000-0000-0000-0000-000000000623')$q$,
  'Capped Concrete is approved up to $50,000. This award is $61,200.');
-- refused gone: We declined Gone Grading: no insurance.
SELECT gat.refused('a declined company', $q$SELECT public.gc_award('00000000-0000-0000-0000-000000000624')$q$,
  'We declined Gone Grading: no insurance.');
SELECT gat.refused('a lost project', $q$SELECT public.gc_award('00000000-0000-0000-0000-000000000625')$q$,
  'Award test lost job is lost. Bring it back before you award a trade.');
SELECT gat.refused('an ask with no quote', $q$SELECT public.gc_award('00000000-0000-0000-0000-000000000626')$q$,
  'Lonestar Earthworks has not sent a quote for Concrete.');
SELECT gat.same('nothing awarded by a refusal', (SELECT count(*)::text FROM public.gc_trade_packages WHERE awarded_invite_id IS NOT NULL), '0');

-- 3 · Award Lonestar: the award, then the statement of work as sowFromBid draws it.
SELECT public.gc_award('00000000-0000-0000-0000-000000000621', '00000000-0000-0000-0000-0000000006d1') IS NOT NULL AS awarded;
SELECT gat.same('the award', (SELECT awarded_invite_id || ' ' || awarded_by || ' ' || (awarded_on = public.app_today()) FROM public.gc_trade_packages WHERE id = '00000000-0000-0000-0000-0000000006b1'),
  '00000000-0000-0000-0000-000000000621 00000000-0000-0000-0000-0000000006d1 true');
SELECT gat.same('the statement of work', (SELECT status || ' ' || price || ' ' || retainage_pct || ' rev ' || based_on_rev FROM public.gc_sows WHERE package_id = '00000000-0000-0000-0000-0000000006b1'),
  'draft 66500 10 rev 1');
-- sow lines: Clearing and grading 33200, Paving 33300
SELECT gat.same('the lines split in hundreds, the rest on the last', (
  SELECT string_agg(l.label || ' ' || l.amount, ', ' ORDER BY l.position) FROM public.gc_sow_lines l JOIN public.gc_sows s ON s.id = l.sow_id
  WHERE s.package_id = '00000000-0000-0000-0000-0000000006b1'), 'Clearing and grading 33200, Paving 33300');
SELECT gat.same('their schedule of values rides along', (SELECT their_sov::text FROM public.gc_sows WHERE package_id = '00000000-0000-0000-0000-0000000006b1'),
  '[{"label": "Mobilize", "amount": 5000}, {"label": "Grading", "amount": 47000}]');
SELECT gat.same('what they will not do, with who does the Known one', (SELECT excluded::text FROM public.gc_sows WHERE package_id = '00000000-0000-0000-0000-0000000006b1'),
  '[{"by": null, "name": "Dewatering"}, {"by": "the owner", "name": "Permits and fees"}, {"by": null, "name": "Rock", "unitPrice": {"unit": "cy", "amount": 38}}]');
SELECT gat.refused('a trade awarded twice', $q$SELECT public.gc_award('00000000-0000-0000-0000-000000000622')$q$, 'Sitework is already awarded.');

RESET ROLE;
SELECT gat.refused('our own trade', $q$UPDATE public.gc_invites SET package_id = '00000000-0000-0000-0000-0000000006b3' WHERE id = '00000000-0000-0000-0000-000000000626';
  SELECT public.gc_award('00000000-0000-0000-0000-000000000626')$q$, 'We do Plumbing ourselves, so it is not awarded.');
SELECT gat.refused_code('an awarded ask cannot be deleted', $q$DELETE FROM public.gc_invites WHERE id = '00000000-0000-0000-0000-000000000621'$q$, '23503');
SELECT gat.refused_code('an award needs its day', $q$UPDATE public.gc_trade_packages SET awarded_on = NULL WHERE id = '00000000-0000-0000-0000-0000000006b1'$q$, '23514');
SELECT gat.same('a signed statement of work can be consented to', (
  SELECT pg_get_constraintdef(oid) LIKE '%''gc_sow''%' FROM pg_constraint WHERE conname = 'esign_consents_record_type_check')::text, 'true');
SELECT gat.same('our number''s old columns are gone', (
  SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gc_projects' AND column_name IN ('general_conditions', 'contingency_pct', 'fee_pct')), '0');

DO $$ BEGIN RAISE NOTICE 'gc_award PASSED'; END $$;
ROLLBACK;
