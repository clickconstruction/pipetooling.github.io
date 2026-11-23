-- Merging a customer. Part A: their GC call log and their part on every GC project are kept (migration
-- *_merge_customers_gc_folds, v2.5310). Part B: every reference to the row that goes is carried, by the catalog, with
-- the rules for what two rows may not both hold, the archive of what a rule drops, and the refusals (migration
-- *_merge_customers_every_reference, v2.8324). The fixture is made as postgres; the merge runs as a dev, and in part B
-- as an assistant, through RLS, the way the Customer Hub calls it; everything rolls back. Who may merge is held here
-- too: nobody signed out, no role outside the four the screen shows the press to, and nobody in training mode
-- (assert_caller_can_merge_customer_pair, which the merge and its preview both call). Raises on the first failed
-- assertion; ends with "merge_customers PASSED". See scripts/pgtest-merge-customers.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- A dev, who merges, an estimator, who logged the calls, and an assistant in training mode, who may not write.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000ed1', 'dev@merge.test'),
  ('00000000-0000-0000-0000-000000000ed2', 'estimator@merge.test'),
  ('00000000-0000-0000-0000-000000000ed4', 'trainee@merge.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-000000000ed1', 'dev@merge.test', 'Merge Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-000000000ed2', 'estimator@merge.test', 'Merge Estimator', 'estimator', false, false),
  ('00000000-0000-0000-0000-000000000ed4', 'trainee@merge.test', 'Merge Trainee', 'assistant', true, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- The same architect typed twice (the survivor and the victim), and the owner of a building.
INSERT INTO public.customers (id, name, address, master_user_id) VALUES
  ('00000000-0000-0000-0000-000000000ec1', 'Kept Architects', '1 Kept St', '00000000-0000-0000-0000-000000000ed1'),
  ('00000000-0000-0000-0000-000000000ec2', 'Kept Architects (dup)', '2 Gone St', '00000000-0000-0000-0000-000000000ed1'),
  ('00000000-0000-0000-0000-000000000ec3', 'Merge Owner', '3 Owner Rd', '00000000-0000-0000-0000-000000000ed1');

-- Three GC projects: the clinic is the owner's job, drawn by the victim and with the victim typed as its property owner
-- too; the school is the victim's own job, drawn by the survivor already; the shop has no part for the victim.
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-000000000ea1', 'Merge Clinic', '00000000-0000-0000-0000-000000000ec3'),
  ('00000000-0000-0000-0000-000000000ea2', 'Merge School', '00000000-0000-0000-0000-000000000ec2'),
  ('00000000-0000-0000-0000-000000000ea3', 'Merge Shop', '00000000-0000-0000-0000-000000000ec3');
INSERT INTO public.gc_projects (project_id, stage, architect_customer_id, property_owner_customer_id) VALUES
  ('00000000-0000-0000-0000-000000000ea1', 'buyout', '00000000-0000-0000-0000-000000000ec2', '00000000-0000-0000-0000-000000000ec2'),
  ('00000000-0000-0000-0000-000000000ea2', 'bidding', '00000000-0000-0000-0000-000000000ec1', '00000000-0000-0000-0000-000000000ec3'),
  ('00000000-0000-0000-0000-000000000ea3', 'building', '00000000-0000-0000-0000-000000000ec3', NULL);

-- The GC call log: two lines on the victim, one of them about the clinic, and one on the survivor. The old call log
-- (customer_contacts): one line on the victim.
INSERT INTO public.gc_customer_contacts (customer_id, project_id, by_user_id, by_name, how, note) VALUES
  ('00000000-0000-0000-0000-000000000ec2', '00000000-0000-0000-0000-000000000ea1', '00000000-0000-0000-0000-000000000ed2', 'Merge Estimator', 'call', 'They will sign Monday.'),
  ('00000000-0000-0000-0000-000000000ec2', NULL, '00000000-0000-0000-0000-000000000ed2', 'Merge Estimator', 'email', 'Sent the price.'),
  ('00000000-0000-0000-0000-000000000ec1', NULL, '00000000-0000-0000-0000-000000000ed1', 'Merge Dev', 'note', 'Met at the site.');
INSERT INTO public.customer_contacts (customer_id, contact_date, details, contact_method, created_by) VALUES
  ('00000000-0000-0000-0000-000000000ec2', now(), 'Old log line.', 'phone', '00000000-0000-0000-0000-000000000ed2');

CREATE SCHEMA mc;
CREATE FUNCTION mc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION mc.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION mc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT USAGE ON SCHEMA mc TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mc TO anon, authenticated;

-- 0 · The fixture reads as laid: three call-log lines, two of them the victim's; the clinic names the victim twice.
SELECT mc.same('the victim''s call log before the merge',
  (SELECT count(*)::text FROM public.gc_customer_contacts WHERE customer_id = '00000000-0000-0000-0000-000000000ec2'), '2');
SELECT mc.same('the clinic names the victim as architect and owner',
  (SELECT concat_ws('|', architect_customer_id, property_owner_customer_id) FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-000000000ea1'),
  '00000000-0000-0000-0000-000000000ec2|00000000-0000-0000-0000-000000000ec2');

-- 1 · Nobody signed out merges.
SELECT mc.refused('no sign-in merges nothing',
  $q$SELECT public.merge_customers('00000000-0000-0000-0000-000000000ec1', '00000000-0000-0000-0000-000000000ec2', '{}'::jsonb)$q$,
  'Not authenticated');

-- 1b · Nobody outside the four roles merges. The screen shows the press to a dev, a leader, an assistant and a
-- controller, and the database holds the same list: the merge and its preview each ask
-- assert_caller_can_merge_customer_pair. An estimator may edit a customer and is refused both, with the reason. An
-- assistant in training mode passes the role test and is stopped at the merge's first write. Nothing moved.
SELECT mc.as_user('00000000-0000-0000-0000-000000000ed2');
SET LOCAL ROLE authenticated;
SELECT mc.refused('an estimator does not merge',
  $q$SELECT public.merge_customers('00000000-0000-0000-0000-000000000ec1', '00000000-0000-0000-0000-000000000ec2', '{}'::jsonb)$q$,
  'Not allowed to merge customers');
SELECT mc.refused('an estimator does not read the merge''s preview',
  $q$SELECT public.preview_merge_customers('00000000-0000-0000-0000-000000000ec1', '00000000-0000-0000-0000-000000000ec2')$q$,
  'Not allowed to merge customers');
RESET ROLE;
SELECT mc.as_user('00000000-0000-0000-0000-000000000ed4');
SET LOCAL ROLE authenticated;
SELECT mc.refused('an assistant in training mode does not merge',
  $q$SELECT public.merge_customers('00000000-0000-0000-0000-000000000ec1', '00000000-0000-0000-0000-000000000ec2', '{}'::jsonb)$q$,
  'Read-only (training) mode');
RESET ROLE;
SELECT mc.same('the refusals moved nothing',
  (SELECT string_agg(right(id::text, 3) || ':' || address, ',' ORDER BY id) FROM public.customers WHERE id IN ('00000000-0000-0000-0000-000000000ec1', '00000000-0000-0000-0000-000000000ec2')),
  'ec1:1 Kept St,ec2:2 Gone St');

-- 2 · The dev merges the duplicate into the kept one, taking the duplicate's address.
SELECT mc.as_user('00000000-0000-0000-0000-000000000ed1');
SET LOCAL ROLE authenticated;
SELECT mc.same('the merge answers with the pair',
  (SELECT concat_ws('|', r->>'survivor_id', r->>'removed_id') FROM (
    SELECT public.merge_customers('00000000-0000-0000-0000-000000000ec1', '00000000-0000-0000-0000-000000000ec2', '{"address": "victim"}'::jsonb) AS r) s),
  '00000000-0000-0000-0000-000000000ec1|00000000-0000-0000-0000-000000000ec2');
RESET ROLE;

-- 3 · The duplicate is gone; the survivor carries the chosen address (the folds the function always did).
SELECT mc.same('the victim is gone and the survivor stays',
  (SELECT string_agg(id::text || ':' || address, ',' ORDER BY id) FROM public.customers WHERE id IN ('00000000-0000-0000-0000-000000000ec1', '00000000-0000-0000-0000-000000000ec2')),
  '00000000-0000-0000-0000-000000000ec1:2 Gone St');
SELECT mc.same('the school is the survivor''s job now',
  (SELECT customer_id::text FROM public.projects WHERE id = '00000000-0000-0000-0000-000000000ea2'),
  '00000000-0000-0000-0000-000000000ec1');
SELECT mc.same('the old call log line moved too',
  (SELECT string_agg(customer_id::text, ',') FROM public.customer_contacts WHERE details = 'Old log line.'),
  '00000000-0000-0000-0000-000000000ec1');

-- 4 · Every line of the GC call log reads on the survivor; the clinic call still names its job; nothing was dropped.
SELECT mc.same('the GC call log is all the survivor''s, still naming the job',
  (SELECT string_agg(concat_ws('|', customer_id, coalesce(project_id::text, ''), how, note), ',' ORDER BY note) FROM public.gc_customer_contacts),
  '00000000-0000-0000-0000-000000000ec1||note|Met at the site.,'
  '00000000-0000-0000-0000-000000000ec1||email|Sent the price.,'
  '00000000-0000-0000-0000-000000000ec1|00000000-0000-0000-0000-000000000ea1|call|They will sign Monday.');

-- 5 · The clinic names the survivor as its architect and its property owner; the school's and the shop's parts are
-- as they were.
SELECT mc.same('the projects name the survivor where they named the victim',
  (SELECT string_agg(concat_ws('|', project_id, coalesce(architect_customer_id::text, ''), coalesce(property_owner_customer_id::text, '')), ',' ORDER BY project_id) FROM public.gc_projects
    WHERE project_id IN ('00000000-0000-0000-0000-000000000ea1', '00000000-0000-0000-0000-000000000ea2', '00000000-0000-0000-0000-000000000ea3')),
  '00000000-0000-0000-0000-000000000ea1|00000000-0000-0000-0000-000000000ec1|00000000-0000-0000-0000-000000000ec1,'
  '00000000-0000-0000-0000-000000000ea2|00000000-0000-0000-0000-000000000ec1|00000000-0000-0000-0000-000000000ec3,'
  '00000000-0000-0000-0000-000000000ea3|00000000-0000-0000-0000-000000000ec3|');

-- 6 · The first merge took the duplicate's address. Its own property came over and was starred, and the kept
-- customer's old property is still there, un-starred. Before v2.8324 the kept row's property was retyped instead, and
-- carried the old address's legal record under the new address.
SELECT mc.same('the chosen address is the survivor''s starred property, and its old one is kept',
  (SELECT string_agg(address || ':' || is_primary::text, ',' ORDER BY address COLLATE "C") FROM public.customer_addresses WHERE customer_id = '00000000-0000-0000-0000-000000000ec1'),
  '1 Kept St:false,2 Gone St:true');

-- ====================================================================================================================
-- B · Every reference (migration *_merge_customers_every_reference, v2.8324). One GC typed twice: Kept Builders stays
-- and Kept Builders LLC goes. The row that goes holds something in every kind of place a customer is named.
-- ====================================================================================================================
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000ed3', 'assistant@merge.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-000000000ed3', 'assistant@merge.test', 'Merge Assistant', 'assistant', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

INSERT INTO public.customers (id, name, address, master_user_id) VALUES
  ('00000000-0000-0000-0000-000000000ec5', 'Kept Builders', '1 Kept Rd', '00000000-0000-0000-0000-000000000ed1'),
  ('00000000-0000-0000-0000-000000000ec6', 'Kept Builders LLC', '1  kept rd', '00000000-0000-0000-0000-000000000ed1'),
  ('00000000-0000-0000-0000-000000000ec7', 'Merge Third Party', '7 Third Ave', '00000000-0000-0000-0000-000000000ed1');

-- Properties. Each row has its starred one already, made from its address. The other row's is the kept row's spelled
-- loosely and holds nothing more, so it folds. Its second holds a legal record and moves whole. Its third is one both
-- spell alike, and the other row's copy holds a parcel the kept row's lacks, so it moves and is not folded.
INSERT INTO public.customer_addresses (id, customer_id, address, legal_description, sequence_order) VALUES
  ('00000000-0000-0000-0000-000000000a91', '00000000-0000-0000-0000-000000000ec6', '9 Other Way', 'LOT 9 BLOCK 2', 1);
INSERT INTO public.customer_addresses (id, customer_id, address, sequence_order) VALUES
  ('00000000-0000-0000-0000-000000000a92', '00000000-0000-0000-0000-000000000ec5', '5 Shared Ct', 1);
INSERT INTO public.customer_addresses (id, customer_id, address, parcel_id, sequence_order) VALUES
  ('00000000-0000-0000-0000-000000000a93', '00000000-0000-0000-0000-000000000ec6', '5 shared ct', 'P-55', 2);

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-000000000e51', 'Merge Bed Plumbing');

-- Bids. One is a third party's, with both rows on it as other GCs. Two is the other row's own. Three is a third
-- party's with the other row alone on it.
INSERT INTO public.bids (id, created_by, account_manager_id, service_type_id, project_name, customer_id) VALUES
  ('00000000-0000-0000-0000-000000000eb1', '00000000-0000-0000-0000-000000000ed2', '00000000-0000-0000-0000-000000000ed2', '00000000-0000-0000-0000-000000000e51', 'Merge Bid One', '00000000-0000-0000-0000-000000000ec7'),
  ('00000000-0000-0000-0000-000000000eb2', '00000000-0000-0000-0000-000000000ed2', '00000000-0000-0000-0000-000000000ed2', '00000000-0000-0000-0000-000000000e51', 'Merge Bid Two', '00000000-0000-0000-0000-000000000ec6'),
  ('00000000-0000-0000-0000-000000000eb3', '00000000-0000-0000-0000-000000000ed2', '00000000-0000-0000-0000-000000000ed2', '00000000-0000-0000-0000-000000000e51', 'Merge Bid Three', '00000000-0000-0000-0000-000000000ec7');
-- A version for the other row, locked by the estimator: the assistant who merges may not edit it.
INSERT INTO public.bid_versions (id, bid_id, name, sort_order, customer_id, owner_user_id, locked_by, locked_at) VALUES
  ('00000000-0000-0000-0000-000000000ef1', '00000000-0000-0000-0000-000000000eb1', 'Merge B', 5, '00000000-0000-0000-0000-000000000ec6', '00000000-0000-0000-0000-000000000ed2', '00000000-0000-0000-0000-000000000ed2', now());
INSERT INTO public.bid_gcs (id, bid_id, customer_id, due_date) VALUES
  ('00000000-0000-0000-0000-000000000e61', '00000000-0000-0000-0000-000000000eb1', '00000000-0000-0000-0000-000000000ec5', '2026-12-01'),
  ('00000000-0000-0000-0000-000000000e62', '00000000-0000-0000-0000-000000000eb1', '00000000-0000-0000-0000-000000000ec6', '2026-12-05'),
  ('00000000-0000-0000-0000-000000000e63', '00000000-0000-0000-0000-000000000eb3', '00000000-0000-0000-0000-000000000ec6', '2026-12-09');
INSERT INTO public.bid_gc_recipients (id, bid_id, customer_id) VALUES
  ('00000000-0000-0000-0000-000000000e71', '00000000-0000-0000-0000-000000000eb1', '00000000-0000-0000-0000-000000000ec5'),
  ('00000000-0000-0000-0000-000000000e72', '00000000-0000-0000-0000-000000000eb1', '00000000-0000-0000-0000-000000000ec6'),
  ('00000000-0000-0000-0000-000000000e73', '00000000-0000-0000-0000-000000000eb3', '00000000-0000-0000-0000-000000000ec6');
INSERT INTO public.bid_proposal_rooms (id, bid_id, customer_id, public_token, master_user_id) VALUES
  ('00000000-0000-0000-0000-000000000e81', '00000000-0000-0000-0000-000000000eb1', '00000000-0000-0000-0000-000000000ec5', 'merge-bed-room-kept-one', '00000000-0000-0000-0000-000000000ed1'),
  ('00000000-0000-0000-0000-000000000e82', '00000000-0000-0000-0000-000000000eb1', '00000000-0000-0000-0000-000000000ec6', 'merge-bed-room-goes-one', '00000000-0000-0000-0000-000000000ed1'),
  ('00000000-0000-0000-0000-000000000e83', '00000000-0000-0000-0000-000000000eb3', '00000000-0000-0000-0000-000000000ec6', 'merge-bed-room-goes-three', '00000000-0000-0000-0000-000000000ed1');
INSERT INTO public.bids_submission_entries (bid_id, gc_customer_id, notes, created_by) VALUES
  ('00000000-0000-0000-0000-000000000eb1', '00000000-0000-0000-0000-000000000ec6', 'Called the other row.', '00000000-0000-0000-0000-000000000ed2');

-- Jobs. One is the other row's as customer, on its loosely spelled property. Two names it as the GC, on its property
-- with the legal record. Three names it as the customer and the kept row as the GC, and Four the other way round.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, hcp_number, job_name, job_address, customer_name, customer_id, gc_customer_id, bill_to_party, revenue, payments_made, status) VALUES
  ('00000000-0000-0000-0000-000000000e01', '00000000-0000-0000-0000-000000000ed1', '00000000-0000-0000-0000-000000000e51', 'MRG-1', 'Merge Job One', '1 kept rd', 'Kept Builders LLC', '00000000-0000-0000-0000-000000000ec6', NULL, 'customer', 100, 0, 'working'),
  ('00000000-0000-0000-0000-000000000e02', '00000000-0000-0000-0000-000000000ed1', '00000000-0000-0000-0000-000000000e51', 'MRG-2', 'Merge Job Two', '7 Third Ave', 'Merge Third Party', '00000000-0000-0000-0000-000000000ec7', '00000000-0000-0000-0000-000000000ec6', 'customer', 100, 0, 'working'),
  ('00000000-0000-0000-0000-000000000e03', '00000000-0000-0000-0000-000000000ed1', '00000000-0000-0000-0000-000000000e51', 'MRG-3', 'Merge Job Three', '3 Pair St', 'Kept Builders LLC', '00000000-0000-0000-0000-000000000ec6', '00000000-0000-0000-0000-000000000ec5', 'customer', 100, 0, 'working'),
  ('00000000-0000-0000-0000-000000000e04', '00000000-0000-0000-0000-000000000ed1', '00000000-0000-0000-0000-000000000e51', 'MRG-4', 'Merge Job Four', '4 Pair St', 'Kept Builders', '00000000-0000-0000-0000-000000000ec5', '00000000-0000-0000-0000-000000000ec6', 'customer', 100, 0, 'working');
UPDATE public.jobs_ledger SET customer_address_id = (SELECT id FROM public.customer_addresses WHERE customer_id = '00000000-0000-0000-0000-000000000ec6' AND is_primary)
 WHERE id = '00000000-0000-0000-0000-000000000e01';
UPDATE public.jobs_ledger SET customer_address_id = '00000000-0000-0000-0000-000000000a91' WHERE id = '00000000-0000-0000-0000-000000000e02';

-- One a customer: both rows hold a follow-up setting, a portal address and a pay calendar of their own.
INSERT INTO public.customer_followup_prefs (customer_id) VALUES ('00000000-0000-0000-0000-000000000ec5'), ('00000000-0000-0000-0000-000000000ec6');
INSERT INTO public.customer_portal_slugs (customer_id, slug) VALUES
  ('00000000-0000-0000-0000-000000000ec5', 'merge-bed-kept'), ('00000000-0000-0000-0000-000000000ec6', 'merge-bed-goes');
INSERT INTO public.customer_portal_slug_events (customer_id, event, slug) VALUES ('00000000-0000-0000-0000-000000000ec6', 'created', 'merge-bed-goes');
INSERT INTO public.payer_pay_calendars (id, payer_customer_id, job_id, pay_day) VALUES
  ('00000000-0000-0000-0000-000000000e91', '00000000-0000-0000-0000-000000000ec5', NULL, 10),
  ('00000000-0000-0000-0000-000000000e92', '00000000-0000-0000-0000-000000000ec6', NULL, 15),
  ('00000000-0000-0000-0000-000000000e93', '00000000-0000-0000-0000-000000000ec6', '00000000-0000-0000-0000-000000000e01', 20);
-- One active link an audience: both hold one for everyone, and the other row alone holds one for the GC.
INSERT INTO public.customer_portal_links (id, customer_id, audience) VALUES
  ('00000000-0000-0000-0000-000000000ea5', '00000000-0000-0000-0000-000000000ec5', 'all'),
  ('00000000-0000-0000-0000-000000000ea6', '00000000-0000-0000-0000-000000000ec6', 'all'),
  ('00000000-0000-0000-0000-000000000ea7', '00000000-0000-0000-0000-000000000ec6', 'gc');
INSERT INTO public.public_page_views (surface, entity_id, via, viewer) VALUES
  ('portal', '00000000-0000-0000-0000-000000000ec6', 'token', 'outside'), ('portal', '00000000-0000-0000-0000-000000000ec6', 'slug', 'outside');

-- One mark a week and one answer an ask: the newer word stands. The other row's mark is the newer, the kept row's
-- answer is. Two asks list the other row among their GCs, one of them with the kept row too.
INSERT INTO public.gc_statement_round_marks (id, week_start, gc_customer_id, action, acted_at) VALUES
  ('00000000-0000-0000-0000-000000000eb5', '2026-11-16', '00000000-0000-0000-0000-000000000ec5', 'contacted', '2026-11-17 10:00:00+00'),
  ('00000000-0000-0000-0000-000000000eb6', '2026-11-16', '00000000-0000-0000-0000-000000000ec6', 'sent', '2026-11-18 10:00:00+00'),
  ('00000000-0000-0000-0000-000000000eb7', '2026-11-09', '00000000-0000-0000-0000-000000000ec6', 'skipped', '2026-11-10 10:00:00+00');
INSERT INTO public.gc_word_asks (id, week_start, owner_user_id, expires_at, gc_ids) VALUES
  ('00000000-0000-0000-0000-000000000eac', '2026-11-16', '00000000-0000-0000-0000-000000000ed1', now() + interval '7 days',
   ARRAY['00000000-0000-0000-0000-000000000ec6', '00000000-0000-0000-0000-000000000ec7']::uuid[]),
  ('00000000-0000-0000-0000-000000000ead', '2026-11-23', '00000000-0000-0000-0000-000000000ed1', now() + interval '7 days',
   ARRAY['00000000-0000-0000-0000-000000000ec5', '00000000-0000-0000-0000-000000000ec6']::uuid[]);
INSERT INTO public.gc_word_ask_answers (id, ask_id, gc_customer_id, no_change, answered_at) VALUES
  ('00000000-0000-0000-0000-000000000ed5', '00000000-0000-0000-0000-000000000eac', '00000000-0000-0000-0000-000000000ec5', true, '2026-11-18 12:00:00+00'),
  ('00000000-0000-0000-0000-000000000ed6', '00000000-0000-0000-0000-000000000eac', '00000000-0000-0000-0000-000000000ec6', true, '2026-11-17 12:00:00+00');

-- One live send of a document to a customer: both hold the same one live, and the other row holds a second alone.
INSERT INTO public.document_builders (key, kind, draft) VALUES ('merge-bed-a', 'filled', '{"fields": {}}'), ('merge-bed-b', 'filled', '{"fields": {}}');
INSERT INTO public.document_builder_sends (id, builder_key, customer_id, contact_name, contact_email, sent_revision) VALUES
  ('00000000-0000-0000-0000-000000000ee5', 'merge-bed-a', '00000000-0000-0000-0000-000000000ec5', 'Kept Office', 'office@kept.test', 1),
  ('00000000-0000-0000-0000-000000000ee6', 'merge-bed-a', '00000000-0000-0000-0000-000000000ec6', 'Goes Office', 'office@goes.test', 1),
  ('00000000-0000-0000-0000-000000000ee7', 'merge-bed-b', '00000000-0000-0000-0000-000000000ec6', 'Goes Office', 'office@goes.test', 1);

-- A rating, which is never changed, under the newest published criteria (the bed makes one where none is seeded).
INSERT INTO public.difficulty_criteria_versions (version, status, body, published_at)
  SELECT 1, 'published', '{"scales": []}'::jsonb, now() WHERE NOT EXISTS (SELECT 1 FROM public.difficulty_criteria_versions WHERE status = 'published');
INSERT INTO public.gc_difficulty_ratings (id, customer_id, criteria_version_id, picks, note)
  SELECT '00000000-0000-0000-0000-000000000ef5', '00000000-0000-0000-0000-000000000ec6', v.id, '{}'::jsonb, 'Slow on the clinic.'
    FROM public.difficulty_criteria_versions v WHERE v.status = 'published' ORDER BY v.version DESC LIMIT 1;
INSERT INTO public.gc_difficulty_asks (job_id, customer_id, asked_user_id) VALUES
  ('00000000-0000-0000-0000-000000000e02', '00000000-0000-0000-0000-000000000ec6', '00000000-0000-0000-0000-000000000ed2');

-- A legal matter, keyed by its payer as the app keys it. Two requests that carry the other row in their payload: an
-- open one, which will make something when it is approved, and a closed one, which is a record. An open estimator
-- request too.
INSERT INTO public.legal_matters (id, payer_key, customer_id) VALUES
  ('00000000-0000-0000-0000-000000000ea9', 'c:00000000-0000-0000-0000-000000000ec6', '00000000-0000-0000-0000-000000000ec6');
INSERT INTO public.dispatch_requests (id, from_user_id, title, status, closed_at, pending_payload) VALUES
  ('00000000-0000-0000-0000-000000000e11', '00000000-0000-0000-0000-000000000ed2', 'Merge bed open request', 'open', NULL,
   '{"kind": "bid", "customerId": "00000000-0000-0000-0000-000000000ec6", "customerName": "Kept Builders LLC"}'),
  ('00000000-0000-0000-0000-000000000e12', '00000000-0000-0000-0000-000000000ed2', 'Merge bed closed request', 'closed', now(),
   '{"kind": "bid", "customerId": "00000000-0000-0000-0000-000000000ec6", "customerName": "Kept Builders LLC"}');
INSERT INTO public.estimator_requests (id, from_user_id, title, status, pending_payload) VALUES
  ('00000000-0000-0000-0000-000000000e13', '00000000-0000-0000-0000-000000000ed2', 'Merge bed estimator request', 'open',
   '{"kind": "bid", "customerId": "00000000-0000-0000-0000-000000000ec6"}');

-- The rest: one row each, in tables whose row went with the customer and tables whose link went blank.
INSERT INTO public.builder_customer_answers (builder_key, customer_id, answer, answered_by, name) VALUES
  ('keptbuildersllc', '00000000-0000-0000-0000-000000000ec6', 'someone_else', '00000000-0000-0000-0000-000000000ed2', 'Kept Builders LLC');
INSERT INTO public.file_index (drive_file_id, name, mime, customer_id) VALUES ('mergebedfile0001', 'Merge.pdf', 'application/pdf', '00000000-0000-0000-0000-000000000ec6');
INSERT INTO public.sent_documents (kind, how, customer_id) VALUES ('merge_bed_paper', 'email', '00000000-0000-0000-0000-000000000ec6');
INSERT INTO public.prospects (id, master_user_id, created_by, customer_id, converted_customer_id) VALUES
  ('00000000-0000-0000-0000-000000000ea8', '00000000-0000-0000-0000-000000000ed1', '00000000-0000-0000-0000-000000000ed1', '00000000-0000-0000-0000-000000000ec6', '00000000-0000-0000-0000-000000000ec6');
INSERT INTO public.job_payment_promises (job_id, promised_date, customer_id) VALUES ('00000000-0000-0000-0000-000000000e02', '2026-12-01', '00000000-0000-0000-0000-000000000ec6');
INSERT INTO public.job_payment_chase_touches (customer_id, outcome) VALUES ('00000000-0000-0000-0000-000000000ec6', 'note');
INSERT INTO public.in_kind_arrangements (customer_id, what_given) VALUES ('00000000-0000-0000-0000-000000000ec6', 'Tile work');
INSERT INTO public.developments (id, name, master_user_id, gc_customer_id) VALUES
  ('00000000-0000-0000-0000-000000000eaa', 'Merge bed development', '00000000-0000-0000-0000-000000000ed1', '00000000-0000-0000-0000-000000000ec6');
INSERT INTO public.gc_statement_email_requests (requested_by, sent_to, send_at, gc_customer_id) VALUES
  ('00000000-0000-0000-0000-000000000ed1', 'ap@goes.test', now(), '00000000-0000-0000-0000-000000000ec6');
INSERT INTO public.lien_owner_record_requests (customer_id, gc_customer_id) VALUES ('00000000-0000-0000-0000-000000000ec6', '00000000-0000-0000-0000-000000000ec6');

-- What the bed reads back: every column with a foreign key to customers that still names this one.
CREATE FUNCTION mc.still_naming(p_customer uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r record; n bigint; out text := '';
BEGIN
  FOR r IN SELECT * FROM public.customer_reference_columns() LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.tbl, r.col) INTO n USING p_customer;
    IF n > 0 THEN out := out || r.key || '=' || n || ' '; END IF;
  END LOOP;
  RETURN btrim(out);
END $$;

-- 7 · The catalog. A column that points at a customer, on a table that lets a customer hold one row of something,
-- must be one the merge has a rule for. A table added later with such a rule fails here until the merge is taught it.
SELECT mc.same('every one-a-customer rule is one the merge knows',
  (SELECT COALESCE(string_agg(DISTINCT r.key, ', ' ORDER BY r.key), '')
     FROM public.customer_reference_columns() r
     JOIN pg_index i ON i.indrelid = r.tbl AND i.indisunique
    WHERE pg_get_indexdef(i.indexrelid) ~ ('\m' || r.col::text || '\M')
      AND r.key NOT IN ('bid_gc_recipients.customer_id', 'bid_gcs.customer_id', 'bid_proposal_rooms.customer_id', 'contacts.customer_id',
                        'customer_addresses.customer_id', 'customer_followup_prefs.customer_id', 'customer_portal_links.customer_id',
                        'customer_portal_slugs.customer_id', 'document_builder_sends.customer_id', 'gc_statement_round_marks.gc_customer_id',
                        'gc_word_ask_answers.gc_customer_id', 'payer_pay_calendars.payer_customer_id')),
  '');
SELECT mc.same('the list of references is the catalog''s, and it is not small',
  ((SELECT count(*) FROM public.customer_reference_columns()) >= 46)::text, 'true');

-- 8 · The three guards still refuse an edit, with the merge's flag down and with it up.
SELECT mc.as_user('00000000-0000-0000-0000-000000000ed3');
SELECT mc.refused('a rating is still never changed',
  $q$UPDATE public.gc_difficulty_ratings SET note = 'Changed.' WHERE id = '00000000-0000-0000-0000-000000000ef5'$q$, 'A rating is never changed');
SELECT mc.refused('a version locked by someone else is still theirs',
  $q$UPDATE public.bid_versions SET name = 'Mine now' WHERE id = '00000000-0000-0000-0000-000000000ef1'$q$, 'locked the version');
SELECT mc.refused('a send is still changed only by sending again',
  $q$UPDATE public.document_builder_sends SET contact_name = 'Changed' WHERE id = '00000000-0000-0000-0000-000000000ee7'$q$, 'A send is changed only by sending again');
SELECT set_config('app.merging_customers', '1', true);
SELECT mc.refused('with the flag up, a rating''s words are still never changed',
  $q$UPDATE public.gc_difficulty_ratings SET note = 'Changed.', customer_id = '00000000-0000-0000-0000-000000000ec5' WHERE id = '00000000-0000-0000-0000-000000000ef5'$q$, 'A rating is never changed');
SELECT mc.refused('with the flag up, a locked version''s name is still theirs',
  $q$UPDATE public.bid_versions SET name = 'Mine now', customer_id = '00000000-0000-0000-0000-000000000ec5' WHERE id = '00000000-0000-0000-0000-000000000ef1'$q$, 'locked the version');
SELECT mc.refused('with the flag up, a send''s words are still changed only by sending again',
  $q$UPDATE public.document_builder_sends SET contact_name = 'Changed', customer_id = '00000000-0000-0000-0000-000000000ec5' WHERE id = '00000000-0000-0000-0000-000000000ee7'$q$, 'A send is changed only by sending again');
SELECT set_config('app.merging_customers', '', true);

-- 9 · The preview says what the row that goes holds and what the rules will do, before anything moves.
SET LOCAL ROLE authenticated;
SELECT public.preview_merge_customers('00000000-0000-0000-0000-000000000ec5', '00000000-0000-0000-0000-000000000ec6')::text AS preview \gset
RESET ROLE;
SELECT mc.same('the preview still answers the six counts it always did',
  (SELECT concat_ws('|', r->'victim_counts'->>'bids', r->'victim_counts'->>'jobs_ledger', r->'victim_counts'->>'projects', r->>'stripe_blocked') FROM (SELECT :'preview'::jsonb AS r) p),
  '1|2|0|false');
SELECT mc.same('the preview says what the rules will do',
  (SELECT string_agg(k || '=' || v, ' ' ORDER BY k COLLATE "C") FROM jsonb_each_text(:'preview'::jsonb -> 'left_behind') AS e(k, v)),
  'ask_answer=1 bid_gc_line=1 bid_recipient=1 document_send=1 followup_prefs=1 pay_calendar=1 portal_address=1 portal_link=1 property=1 proposal_room=1 week_mark=1');
SELECT mc.same('the preview names the portal address that stops answering, the jobs that name both, and no legal block',
  (SELECT concat_ws('|', r->>'portal_address_lost', r->>'same_job', r->>'legal_blocked') FROM (SELECT :'preview'::jsonb AS r) p), 'merge-bed-goes|2|false');
SELECT mc.same('the preview counts what the row holds, the references with no foreign key among them',
  (SELECT concat_ws('|', h->>'jobs_ledger.customer_id', h->>'jobs_ledger.gc_customer_id', h->>'customer_addresses.customer_id', h->>'prospects.converted_customer_id',
                         h->>'public_page_views.entity_id', h->>'legal_matters.payer_key', h->>'gc_word_asks.gc_ids', h->>'dispatch_requests.pending_payload', h->>'estimator_requests.pending_payload')
     FROM (SELECT :'preview'::jsonb -> 'holds' AS h) p),
  '2|2|3|1|2|1|2|1|1');
SELECT mc.same('nothing moved for the preview', (mc.still_naming('00000000-0000-0000-0000-000000000ec6') <> '')::text, 'true');

-- 10 · The assistant merges. A dev could unlock the version; an assistant cannot, and the merge still carries it.
SET LOCAL ROLE authenticated;
SELECT public.merge_customers('00000000-0000-0000-0000-000000000ec5', '00000000-0000-0000-0000-000000000ec6', '{}'::jsonb)::text AS merged \gset
RESET ROLE;
SELECT mc.same('the merge answers with the pair', (SELECT concat_ws('|', r->>'survivor_id', r->>'removed_id') FROM (SELECT :'merged'::jsonb AS r) m),
  '00000000-0000-0000-0000-000000000ec5|00000000-0000-0000-0000-000000000ec6');
SELECT mc.same('the merge answers with the plan the preview gave',
  ((:'merged'::jsonb) - 'survivor_id' - 'removed_id' - 'moved')::text,
  ((:'preview'::jsonb) - 'victim_counts' - 'victim_has_stripe' - 'survivor_has_stripe' - 'stripe_blocked')::text);
SELECT mc.same('the merge left its flag down', COALESCE(current_setting('app.merging_customers', true), ''), '');

-- 11 · The row is gone and nothing names it: no column with a foreign key, no page view, no legal key, no ask, no
-- open request.
SELECT mc.same('the other row is gone', (SELECT count(*)::text FROM public.customers WHERE id = '00000000-0000-0000-0000-000000000ec6'), '0');
SELECT mc.same('no column that points at a customer still names it', mc.still_naming('00000000-0000-0000-0000-000000000ec6'), '');
SELECT mc.same('the page views name the kept customer',
  (SELECT string_agg(entity_id::text, ',' ORDER BY via) FROM public.public_page_views WHERE entity_id IN ('00000000-0000-0000-0000-000000000ec5', '00000000-0000-0000-0000-000000000ec6')),
  '00000000-0000-0000-0000-000000000ec5,00000000-0000-0000-0000-000000000ec5');
SELECT mc.same('the legal matter is the kept customer''s, under its key',
  (SELECT concat_ws('|', customer_id, payer_key) FROM public.legal_matters WHERE id = '00000000-0000-0000-0000-000000000ea9'),
  '00000000-0000-0000-0000-000000000ec5|c:00000000-0000-0000-0000-000000000ec5');
SELECT mc.same('the asks list the kept customer once, in the other row''s place',
  (SELECT string_agg(right(id::text, 3) || ':' || array_to_string(ARRAY(SELECT right(g::text, 3) FROM unnest(gc_ids) WITH ORDINALITY u(g, n) ORDER BY n), '+'), ',' ORDER BY id) FROM public.gc_word_asks
    WHERE id IN ('00000000-0000-0000-0000-000000000eac', '00000000-0000-0000-0000-000000000ead')),
  'eac:ec5+ec7,ead:ec5');
SELECT mc.same('the open requests carry the kept customer, and the closed one is as it was written',
  (SELECT string_agg(right(id::text, 3) || ':' || right(pending_payload->>'customerId', 3), ',' ORDER BY id) FROM (
     SELECT id, pending_payload FROM public.dispatch_requests WHERE id IN ('00000000-0000-0000-0000-000000000e11', '00000000-0000-0000-0000-000000000e12')
     UNION ALL SELECT id, pending_payload FROM public.estimator_requests WHERE id = '00000000-0000-0000-0000-000000000e13') q),
  'e11:ec5,e12:ec6,e13:ec5');

-- 12 · What moved, by column. A row a rule dropped is not counted, and a folded property is not either.
SELECT mc.same('what moved, by column',
  (SELECT string_agg(k || '=' || v, ' ' ORDER BY k COLLATE "C") FROM jsonb_each_text(:'merged'::jsonb -> 'moved') AS e(k, v)),
  'bid_gc_recipients.customer_id=1 bid_gcs.customer_id=1 bid_proposal_rooms.customer_id=2 bid_versions.customer_id=1 bids.customer_id=1 '
  'bids_submission_entries.gc_customer_id=1 builder_customer_answers.customer_id=1 customer_addresses.customer_id=2 '
  'customer_portal_links.customer_id=2 customer_portal_slug_events.customer_id=1 developments.gc_customer_id=1 '
  'dispatch_requests.pending_payload=1 document_builder_sends.customer_id=2 estimator_requests.pending_payload=1 file_index.customer_id=1 '
  'gc_difficulty_asks.customer_id=1 gc_difficulty_ratings.customer_id=1 gc_statement_email_requests.gc_customer_id=1 '
  'gc_statement_round_marks.gc_customer_id=2 gc_word_asks.gc_ids=2 in_kind_arrangements.customer_id=1 '
  'job_payment_chase_touches.customer_id=1 job_payment_promises.customer_id=1 jobs_ledger.customer_id=2 jobs_ledger.gc_customer_id=2 '
  'legal_matters.customer_id=1 legal_matters.payer_key=1 lien_owner_record_requests.customer_id=1 lien_owner_record_requests.gc_customer_id=1 '
  'payer_pay_calendars.payer_customer_id=1 prospects.converted_customer_id=1 prospects.customer_id=1 public_page_views.entity_id=2 '
  'sent_documents.customer_id=1');

-- 13 · Every row a rule dropped is kept in the deleted-records archive, in one bundle with the customer row that went.
SELECT mc.same('the archive keeps every dropped row with the customer row',
  (SELECT string_agg(table_name || '=' || n, ' ' ORDER BY table_name COLLATE "C") FROM (
     SELECT table_name, count(*) AS n FROM public.deleted_records_archive WHERE group_key = '00000000-0000-0000-0000-000000000ec6' GROUP BY table_name) a),
  'bid_gc_recipients=1 bid_gcs=1 customer_addresses=1 customer_followup_prefs=1 customer_portal_slugs=1 customers=1 gc_statement_round_marks=1 gc_word_ask_answers=1 payer_pay_calendars=1');
SELECT mc.same('an archived row is the whole row: the portal address that stopped answering, the older mark, the dropped due date',
  (SELECT string_agg(v, ',' ORDER BY v COLLATE "C") FROM (
     SELECT row_data->>'slug' AS v FROM public.deleted_records_archive WHERE group_key = '00000000-0000-0000-0000-000000000ec6' AND table_name = 'customer_portal_slugs'
     UNION ALL SELECT row_data->>'action' FROM public.deleted_records_archive WHERE group_key = '00000000-0000-0000-0000-000000000ec6' AND table_name = 'gc_statement_round_marks'
     UNION ALL SELECT row_data->>'due_date' FROM public.deleted_records_archive WHERE group_key = '00000000-0000-0000-0000-000000000ec6' AND table_name = 'bid_gcs') x),
  '2026-12-05,contacted,merge-bed-goes');

-- 14 · The three a guard held: the locked version, the rating and the send moved, and nothing else on them changed.
SELECT mc.same('the locked version moved and is still locked by the estimator',
  (SELECT concat_ws('|', customer_id, name, locked_by) FROM public.bid_versions WHERE id = '00000000-0000-0000-0000-000000000ef1'),
  '00000000-0000-0000-0000-000000000ec5|Merge B|00000000-0000-0000-0000-000000000ed2');
SELECT mc.same('the rating moved with its words',
  (SELECT concat_ws('|', customer_id, note) FROM public.gc_difficulty_ratings WHERE id = '00000000-0000-0000-0000-000000000ef5'),
  '00000000-0000-0000-0000-000000000ec5|Slow on the clinic.');
SELECT mc.same('the sends: the kept one live, the duplicate taken off and kept, the other''s own still live',
  (SELECT string_agg(concat_ws('|', right(id::text, 3), customer_id, builder_key, (taken_off_at IS NULL)::text, contact_name), ',' ORDER BY id) FROM public.document_builder_sends
    WHERE id IN ('00000000-0000-0000-0000-000000000ee5', '00000000-0000-0000-0000-000000000ee6', '00000000-0000-0000-0000-000000000ee7')),
  'ee5|00000000-0000-0000-0000-000000000ec5|merge-bed-a|true|Kept Office,'
  'ee6|00000000-0000-0000-0000-000000000ec5|merge-bed-a|false|Goes Office,'
  'ee7|00000000-0000-0000-0000-000000000ec5|merge-bed-b|true|Goes Office');

-- 15 · One a customer: the kept customer's own stands.
SELECT mc.same('one follow-up setting, one portal address and one pay calendar of its own, the kept customer''s',
  concat_ws('|', (SELECT count(*) FROM public.customer_followup_prefs WHERE customer_id = '00000000-0000-0000-0000-000000000ec5'),
    (SELECT slug FROM public.customer_portal_slugs WHERE customer_id = '00000000-0000-0000-0000-000000000ec5'),
    (SELECT string_agg(pay_day::text || coalesce(':' || right(job_id::text, 3), ''), ',' ORDER BY pay_day) FROM public.payer_pay_calendars WHERE payer_customer_id = '00000000-0000-0000-0000-000000000ec5')),
  '1|merge-bed-kept|10,20:e01');
SELECT mc.same('the other row''s portal address is gone, and its history came over',
  concat_ws('|', (SELECT count(*) FROM public.customer_portal_slugs WHERE slug = 'merge-bed-goes'),
    (SELECT count(*) FROM public.customer_portal_slug_events WHERE customer_id = '00000000-0000-0000-0000-000000000ec5' AND slug = 'merge-bed-goes')),
  '0|1');
SELECT mc.same('the portal links: the kept one for everyone is live, the other''s is off and kept, its GC link is live',
  (SELECT string_agg(concat_ws('|', right(id::text, 3), audience, (revoked_at IS NULL)::text), ',' ORDER BY id) FROM public.customer_portal_links WHERE customer_id = '00000000-0000-0000-0000-000000000ec5'),
  'ea5|all|true,ea6|all|false,ea7|gc|true');

-- 16 · The newer word stands: the other row's mark for the week replaced the kept row's, and the kept row's answer stood.
SELECT mc.same('the week''s marks',
  (SELECT string_agg(concat_ws('|', right(id::text, 3), week_start, action), ',' ORDER BY week_start, id) FROM public.gc_statement_round_marks WHERE gc_customer_id = '00000000-0000-0000-0000-000000000ec5'),
  'eb7|2026-11-09|skipped,eb6|2026-11-16|sent');
SELECT mc.same('the ask''s answer',
  (SELECT string_agg(right(id::text, 3), ',') FROM public.gc_word_ask_answers WHERE ask_id = '00000000-0000-0000-0000-000000000eac'), 'ed5');

-- 17 · A bid both were on keeps one line for the kept customer, and one open room. The other bid's line and room came over.
SELECT mc.same('the lines on the bids',
  concat_ws(' ', (SELECT string_agg(right(id::text, 3), ',' ORDER BY id) FROM public.bid_gcs WHERE customer_id = '00000000-0000-0000-0000-000000000ec5'),
    (SELECT string_agg(right(id::text, 3), ',' ORDER BY id) FROM public.bid_gc_recipients WHERE customer_id = '00000000-0000-0000-0000-000000000ec5')),
  'e61,e63 e71,e73');
SELECT mc.same('the rooms: the duplicate closed and kept, the others open',
  (SELECT string_agg(right(id::text, 3) || ':' || (closed_at IS NULL)::text, ',' ORDER BY id) FROM public.bid_proposal_rooms WHERE customer_id = '00000000-0000-0000-0000-000000000ec5'),
  'e81:true,e82:false,e83:true');
SELECT mc.same('the other row''s own bid is the kept customer''s', (SELECT customer_id::text FROM public.bids WHERE id = '00000000-0000-0000-0000-000000000eb2'), '00000000-0000-0000-0000-000000000ec5');

-- 18 · Properties. The kept customer keeps its starred one. The loosely spelled copy folded into it, and the job that
-- named the copy names the kept one. The property with a legal record came whole, still named by its job. The one both
-- spell alike came too and was not folded, since its parcel is something the kept row's copy lacks.
SELECT mc.same('the kept customer''s properties',
  (SELECT string_agg(concat_ws('|', address, is_primary::text, legal_description, parcel_id), ',' ORDER BY lower(address) COLLATE "C", parcel_id COLLATE "C") FROM public.customer_addresses WHERE customer_id = '00000000-0000-0000-0000-000000000ec5'),
  '1 Kept Rd|true||,5 Shared Ct|false||,5 shared ct|false||P-55,9 Other Way|false|LOT 9 BLOCK 2|');
SELECT mc.same('the job on the folded property names the kept one, and the other job its own',
  (SELECT string_agg(right(j.id::text, 3) || ':' || a.address, ',' ORDER BY j.id) FROM public.jobs_ledger j JOIN public.customer_addresses a ON a.id = j.customer_address_id
    WHERE j.id IN ('00000000-0000-0000-0000-000000000e01', '00000000-0000-0000-0000-000000000e02')),
  'e01:1 Kept Rd,e02:9 Other Way');
SELECT mc.same('the kept customer''s address is as it was', (SELECT address FROM public.customers WHERE id = '00000000-0000-0000-0000-000000000ec5'), '1 Kept Rd');

-- 19 · Jobs. One is the kept customer's. Two names it as the GC. Three and Four named the two rows as customer and GC:
-- a job never names one row as both, so each names the GC alone and bills the GC.
SELECT mc.same('the jobs',
  (SELECT string_agg(concat_ws('|', right(id::text, 3), coalesce(right(customer_id::text, 3), '-'), coalesce(right(gc_customer_id::text, 3), '-'), bill_to_party), ',' ORDER BY id) FROM public.jobs_ledger
    WHERE id IN ('00000000-0000-0000-0000-000000000e01', '00000000-0000-0000-0000-000000000e02', '00000000-0000-0000-0000-000000000e03', '00000000-0000-0000-0000-000000000e04')),
  'e01|ec5|-|customer,e02|ec7|ec5|customer,e03|-|ec5|gc,e04|-|ec5|gc');

-- 20 · A table the merge has never heard of. One made here, pointing at customers, is carried like the rest. One that
-- lets a customer hold a single row stops the merge with its name, and nothing is changed.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-000000000ec8', 'Later Keeper', '00000000-0000-0000-0000-000000000ed1'),
  ('00000000-0000-0000-0000-000000000ec9', 'Later Goer', '00000000-0000-0000-0000-000000000ed1');
CREATE TABLE public.merge_bed_later (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE, note text);
CREATE TABLE public.merge_bed_single (customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE, note text);
INSERT INTO public.merge_bed_later (customer_id, note) VALUES ('00000000-0000-0000-0000-000000000ec9', 'carried');
INSERT INTO public.merge_bed_single (customer_id, note) VALUES ('00000000-0000-0000-0000-000000000ec8', 'kept'), ('00000000-0000-0000-0000-000000000ec9', 'goes');
SELECT mc.as_user('00000000-0000-0000-0000-000000000ed1');
SELECT mc.refused('a table that lets a customer hold one row, with no rule, stops the merge by name',
  $q$SELECT public.merge_customers('00000000-0000-0000-0000-000000000ec8', '00000000-0000-0000-0000-000000000ec9', '{}'::jsonb)$q$,
  'cannot carry merge_bed_single.customer_id');
SELECT mc.same('and nothing was changed by the refused merge',
  concat_ws('|', (SELECT count(*) FROM public.customers WHERE id = '00000000-0000-0000-0000-000000000ec9'), (SELECT customer_id::text FROM public.merge_bed_later)),
  '1|00000000-0000-0000-0000-000000000ec9');
DROP TABLE public.merge_bed_single;
SELECT mc.same('a table the merge never heard of is carried',
  (SELECT r->'moved'->>'merge_bed_later.customer_id' FROM (SELECT public.merge_customers('00000000-0000-0000-0000-000000000ec8', '00000000-0000-0000-0000-000000000ec9', '{}'::jsonb) AS r) s), '1');
SELECT mc.same('and its row names the kept customer', (SELECT customer_id::text FROM public.merge_bed_later), '00000000-0000-0000-0000-000000000ec8');
DROP TABLE public.merge_bed_later;

-- 21 · Two rows that each hold a legal matter. A payer holds one, so the preview says the merge is blocked, and the
-- merge is refused with the words that say why. Nothing is changed.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-000000000eca', 'Legal Keeper', '00000000-0000-0000-0000-000000000ed1'),
  ('00000000-0000-0000-0000-000000000ecb', 'Legal Goer', '00000000-0000-0000-0000-000000000ed1');
INSERT INTO public.legal_matters (id, payer_key, customer_id) VALUES
  ('00000000-0000-0000-0000-000000000ebb', 'c:00000000-0000-0000-0000-000000000eca', '00000000-0000-0000-0000-000000000eca'),
  ('00000000-0000-0000-0000-000000000ebc', 'c:00000000-0000-0000-0000-000000000ecb', '00000000-0000-0000-0000-000000000ecb');
SELECT mc.same('the preview says both hold a legal matter',
  (SELECT public.preview_merge_customers('00000000-0000-0000-0000-000000000eca', '00000000-0000-0000-0000-000000000ecb')->>'legal_blocked'), 'true');
SELECT mc.refused('two rows that each hold a legal matter are not merged',
  $q$SELECT public.merge_customers('00000000-0000-0000-0000-000000000eca', '00000000-0000-0000-0000-000000000ecb', '{}'::jsonb)$q$,
  'one payer can hold only one');
SELECT mc.same('and both rows and both matters are as they were',
  (SELECT string_agg(right(m.id::text, 3) || ':' || right(m.payer_key, 3) || ':' || right(c.id::text, 3), ',' ORDER BY m.id) FROM public.legal_matters m JOIN public.customers c ON c.id = m.customer_id
    WHERE m.id IN ('00000000-0000-0000-0000-000000000ebb', '00000000-0000-0000-0000-000000000ebc')),
  'ebb:eca:eca,ebc:ecb:ecb');

DO $$ BEGIN RAISE NOTICE 'merge_customers PASSED'; END $$;
ROLLBACK;
