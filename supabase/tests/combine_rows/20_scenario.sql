-- A combine moves every row that would have gone with the source job's delete (punch list #252, migrations
-- *_combine_moves_every_row, *_combine_moves_money_and_legal_rows and *_combine_names_set_aside_desk_drafts). Two
-- combines and a split on made-up jobs: the
-- first combine onto a target with none of the one-per-job rows (they move), a split that moves a line and its window,
-- a combine refused three times in turn (a work order, an open agreement, a pay application on both jobs; nothing
-- moves), and a second combine onto a target that holds every merge case, the money and legal rows among them. Each
-- assertion writes down a miss and goes on; the last statement raises with the whole list, so one run says
-- everything. Ends with "combine_rows PASSED". Fixtures are written as postgres; the combines and the split run as
-- the dev; everything rolls back. See scripts/pgtest-combine-rows.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev and the one combining. Mo is the master the jobs and the customer belong to. Hal and Sal watch jobs.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000252a01', 'dee@combine.test'),
  ('00000000-0000-0000-0000-000000252a02', 'mo@combine.test'),
  ('00000000-0000-0000-0000-000000252a03', 'hal@combine.test'),
  ('00000000-0000-0000-0000-000000252a04', 'sal@combine.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-000000252a01', 'dee@combine.test', 'Dee Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-000000252a02', 'mo@combine.test', 'Mo Master', 'master_technician', false, false),
  ('00000000-0000-0000-0000-000000252a03', 'hal@combine.test', 'Hal Helper', 'helpers', false, false),
  ('00000000-0000-0000-0000-000000252a04', 'sal@combine.test', 'Sal Super', 'superintendent', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-000000252f09', 'Combine Bed Work');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-000000252c01', '00000000-0000-0000-0000-000000252a02', 'Combine Bed Customer');
INSERT INTO public.contacts (id, kind, customer_id, name) VALUES
  ('00000000-0000-0000-0000-000000252c11', 'customer', '00000000-0000-0000-0000-000000252c01', 'Kay Contact'),
  ('00000000-0000-0000-0000-000000252c12', 'customer', '00000000-0000-0000-0000-000000252c01', 'Kim Contact');
INSERT INTO public.supply_houses (id, name) VALUES
  ('00000000-0000-0000-0000-000000252d01', 'Combine Bed Supply One'),
  ('00000000-0000-0000-0000-000000252d02', 'Combine Bed Supply Two');
INSERT INTO public.supply_house_invoices (id, supply_house_id, invoice_number, invoice_date, amount) VALUES
  ('00000000-0000-0000-0000-000000252d11', '00000000-0000-0000-0000-000000252d01', 'CB-1', '2026-10-01', 100);
INSERT INTO public.people (id, master_user_id, kind, name) VALUES ('00000000-0000-0000-0000-000000252e01', '00000000-0000-0000-0000-000000252a02', 'sub', 'Pat Sub');

-- T is the target. S0 is the first source, S the second.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id, status, hcp_number) VALUES
  ('00000000-0000-0000-0000-000000252b01', '00000000-0000-0000-0000-000000252a02', '00000000-0000-0000-0000-000000252f09', 'Combine bed target', '00000000-0000-0000-0000-000000252c01', 'working', '9101'),
  ('00000000-0000-0000-0000-000000252b02', '00000000-0000-0000-0000-000000252a02', '00000000-0000-0000-0000-000000252f09', 'Combine bed first source', '00000000-0000-0000-0000-000000252c01', 'working', '9102'),
  ('00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252a02', '00000000-0000-0000-0000-000000252f09', 'Combine bed source', '00000000-0000-0000-0000-000000252c01', 'working', '9103');
INSERT INTO public.jobs_ledger_fixtures (id, job_id, name) VALUES
  ('00000000-0000-0000-0000-000000252e11', '00000000-0000-0000-0000-000000252b03', 'Rough In'),
  ('00000000-0000-0000-0000-000000252e12', '00000000-0000-0000-0000-000000252b03', 'Top Out'),
  ('00000000-0000-0000-0000-000000252e21', '00000000-0000-0000-0000-000000252b01', 'Trim Set');
INSERT INTO public.job_stage_windows (id, job_id, fixture_id, window_start, window_end) VALUES
  ('00000000-0000-0000-0000-000000252e31', '00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252e11', '2026-11-10', '2026-11-14'),
  ('00000000-0000-0000-0000-000000252e32', '00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252e12', '2026-11-17', '2026-11-21'),
  ('00000000-0000-0000-0000-000000252e33', '00000000-0000-0000-0000-000000252b01', '00000000-0000-0000-0000-000000252e21', '2026-12-01', '2026-12-05');

CREATE SCHEMA cr;
CREATE TABLE cr.lost (n serial PRIMARY KEY, what text NOT NULL);
-- An assertion writes down a miss and goes on; the last statement raises with the whole list.
CREATE FUNCTION cr.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN
    INSERT INTO cr.lost (what) VALUES (format('%s: got %s, want %s', label, coalesce(got, 'nothing'), coalesce(want, 'nothing')));
    RAISE NOTICE 'LOST: %: got %, want %', label, got, want;
    RETURN;
  END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION cr.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;

-- ── 1. The first combine: S0 holds the one-per-job rows and T none of them, so each moves. ──────────────────────────
INSERT INTO public.plan_parts (id, job_id, name) VALUES ('00000000-0000-0000-0000-000000252f01', '00000000-0000-0000-0000-000000252b02', 'Combine bed first part');
INSERT INTO public.plan_sets (id, part_id, name, kind, source) VALUES ('00000000-0000-0000-0000-000000252f11', '00000000-0000-0000-0000-000000252f01', 'First issued set', 'issued', 'gc');
UPDATE public.plan_parts SET current_set_id = '00000000-0000-0000-0000-000000252f11' WHERE id = '00000000-0000-0000-0000-000000252f01';
UPDATE public.jobs_ledger SET plan_part_id = '00000000-0000-0000-0000-000000252f01' WHERE id = '00000000-0000-0000-0000-000000252b02';
INSERT INTO public.job_baselines (job_id, kept_on, grade, team_hours) VALUES ('00000000-0000-0000-0000-000000252b02', 'kept', 'per_thousand', 12);
INSERT INTO public.job_budgets (job_id, kind, labor_hours) VALUES ('00000000-0000-0000-0000-000000252b02', 'typed', 40);
INSERT INTO public.job_property_owners (job_id, owner_name) VALUES ('00000000-0000-0000-0000-000000252b02', 'First Owner');
INSERT INTO public.photo_saves (jobs_ledger_id, on_since) VALUES ('00000000-0000-0000-0000-000000252b02', now());
-- The promised pay date logs a promise as it is written; both come over. The claim correction is one per job too.
INSERT INTO public.job_promised_pay_dates (job_id, promised_date, marked_at) VALUES ('00000000-0000-0000-0000-000000252b02', '2026-11-14', '2026-10-01 10:00+00');
INSERT INTO public.job_lien_claim_corrections (job_id, amount_off, reason) VALUES ('00000000-0000-0000-0000-000000252b02', 15, 'Bed correction first');

SELECT cr.as_user('00000000-0000-0000-0000-000000252a01');
SET LOCAL ROLE authenticated;
SELECT public.migrate_job_ledger_costs_and_delete('00000000-0000-0000-0000-000000252b02', '00000000-0000-0000-0000-000000252b01') AS combine_one \gset
RESET ROLE;
SELECT cr.same('the first combine says ok', coalesce(:'combine_one'::jsonb ->> 'error', :'combine_one'::jsonb ->> 'ok'), 'true');
SELECT cr.same('the first source is gone', (SELECT count(*)::text FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-000000252b02'), '0');
SELECT cr.same('a target with no plan part takes the source''s', (SELECT job_id::text FROM public.plan_parts WHERE id = '00000000-0000-0000-0000-000000252f01'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('and names it', (SELECT plan_part_id::text FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-000000252b01'), '00000000-0000-0000-0000-000000252f01');
SELECT cr.same('the part still builds from its set', (SELECT current_set_id::text FROM public.plan_parts WHERE id = '00000000-0000-0000-0000-000000252f01'), '00000000-0000-0000-0000-000000252f11');
SELECT cr.same('a target with no baseline takes the source''s', (SELECT job_id::text FROM public.job_baselines WHERE team_hours = 12), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a target with no budget takes the source''s', (SELECT job_id::text FROM public.job_budgets WHERE labor_hours = 40), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a target with no property owner takes the source''s', (SELECT job_id::text FROM public.job_property_owners WHERE owner_name = 'First Owner'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a target with no photo-save tick takes the source''s', (SELECT count(*)::text FROM public.photo_saves WHERE jobs_ledger_id = '00000000-0000-0000-0000-000000252b01'), '1');
SELECT cr.same('a target with no promised pay date takes the source''s', (SELECT promised_date::text FROM public.job_promised_pay_dates WHERE job_id = '00000000-0000-0000-0000-000000252b01'), '2026-11-14');
SELECT cr.same('and the promise it logged came over', (SELECT count(*)::text FROM public.job_payment_promises WHERE job_id = '00000000-0000-0000-0000-000000252b01' AND promised_date = '2026-11-14'), '1');
SELECT cr.same('a target with no claim correction takes the source''s', (SELECT amount_off::text FROM public.job_lien_claim_corrections WHERE job_id = '00000000-0000-0000-0000-000000252b01'), '15');

-- ── 2. A split moves a line, and its window follows. ────────────────────────────────────────────────────────────────
SELECT cr.as_user('00000000-0000-0000-0000-000000252a01');
SET LOCAL ROLE authenticated;
SELECT public.split_job_ledger_fixtures_to_new_job('00000000-0000-0000-0000-000000252b03', ARRAY['00000000-0000-0000-0000-000000252e12']::uuid[], '9104', 'Combine bed split job', '1 Bed Lane') AS split_reply \gset
RESET ROLE;
SELECT cr.same('the split says ok', coalesce(:'split_reply'::jsonb ->> 'error', :'split_reply'::jsonb ->> 'ok'), 'true');
SELECT coalesce(:'split_reply'::jsonb ->> 'new_job_id', '') AS job_b \gset
SELECT cr.same('the Top Out line is on the new job', (SELECT job_id::text FROM public.jobs_ledger_fixtures WHERE id = '00000000-0000-0000-0000-000000252e12'), :'job_b');
SELECT cr.same('its window followed the line', (SELECT job_id::text FROM public.job_stage_windows WHERE id = '00000000-0000-0000-0000-000000252e32'), :'job_b');
SELECT cr.same('the Rough In window stayed with its line on the source', (SELECT job_id::text FROM public.job_stage_windows WHERE id = '00000000-0000-0000-0000-000000252e31'), '00000000-0000-0000-0000-000000252b03');

-- ── 3. The second combine: S holds a row of every kind, and T already holds the one-per-job and keyed rows. ─────────
-- Plans: T has part f01 (set f11 current); S has part f02 with an issued set and an as-built S made.
INSERT INTO public.plan_parts (id, job_id, name) VALUES ('00000000-0000-0000-0000-000000252f02', '00000000-0000-0000-0000-000000252b03', 'Combine bed source part');
INSERT INTO public.plan_sets (id, part_id, name, kind, source, job_id) VALUES
  ('00000000-0000-0000-0000-000000252f12', '00000000-0000-0000-0000-000000252f02', 'Source issued set', 'issued', 'gc', NULL),
  ('00000000-0000-0000-0000-000000252f13', '00000000-0000-0000-0000-000000252f02', 'Source as-built', 'as_built', 'ours', '00000000-0000-0000-0000-000000252b03');
UPDATE public.plan_parts SET current_set_id = '00000000-0000-0000-0000-000000252f12' WHERE id = '00000000-0000-0000-0000-000000252f02';
UPDATE public.jobs_ledger SET plan_part_id = '00000000-0000-0000-0000-000000252f02' WHERE id = '00000000-0000-0000-0000-000000252b03';
-- One per job, T has each: the source's goes.
INSERT INTO public.job_baselines (job_id, kept_on, grade, team_hours) VALUES ('00000000-0000-0000-0000-000000252b03', 'kept', 'per_thousand', 99);
INSERT INTO public.job_budgets (job_id, kind, labor_hours) VALUES ('00000000-0000-0000-0000-000000252b03', 'typed', 77);
INSERT INTO public.job_property_owners (job_id, owner_name) VALUES ('00000000-0000-0000-0000-000000252b03', 'Second Owner');
INSERT INTO public.photo_saves (id, jobs_ledger_id, on_since) VALUES ('00000000-0000-0000-0000-000000252f21', '00000000-0000-0000-0000-000000252b03', now());
-- History and records: a plain move.
INSERT INTO public.job_activity_events (id, job_id, event_type, summary, detail) VALUES
  ('00000000-0000-0000-0000-000000252e41', '00000000-0000-0000-0000-000000252b03', 'note_added', 'Combine bed note event', '{"source_id": "cb-1"}'),
  ('00000000-0000-0000-0000-000000252e42', '00000000-0000-0000-0000-000000252b03', 'status_changed', 'Combine bed status event', '{}');
INSERT INTO public.job_pct_events (id, job_id, pct, source) VALUES ('00000000-0000-0000-0000-000000252e43', '00000000-0000-0000-0000-000000252b03', 40, 'manual');
INSERT INTO public.job_followup_reviews (id, job_id) VALUES ('00000000-0000-0000-0000-000000252e44', '00000000-0000-0000-0000-000000252b03');
INSERT INTO public.job_test_reports (id, job_id, test_type, test_date) VALUES ('00000000-0000-0000-0000-000000252e45', '00000000-0000-0000-0000-000000252b03', 'pre_test', '2026-10-30');
INSERT INTO public.job_share_links (id, job_id, token_hash, created_by) VALUES ('00000000-0000-0000-0000-000000252e46', '00000000-0000-0000-0000-000000252b03', repeat('a', 64), '00000000-0000-0000-0000-000000252a01');
INSERT INTO public.job_photo_notes (id, job_id, fixture_id, description) VALUES ('00000000-0000-0000-0000-000000252e47', '00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252e11', 'Combine bed photo');
INSERT INTO public.job_hazmat_incidents (id, job_id, description, tos_clause_snapshot, fee_amount) VALUES ('00000000-0000-0000-0000-000000252e48', '00000000-0000-0000-0000-000000252b03', 'Combine bed incident', 'The clause as it read', 250);
INSERT INTO public.hours_statements (id, record_id, job_ledger_id, user_id, period_start, period_end, kind) VALUES
  ('00000000-0000-0000-0000-000000252e49', 'HS-9103-1', '00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252a03', '2026-10-01', '2026-10-07', 'clock');
INSERT INTO public.material_po_generator_entries (id, po_code, job_ledger_id, for_user_id, created_by) VALUES ('00000000-0000-0000-0000-000000252e4a', 25252, '00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252a03', '00000000-0000-0000-0000-000000252a01');
INSERT INTO public.nudge_sent (id, contact_id, step_key, jobs_ledger_id, how, sent_by, by_user_id) VALUES ('00000000-0000-0000-0000-000000252e51', '00000000-0000-0000-0000-000000252c11', 'n1', '00000000-0000-0000-0000-000000252b03', 'text', 'person', '00000000-0000-0000-0000-000000252a01');
INSERT INTO public.drive_links (id, token_hash, jobs_ledger_id, drive_file_id, half, name) VALUES ('00000000-0000-0000-0000-000000252e52', repeat('b', 64), '00000000-0000-0000-0000-000000252b03', 'abcdefghijkl', 'plans', 'Set.pdf');
INSERT INTO public.email_tag_threads (id, user_id, gmail_thread_id, jobs_ledger_id) VALUES ('00000000-0000-0000-0000-000000252e53', '00000000-0000-0000-0000-000000252a01', 'thr-combine-1', '00000000-0000-0000-0000-000000252b03');
INSERT INTO public.supply_house_job_accounts (id, job_id, contact_label, contact_email) VALUES ('00000000-0000-0000-0000-000000252e54', '00000000-0000-0000-0000-000000252b03', 'Counter', 'counter@example.com');
INSERT INTO public.supply_house_invoice_move_requests (id, invoice_id, job_id, supply_house_id, via) VALUES ('00000000-0000-0000-0000-000000252e55', '00000000-0000-0000-0000-000000252d11', '00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252d01', 'email');
-- Materials on site: Yard on both jobs; Unsorted on both; Cage B on both; Cage A on the source alone.
INSERT INTO public.job_places (id, job_id, name) VALUES
  ('00000000-0000-0000-0000-000000252e61', '00000000-0000-0000-0000-000000252b03', 'Yard'),
  ('00000000-0000-0000-0000-000000252e62', '00000000-0000-0000-0000-000000252b03', 'Dock'),
  ('00000000-0000-0000-0000-000000252e63', '00000000-0000-0000-0000-000000252b01', 'Yard');
INSERT INTO public.job_containers (id, job_id, label, kind, place_id) VALUES
  ('c252e071-0000-0000-0000-000000252e71', '00000000-0000-0000-0000-000000252b03', 'Unsorted', 'unsorted', '00000000-0000-0000-0000-000000252e61'),
  ('c252e072-0000-0000-0000-000000252e72', '00000000-0000-0000-0000-000000252b03', 'Cage A', 'cage', '00000000-0000-0000-0000-000000252e62'),
  ('c252e073-0000-0000-0000-000000252e73', '00000000-0000-0000-0000-000000252b03', 'Cage B', 'cage', NULL),
  ('c252e074-0000-0000-0000-000000252e74', '00000000-0000-0000-0000-000000252b01', 'Unsorted', 'unsorted', NULL),
  ('c252e075-0000-0000-0000-000000252e75', '00000000-0000-0000-0000-000000252b01', 'Cage B', 'cage', NULL);
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, from_container_id, to_container_id) VALUES
  ('00000000-0000-0000-0000-000000252e81', '00000000-0000-0000-0000-000000252b03', 'Combine bed elbow', 10, 'delivered', NULL, 'c252e071-0000-0000-0000-000000252e71'),
  ('00000000-0000-0000-0000-000000252e82', '00000000-0000-0000-0000-000000252b03', 'Combine bed elbow', 4, 'moved', 'c252e071-0000-0000-0000-000000252e71', 'c252e072-0000-0000-0000-000000252e72'),
  ('00000000-0000-0000-0000-000000252e83', '00000000-0000-0000-0000-000000252b03', 'Combine bed tee', 2, 'delivered', NULL, 'c252e073-0000-0000-0000-000000252e73');
INSERT INTO public.job_container_moves (id, container_id, from_place_id, to_place_id) VALUES ('00000000-0000-0000-0000-000000252e84', 'c252e071-0000-0000-0000-000000252e71', '00000000-0000-0000-0000-000000252e61', '00000000-0000-0000-0000-000000252e62');
INSERT INTO public.job_box_photos (id, job_id, container_id, file_name) VALUES
  ('00000000-0000-0000-0000-000000252e85', '00000000-0000-0000-0000-000000252b03', 'c252e071-0000-0000-0000-000000252e71', 'unsorted.jpg'),
  ('00000000-0000-0000-0000-000000252e86', '00000000-0000-0000-0000-000000252b03', 'c252e073-0000-0000-0000-000000252e73', 'cage-b.jpg');
-- Messages: an open call, skip and hold T already holds for Kay's step one; a second step and done rows that move.
INSERT INTO public.call_tasks (id, contact_id, step_key, jobs_ledger_id, due_on, what, done_at, done_how) VALUES
  ('00000000-0000-0000-0000-000000252e91', '00000000-0000-0000-0000-000000252c11', 's1', '00000000-0000-0000-0000-000000252b03', '2026-11-05', 'Call about the bed', NULL, NULL),
  ('00000000-0000-0000-0000-000000252e92', '00000000-0000-0000-0000-000000252c11', 's2', '00000000-0000-0000-0000-000000252b03', '2026-11-06', 'Call about the slab', NULL, NULL),
  ('00000000-0000-0000-0000-000000252e93', '00000000-0000-0000-0000-000000252c11', 's1', '00000000-0000-0000-0000-000000252b03', '2026-10-20', 'Called about the bed', now(), 'called'),
  ('00000000-0000-0000-0000-000000252e94', '00000000-0000-0000-0000-000000252c11', 's1', '00000000-0000-0000-0000-000000252b01', '2026-11-05', 'Call about the bed', NULL, NULL);
INSERT INTO public.contact_jobs (id, contact_id, jobs_ledger_id, is_default) VALUES
  ('00000000-0000-0000-0000-000000252ea1', '00000000-0000-0000-0000-000000252c11', '00000000-0000-0000-0000-000000252b03', true),
  ('00000000-0000-0000-0000-000000252ea2', '00000000-0000-0000-0000-000000252c12', '00000000-0000-0000-0000-000000252b03', false),
  ('00000000-0000-0000-0000-000000252ea3', '00000000-0000-0000-0000-000000252c11', '00000000-0000-0000-0000-000000252b01', false);
INSERT INTO public.contact_step_skips (id, contact_id, step_key, jobs_ledger_id, why, undone_at) VALUES
  ('00000000-0000-0000-0000-000000252eb1', '00000000-0000-0000-0000-000000252c11', 'st1', '00000000-0000-0000-0000-000000252b03', 'Bed skip one', NULL),
  ('00000000-0000-0000-0000-000000252eb2', '00000000-0000-0000-0000-000000252c11', 'st2', '00000000-0000-0000-0000-000000252b03', 'Bed skip two', NULL),
  ('00000000-0000-0000-0000-000000252eb3', '00000000-0000-0000-0000-000000252c11', 'st1', '00000000-0000-0000-0000-000000252b03', 'Bed skip undone', now()),
  ('00000000-0000-0000-0000-000000252eb4', '00000000-0000-0000-0000-000000252c11', 'st1', '00000000-0000-0000-0000-000000252b01', 'Target skip one', NULL);
INSERT INTO public.nudge_holds (id, contact_id, step_key, jobs_ledger_id, until_on) VALUES
  ('00000000-0000-0000-0000-000000252ec1', '00000000-0000-0000-0000-000000252c11', 'n1', '00000000-0000-0000-0000-000000252b03', '2026-12-01'),
  ('00000000-0000-0000-0000-000000252ec2', '00000000-0000-0000-0000-000000252c11', 'n2', '00000000-0000-0000-0000-000000252b03', '2026-11-25'),
  ('00000000-0000-0000-0000-000000252ec3', '00000000-0000-0000-0000-000000252c11', 'n1', '00000000-0000-0000-0000-000000252b01', '2026-11-20');
-- Watchers: Hal on the source alone, Sal on both.
INSERT INTO public.job_watchers (job_id, user_id, hear_progress, hear_done, hear_dates) VALUES
  ('00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252a03', true, true, true),
  ('00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252a04', false, true, false),
  ('00000000-0000-0000-0000-000000252b01', '00000000-0000-0000-0000-000000252a04', true, true, false);
-- Supply houses: house one's account open on the source and requested on the target; house two on the source alone.
INSERT INTO public.job_supply_house_accounts (id, job_id, supply_house_id, status, account_ref) VALUES
  ('00000000-0000-0000-0000-000000252ed1', '00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252d01', 'open', 'A-1'),
  ('00000000-0000-0000-0000-000000252ed2', '00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252d02', 'requested', ''),
  ('00000000-0000-0000-0000-000000252ed3', '00000000-0000-0000-0000-000000252b01', '00000000-0000-0000-0000-000000252d01', 'requested', '');
-- The stamp writes noted_at on every insert, so the seed turns it off to put the words at their days.
ALTER TABLE public.job_supply_house_words DISABLE TRIGGER job_supply_house_words_stamp;
INSERT INTO public.job_supply_house_words (id, job_id, supply_house_id, their_balance, said_by, noted_by_name, noted_at) VALUES
  ('00000000-0000-0000-0000-000000252ee1', '00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252d01', 500, 'Counter one', 'Rosa Office', '2026-10-20 10:00+00'),
  ('00000000-0000-0000-0000-000000252ee2', '00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252d02', 50, 'Counter two', 'Rosa Office', '2026-10-21 10:00+00'),
  ('00000000-0000-0000-0000-000000252ee3', '00000000-0000-0000-0000-000000252b01', '00000000-0000-0000-0000-000000252d01', 300, 'Counter one', 'Rosa Office', '2026-10-10 10:00+00');
ALTER TABLE public.job_supply_house_words ENABLE TRIGGER job_supply_house_words_stamp;
-- Team board marks: the same cell on both jobs, and one on the source alone.
INSERT INTO public.team_board_acks (id, kind, work_date, person_user_id, target_key, job_ledger_id) VALUES
  ('00000000-0000-0000-0000-000000252ef1', 'over', '2026-10-01', '00000000-0000-0000-0000-000000252a03', 'job:00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252b03'),
  ('00000000-0000-0000-0000-000000252ef2', 'unplanned', '2026-10-02', '00000000-0000-0000-0000-000000252a03', 'job:00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252b03'),
  ('00000000-0000-0000-0000-000000252ef3', 'over', '2026-10-01', '00000000-0000-0000-0000-000000252a03', 'job:00000000-0000-0000-0000-000000252b01', '00000000-0000-0000-0000-000000252b01');
-- The hours target: open on both, and an older closed one on the source.
INSERT INTO public.job_expected_hours (id, job_id, hours, why, cleared_at) VALUES
  ('00000000-0000-0000-0000-000000252f31', '00000000-0000-0000-0000-000000252b03', 100, 'Bed target open', NULL),
  ('00000000-0000-0000-0000-000000252f32', '00000000-0000-0000-0000-000000252b03', 90, 'Bed target older', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000252f33', '00000000-0000-0000-0000-000000252b01', 80, 'Target open', NULL);
-- Work orders: both jobs hold a live one for Pat.
INSERT INTO public.step_commitments (id, job_id, person_id, display_name, amount, status) VALUES
  ('00000000-0000-0000-0000-000000252f41', '00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252e01', 'Pat Sub', 1500, 'draft'),
  ('00000000-0000-0000-0000-000000252f42', '00000000-0000-0000-0000-000000252b01', '00000000-0000-0000-0000-000000252e01', 'Pat Sub', 1500, 'draft');
-- Money and legal rows. A payment's trace both ways, a promise, a chase touch, and the source's promised date marked
-- later than the one the target took in the first combine.
INSERT INTO public.jobs_ledger_payment_events (id, kind, from_job_id, to_job_id, amount) VALUES
  ('00000000-0000-0000-0000-000000252101', 'moved', '00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252b01', 120),
  ('00000000-0000-0000-0000-000000252102', 'moved', '00000000-0000-0000-0000-000000252b01', '00000000-0000-0000-0000-000000252b03', 30);
INSERT INTO public.job_payment_promises (id, job_id, promised_date, said_by) VALUES ('00000000-0000-0000-0000-000000252103', '00000000-0000-0000-0000-000000252b03', '2026-11-20', 'Their office');
INSERT INTO public.job_payment_chase_touches (id, customer_id, job_id, outcome, note) VALUES ('00000000-0000-0000-0000-000000252104', '00000000-0000-0000-0000-000000252c01', '00000000-0000-0000-0000-000000252b03', 'note', 'Bed chase note');
INSERT INTO public.job_promised_pay_dates (job_id, promised_date, marked_at) VALUES ('00000000-0000-0000-0000-000000252b03', '2026-11-28', '2026-10-15 10:00+00');
-- Lien paper: a notice filing, a release and a demand letter on the source. Desk items: a live notice on both (the
-- source's comes over voided, and the target's activity names it with its months), an affidavit and a sent notice on
-- the source alone. A claim correction on the source; the target holds the one it took in the first combine.
INSERT INTO public.job_lien_filings (id, job_id, kind, amount) VALUES ('00000000-0000-0000-0000-000000252105', '00000000-0000-0000-0000-000000252b03', 'notice_53_056', 900);
INSERT INTO public.job_lien_releases (id, job_id, form_type, amount) VALUES ('00000000-0000-0000-0000-000000252106', '00000000-0000-0000-0000-000000252b03', 'conditional_progress', 400);
INSERT INTO public.job_demand_letters (id, job_id, amount) VALUES ('00000000-0000-0000-0000-000000252107', '00000000-0000-0000-0000-000000252b03', 900);
INSERT INTO public.job_lien_desk_items (id, job_id, kind, status, months) VALUES
  ('00000000-0000-0000-0000-000000252108', '00000000-0000-0000-0000-000000252b03', 'notice_53_056', 'drafted', ARRAY['2026-10', '2026-09']),
  ('00000000-0000-0000-0000-000000252109', '00000000-0000-0000-0000-000000252b03', 'affidavit', 'drafted', '{}'),
  ('00000000-0000-0000-0000-00000025210a', '00000000-0000-0000-0000-000000252b03', 'notice_53_056', 'sent', '{}'),
  ('00000000-0000-0000-0000-00000025210b', '00000000-0000-0000-0000-000000252b01', 'notice_53_056', 'awaiting_approval', '{}');
INSERT INTO public.job_lien_claim_corrections (job_id, amount_off, reason) VALUES ('00000000-0000-0000-0000-000000252b03', 50, 'Bed correction source');
-- Legal matters: one names both jobs, one names the source alone.
INSERT INTO public.legal_matters (id, payer_key) VALUES
  ('00000000-0000-0000-0000-00000025210c', 'bed-payer-one'),
  ('00000000-0000-0000-0000-00000025210d', 'bed-payer-two');
INSERT INTO public.legal_matter_jobs (matter_id, job_id) VALUES
  ('00000000-0000-0000-0000-00000025210c', '00000000-0000-0000-0000-000000252b03'),
  ('00000000-0000-0000-0000-00000025210c', '00000000-0000-0000-0000-000000252b01'),
  ('00000000-0000-0000-0000-00000025210d', '00000000-0000-0000-0000-000000252b03');
-- Agreements: a sent one and a signed one on the source, a draft on the target (the collision, until it is voided).
INSERT INTO public.job_contracts (id, job_id, status, template_name) VALUES
  ('00000000-0000-0000-0000-00000025210e', '00000000-0000-0000-0000-000000252b03', 'sent', 'Bed terms'),
  ('00000000-0000-0000-0000-00000025210f', '00000000-0000-0000-0000-000000252b03', 'signed', 'Bed terms'),
  ('00000000-0000-0000-0000-000000252110', '00000000-0000-0000-0000-000000252b01', 'draft', 'Bed terms');
-- Pay applications: number 1 on both (the collision, until the target's is deleted). The stamp writes updated_by and
-- updated_at on every insert, so the seed turns it off to put Hal's save at its day.
ALTER TABLE public.job_pay_applications DISABLE TRIGGER job_pay_applications_stamp;
INSERT INTO public.job_pay_applications (id, job_id, application_number, updated_by, updated_at) VALUES
  ('00000000-0000-0000-0000-000000252111', '00000000-0000-0000-0000-000000252b03', 1, '00000000-0000-0000-0000-000000252a03', '2026-10-05 10:00+00'),
  ('00000000-0000-0000-0000-000000252112', '00000000-0000-0000-0000-000000252b01', 1, '00000000-0000-0000-0000-000000252a03', '2026-10-06 10:00+00');
ALTER TABLE public.job_pay_applications ENABLE TRIGGER job_pay_applications_stamp;
-- Let go on purpose: the drive-time cache, the paid-job mail queue, the note count cache (recomputed from the notes).
INSERT INTO public.job_travel_times (from_job_id, to_job_id, duration_seconds, distance_meters) VALUES
  ('00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252b01', 600, 5000),
  ('00000000-0000-0000-0000-000000252b01', '00000000-0000-0000-0000-000000252b03', 600, 5000);
INSERT INTO public.paid_job_email_queue (job_ledger_id) VALUES ('00000000-0000-0000-0000-000000252b03');
INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body) VALUES
  ('00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252a01', 'Bed note one'),
  ('00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252a01', 'Bed note two'),
  ('00000000-0000-0000-0000-000000252b01', '00000000-0000-0000-0000-000000252a01', 'Target note');

-- 3a. Both jobs hold a live work order for Pat: the combine holds, says so, and moves nothing.
SELECT cr.as_user('00000000-0000-0000-0000-000000252a01');
SET LOCAL ROLE authenticated;
SELECT public.migrate_job_ledger_costs_and_delete('00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252b01') AS refused \gset
RESET ROLE;
SELECT cr.same('two live work orders for one sub: the combine holds', :'refused'::jsonb ->> 'code', 'work_order_collision');
SELECT cr.same('and names the sub', :'refused'::jsonb ->> 'error', 'Both jobs hold a live work order for Pat Sub. Cancel one of them, then combine.');
SELECT cr.same('the held combine moved nothing: the source stands', (SELECT count(*)::text FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-000000252b03'), '1');
SELECT cr.same('the held combine moved nothing: the incident is on the source', (SELECT job_id::text FROM public.job_hazmat_incidents WHERE id = '00000000-0000-0000-0000-000000252e48'), '00000000-0000-0000-0000-000000252b03');
SELECT cr.same('the held combine moved nothing: the source''s Unsorted stands', (SELECT count(*)::text FROM public.job_containers WHERE id = 'c252e071-0000-0000-0000-000000252e71'), '1');
UPDATE public.step_commitments SET status = 'cancelled' WHERE id = '00000000-0000-0000-0000-000000252f42';

-- 3b. Both jobs hold an open agreement: the combine holds, says what to do, and moves nothing.
SELECT cr.as_user('00000000-0000-0000-0000-000000252a01');
SET LOCAL ROLE authenticated;
SELECT public.migrate_job_ledger_costs_and_delete('00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252b01') AS refused_agreement \gset
RESET ROLE;
SELECT cr.same('two open agreements: the combine holds', :'refused_agreement'::jsonb ->> 'code', 'agreement_collision');
SELECT cr.same('and says what to do', :'refused_agreement'::jsonb ->> 'error', 'Both jobs hold an open agreement. Void one of them, then combine.');
SELECT cr.same('the held combine moved nothing: the sent agreement is on the source', (SELECT job_id::text FROM public.job_contracts WHERE id = '00000000-0000-0000-0000-00000025210e'), '00000000-0000-0000-0000-000000252b03');
UPDATE public.job_contracts SET status = 'voided', voided_at = now() WHERE id = '00000000-0000-0000-0000-000000252110';

-- 3c. Both jobs hold pay applications: the combine holds, says what to do, and moves nothing.
SELECT cr.as_user('00000000-0000-0000-0000-000000252a01');
SET LOCAL ROLE authenticated;
SELECT public.migrate_job_ledger_costs_and_delete('00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252b01') AS refused_apps \gset
RESET ROLE;
SELECT cr.same('two runs of pay applications: the combine holds', :'refused_apps'::jsonb ->> 'code', 'pay_application_collision');
SELECT cr.same('and says what to do about them', :'refused_apps'::jsonb ->> 'error', 'Both jobs hold pay applications. Delete one job''s applications, then combine.');
SELECT cr.same('the held combine moved nothing: the promise is on the source', (SELECT job_id::text FROM public.job_payment_promises WHERE id = '00000000-0000-0000-0000-000000252103'), '00000000-0000-0000-0000-000000252b03');
UPDATE public.job_pay_applications SET deleted_at = now() WHERE id = '00000000-0000-0000-0000-000000252112';

-- 3d. The combine.
SELECT cr.as_user('00000000-0000-0000-0000-000000252a01');
SET LOCAL ROLE authenticated;
SELECT public.migrate_job_ledger_costs_and_delete('00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252b01') AS combine_two \gset
RESET ROLE;
SELECT cr.same('the second combine says ok', coalesce(:'combine_two'::jsonb ->> 'error', :'combine_two'::jsonb ->> 'ok'), 'true');
SELECT cr.same('the source is gone', (SELECT count(*)::text FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-000000252b03'), '0');

-- Plain moves.
SELECT cr.same('an activity event moved', (SELECT job_id::text FROM public.job_activity_events WHERE id = '00000000-0000-0000-0000-000000252e41'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('and says which job it told of', (SELECT detail ->> 'combined_from_job_id' FROM public.job_activity_events WHERE id = '00000000-0000-0000-0000-000000252e41'), '00000000-0000-0000-0000-000000252b03');
SELECT cr.same('and keeps the rest of its detail', (SELECT detail ->> 'source_id' FROM public.job_activity_events WHERE id = '00000000-0000-0000-0000-000000252e41'), 'cb-1');
SELECT cr.same('the second activity event moved', (SELECT job_id::text FROM public.job_activity_events WHERE id = '00000000-0000-0000-0000-000000252e42'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a percent-done event moved', (SELECT job_id::text FROM public.job_pct_events WHERE id = '00000000-0000-0000-0000-000000252e43'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a follow-up review moved', (SELECT job_id::text FROM public.job_followup_reviews WHERE id = '00000000-0000-0000-0000-000000252e44'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a test report moved', (SELECT job_id::text FROM public.job_test_reports WHERE id = '00000000-0000-0000-0000-000000252e45'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a share link moved', (SELECT job_id::text FROM public.job_share_links WHERE id = '00000000-0000-0000-0000-000000252e46'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a job photo moved', (SELECT job_id::text FROM public.job_photo_notes WHERE id = '00000000-0000-0000-0000-000000252e47'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('and still names its line', (SELECT fixture_id::text FROM public.job_photo_notes WHERE id = '00000000-0000-0000-0000-000000252e47'), '00000000-0000-0000-0000-000000252e11');
SELECT cr.same('a hazmat incident moved', (SELECT job_id::text FROM public.job_hazmat_incidents WHERE id = '00000000-0000-0000-0000-000000252e48'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('an hours statement moved', (SELECT job_ledger_id::text FROM public.hours_statements WHERE id = '00000000-0000-0000-0000-000000252e49'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a PO entry moved', (SELECT job_ledger_id::text FROM public.material_po_generator_entries WHERE id = '00000000-0000-0000-0000-000000252e4a'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a sent nudge moved', (SELECT jobs_ledger_id::text FROM public.nudge_sent WHERE id = '00000000-0000-0000-0000-000000252e51'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a Drive link moved', (SELECT jobs_ledger_id::text FROM public.drive_links WHERE id = '00000000-0000-0000-0000-000000252e52'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a tagged email thread moved', (SELECT jobs_ledger_id::text FROM public.email_tag_threads WHERE id = '00000000-0000-0000-0000-000000252e53'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a supply-house send moved', (SELECT job_id::text FROM public.supply_house_job_accounts WHERE id = '00000000-0000-0000-0000-000000252e54'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a supply-house move request moved', (SELECT job_id::text FROM public.supply_house_invoice_move_requests WHERE id = '00000000-0000-0000-0000-000000252e55'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('the source''s work order moved', (SELECT job_id::text FROM public.step_commitments WHERE id = '00000000-0000-0000-0000-000000252f41'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('the Rough In window followed its line', (SELECT job_id::text FROM public.job_stage_windows WHERE id = '00000000-0000-0000-0000-000000252e31'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('the target''s own window stands', (SELECT job_id::text FROM public.job_stage_windows WHERE id = '00000000-0000-0000-0000-000000252e33'), '00000000-0000-0000-0000-000000252b01');

-- Plans: the target keeps its part and current set; the source's sets join it; the as-built remembers its job.
SELECT cr.same('the source''s plan part is gone', (SELECT count(*)::text FROM public.plan_parts WHERE id = '00000000-0000-0000-0000-000000252f02'), '0');
SELECT cr.same('the target keeps its own part', (SELECT plan_part_id::text FROM public.jobs_ledger WHERE id = '00000000-0000-0000-0000-000000252b01'), '00000000-0000-0000-0000-000000252f01');
SELECT cr.same('and its current set', (SELECT current_set_id::text FROM public.plan_parts WHERE id = '00000000-0000-0000-0000-000000252f01'), '00000000-0000-0000-0000-000000252f11');
SELECT cr.same('the source''s issued set joined the target''s part', (SELECT part_id::text FROM public.plan_sets WHERE id = '00000000-0000-0000-0000-000000252f12'), '00000000-0000-0000-0000-000000252f01');
SELECT cr.same('the source''s as-built joined it too', (SELECT part_id::text FROM public.plan_sets WHERE id = '00000000-0000-0000-0000-000000252f13'), '00000000-0000-0000-0000-000000252f01');
SELECT cr.same('and names the target as the job that made it', (SELECT job_id::text FROM public.plan_sets WHERE id = '00000000-0000-0000-0000-000000252f13'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('the target''s part holds three sets', (SELECT count(*)::text FROM public.plan_sets WHERE part_id = '00000000-0000-0000-0000-000000252f01'), '3');

-- One per job: the target's stands, the source's went.
SELECT cr.same('the target keeps its baseline', (SELECT team_hours::text FROM public.job_baselines WHERE job_id = '00000000-0000-0000-0000-000000252b01'), '12');
SELECT cr.same('the source''s baseline went', (SELECT count(*)::text FROM public.job_baselines WHERE team_hours = 99), '0');
SELECT cr.same('the target keeps its budget', (SELECT labor_hours::text FROM public.job_budgets WHERE job_id = '00000000-0000-0000-0000-000000252b01'), '40');
SELECT cr.same('the target keeps its property owner', (SELECT owner_name FROM public.job_property_owners WHERE job_id = '00000000-0000-0000-0000-000000252b01'), 'First Owner');
SELECT cr.same('the target keeps its photo-save tick', (SELECT count(*)::text FROM public.photo_saves WHERE jobs_ledger_id = '00000000-0000-0000-0000-000000252b01'), '1');
SELECT cr.same('the source''s tick went', (SELECT count(*)::text FROM public.photo_saves WHERE id = '00000000-0000-0000-0000-000000252f21'), '0');

-- Materials on site.
SELECT cr.same('the source''s Yard folded into the target''s', (SELECT count(*)::text FROM public.job_places WHERE id = '00000000-0000-0000-0000-000000252e61'), '0');
SELECT cr.same('the source''s Dock moved', (SELECT job_id::text FROM public.job_places WHERE id = '00000000-0000-0000-0000-000000252e62'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('the target has one Yard and one Dock', (SELECT string_agg(name, ', ' ORDER BY name) FROM public.job_places WHERE job_id = '00000000-0000-0000-0000-000000252b01'), 'Dock, Yard');
SELECT cr.same('the source''s Unsorted folded into the target''s', (SELECT count(*)::text FROM public.job_containers WHERE id = 'c252e071-0000-0000-0000-000000252e71'), '0');
SELECT cr.same('Cage A moved', (SELECT job_id::text FROM public.job_containers WHERE id = 'c252e072-0000-0000-0000-000000252e72'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('and stands in the Dock that moved', (SELECT place_id::text FROM public.job_containers WHERE id = 'c252e072-0000-0000-0000-000000252e72'), '00000000-0000-0000-0000-000000252e62');
SELECT cr.same('the source''s Cage B moved under a numbered label', (SELECT label FROM public.job_containers WHERE id = 'c252e073-0000-0000-0000-000000252e73'), 'Cage B (2)');
SELECT cr.same('and keeps its code', (SELECT job_id::text FROM public.job_containers WHERE id = 'c252e073-0000-0000-0000-000000252e73'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a delivery into the source''s Unsorted now names the target''s', (SELECT to_container_id::text FROM public.job_material_movements WHERE id = '00000000-0000-0000-0000-000000252e81'), 'c252e074-0000-0000-0000-000000252e74');
SELECT cr.same('a move out of it names the target''s', (SELECT from_container_id::text || ' to ' || to_container_id::text FROM public.job_material_movements WHERE id = '00000000-0000-0000-0000-000000252e82'), 'c252e074-0000-0000-0000-000000252e74 to c252e072-0000-0000-0000-000000252e72');
SELECT cr.same('every movement is on the target', (SELECT count(*)::text FROM public.job_material_movements WHERE job_id = '00000000-0000-0000-0000-000000252b01'), '3');
SELECT cr.same('the Unsorted pile''s move names the target''s pile and places', (SELECT container_id::text || ' ' || from_place_id::text || ' ' || to_place_id::text FROM public.job_container_moves WHERE id = '00000000-0000-0000-0000-000000252e84'), 'c252e074-0000-0000-0000-000000252e74 00000000-0000-0000-0000-000000252e63 00000000-0000-0000-0000-000000252e62');
SELECT cr.same('a photo of the Unsorted pile names the target''s', (SELECT job_id::text || ' ' || container_id::text FROM public.job_box_photos WHERE id = '00000000-0000-0000-0000-000000252e85'), '00000000-0000-0000-0000-000000252b01 c252e074-0000-0000-0000-000000252e74');
SELECT cr.same('a photo of Cage B moved', (SELECT job_id::text || ' ' || container_id::text FROM public.job_box_photos WHERE id = '00000000-0000-0000-0000-000000252e86'), '00000000-0000-0000-0000-000000252b01 c252e073-0000-0000-0000-000000252e73');

-- Messages.
SELECT cr.same('an open call the target already has stands once', (SELECT count(*)::text FROM public.call_tasks WHERE id = '00000000-0000-0000-0000-000000252e91'), '0');
SELECT cr.same('the target''s own open call stands', (SELECT jobs_ledger_id::text FROM public.call_tasks WHERE id = '00000000-0000-0000-0000-000000252e94'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('an open call for another step moved', (SELECT jobs_ledger_id::text FROM public.call_tasks WHERE id = '00000000-0000-0000-0000-000000252e92'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a done call moved', (SELECT jobs_ledger_id::text FROM public.call_tasks WHERE id = '00000000-0000-0000-0000-000000252e93'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a contact link the target already has stands once', (SELECT count(*)::text FROM public.contact_jobs WHERE contact_id = '00000000-0000-0000-0000-000000252c11'), '1');
SELECT cr.same('and keeps the star the source''s had', (SELECT is_default::text FROM public.contact_jobs WHERE id = '00000000-0000-0000-0000-000000252ea3'), 'true');
SELECT cr.same('a contact link the target lacked moved', (SELECT jobs_ledger_id::text FROM public.contact_jobs WHERE id = '00000000-0000-0000-0000-000000252ea2'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('an open skip the target already has stands once', (SELECT count(*)::text FROM public.contact_step_skips WHERE id = '00000000-0000-0000-0000-000000252eb1'), '0');
SELECT cr.same('an open skip for another step moved', (SELECT jobs_ledger_id::text FROM public.contact_step_skips WHERE id = '00000000-0000-0000-0000-000000252eb2'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('an undone skip moved', (SELECT jobs_ledger_id::text FROM public.contact_step_skips WHERE id = '00000000-0000-0000-0000-000000252eb3'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('an open hold the target already has stands once', (SELECT count(*)::text FROM public.nudge_holds WHERE id = '00000000-0000-0000-0000-000000252ec1'), '0');
SELECT cr.same('and keeps the later day', (SELECT until_on::text FROM public.nudge_holds WHERE id = '00000000-0000-0000-0000-000000252ec3'), '2026-12-01');
SELECT cr.same('a hold for another step moved', (SELECT jobs_ledger_id::text FROM public.nudge_holds WHERE id = '00000000-0000-0000-0000-000000252ec2'), '00000000-0000-0000-0000-000000252b01');

-- Watchers, supply houses, the Team board, the hours target.
SELECT cr.same('a watcher the target lacked is added with their picks', (SELECT hear_dates::text FROM public.job_watchers WHERE job_id = '00000000-0000-0000-0000-000000252b01' AND user_id = '00000000-0000-0000-0000-000000252a03'), 'true');
SELECT cr.same('a watcher on both keeps the target''s picks', (SELECT hear_progress::text FROM public.job_watchers WHERE job_id = '00000000-0000-0000-0000-000000252b01' AND user_id = '00000000-0000-0000-0000-000000252a04'), 'true');
SELECT cr.same('the target has two watchers', (SELECT count(*)::text FROM public.job_watchers WHERE job_id = '00000000-0000-0000-0000-000000252b01'), '2');
SELECT cr.same('an open account on the source opens the target''s', (SELECT status || ' ' || account_ref FROM public.job_supply_house_accounts WHERE id = '00000000-0000-0000-0000-000000252ed3'), 'open A-1');
SELECT cr.same('the source''s row for that house went', (SELECT count(*)::text FROM public.job_supply_house_accounts WHERE id = '00000000-0000-0000-0000-000000252ed1'), '0');
SELECT cr.same('an account for a house the target lacked moved', (SELECT job_id::text FROM public.job_supply_house_accounts WHERE id = '00000000-0000-0000-0000-000000252ed2'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('the later word from a house stands', (SELECT their_balance::text FROM public.job_supply_house_words WHERE job_id = '00000000-0000-0000-0000-000000252b01' AND supply_house_id = '00000000-0000-0000-0000-000000252d01'), '500.00');
SELECT cr.same('and keeps who noted it and when', (SELECT noted_by_name || ' ' || noted_at::text FROM public.job_supply_house_words WHERE id = '00000000-0000-0000-0000-000000252ee1'), 'Rosa Office 2026-10-20 10:00:00+00');
SELECT cr.same('the target''s older word went', (SELECT count(*)::text FROM public.job_supply_house_words WHERE id = '00000000-0000-0000-0000-000000252ee3'), '0');
SELECT cr.same('a word from a house the target lacked moved', (SELECT job_id::text FROM public.job_supply_house_words WHERE id = '00000000-0000-0000-0000-000000252ee2'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a Looks right mark the target already has stands once', (SELECT count(*)::text FROM public.team_board_acks WHERE id = '00000000-0000-0000-0000-000000252ef1'), '0');
SELECT cr.same('a Looks right mark the target lacked moved with its key', (SELECT job_ledger_id::text || ' ' || target_key FROM public.team_board_acks WHERE id = '00000000-0000-0000-0000-000000252ef2'), '00000000-0000-0000-0000-000000252b01 job:00000000-0000-0000-0000-000000252b01');
SELECT cr.same('the target''s hours target stands', (SELECT hours::text FROM public.job_expected_hours WHERE job_id = '00000000-0000-0000-0000-000000252b01' AND cleared_at IS NULL), '80.0');
SELECT cr.same('the source''s open target came over closed', (SELECT job_id::text || ' ' || (cleared_at IS NOT NULL)::text || ' ' || cleared_by_name FROM public.job_expected_hours WHERE id = '00000000-0000-0000-0000-000000252f31'), '00000000-0000-0000-0000-000000252b01 true Dee Dev');
SELECT cr.same('the source''s older target came over', (SELECT job_id::text FROM public.job_expected_hours WHERE id = '00000000-0000-0000-0000-000000252f32'), '00000000-0000-0000-0000-000000252b01');

-- Money and legal rows.
SELECT cr.same('a moved payment''s trace names the target at both ends', (SELECT from_job_id::text || ' ' || to_job_id::text FROM public.jobs_ledger_payment_events WHERE id = '00000000-0000-0000-0000-000000252101'), '00000000-0000-0000-0000-000000252b01 00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a payment moved onto the source reads as moved onto the target', (SELECT to_job_id::text FROM public.jobs_ledger_payment_events WHERE id = '00000000-0000-0000-0000-000000252102'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a payment promise moved', (SELECT job_id::text FROM public.job_payment_promises WHERE id = '00000000-0000-0000-0000-000000252103'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a chase touch moved', (SELECT job_id::text FROM public.job_payment_chase_touches WHERE id = '00000000-0000-0000-0000-000000252104'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('the later-marked promised pay date stands', (SELECT promised_date::text FROM public.job_promised_pay_dates WHERE job_id = '00000000-0000-0000-0000-000000252b01'), '2026-11-28');
SELECT cr.same('and the target holds one promised date', (SELECT count(*)::text FROM public.job_promised_pay_dates WHERE job_id IN ('00000000-0000-0000-0000-000000252b01', '00000000-0000-0000-0000-000000252b03')), '1');
SELECT cr.same('the move logged no second promise', (SELECT count(*)::text FROM public.job_payment_promises WHERE job_id = '00000000-0000-0000-0000-000000252b01'), '3');
SELECT cr.same('a lien notice filing moved', (SELECT job_id::text FROM public.job_lien_filings WHERE id = '00000000-0000-0000-0000-000000252105'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a lien release moved', (SELECT job_id::text FROM public.job_lien_releases WHERE id = '00000000-0000-0000-0000-000000252106'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a demand letter moved', (SELECT job_id::text FROM public.job_demand_letters WHERE id = '00000000-0000-0000-0000-000000252107'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a live desk notice the target already holds comes over voided', (SELECT job_id::text || ' ' || (voided_at IS NOT NULL)::text FROM public.job_lien_desk_items WHERE id = '00000000-0000-0000-0000-000000252108'), '00000000-0000-0000-0000-000000252b01 true');
SELECT cr.same('the target''s own notice stands live', (SELECT (voided_at IS NULL)::text || ' ' || status FROM public.job_lien_desk_items WHERE id = '00000000-0000-0000-0000-00000025210b'), 'true awaiting_approval');
SELECT cr.same('the target''s activity names the draft set aside, with its months in order', (SELECT summary FROM public.job_activity_events WHERE job_id = '00000000-0000-0000-0000-000000252b01' AND event_type = 'job_combined' AND detail ->> 'desk_item_id' = '00000000-0000-0000-0000-000000252108'), 'Lien notice draft set aside in the combine — from Job #9103 · Sep 2026, Oct 2026');
SELECT cr.same('and the line is financial, so the crew does not read it', (SELECT financial::text FROM public.job_activity_events WHERE job_id = '00000000-0000-0000-0000-000000252b01' AND event_type = 'job_combined' AND detail ->> 'desk_item_id' = '00000000-0000-0000-0000-000000252108'), 'true');
SELECT cr.same('only the draft set aside gets a line', (SELECT count(*)::text FROM public.job_activity_events WHERE job_id = '00000000-0000-0000-0000-000000252b01' AND event_type = 'job_combined' AND detail ? 'desk_item_id'), '1');
SELECT cr.same('an affidavit item the target lacked moved live', (SELECT job_id::text || ' ' || (voided_at IS NULL)::text FROM public.job_lien_desk_items WHERE id = '00000000-0000-0000-0000-000000252109'), '00000000-0000-0000-0000-000000252b01 true');
SELECT cr.same('a sent notice moved as history', (SELECT job_id::text || ' ' || status FROM public.job_lien_desk_items WHERE id = '00000000-0000-0000-0000-00000025210a'), '00000000-0000-0000-0000-000000252b01 sent');
SELECT cr.same('the target keeps its claim correction', (SELECT amount_off::text FROM public.job_lien_claim_corrections WHERE job_id = '00000000-0000-0000-0000-000000252b01'), '15');
SELECT cr.same('the source''s correction went', (SELECT count(*)::text FROM public.job_lien_claim_corrections WHERE amount_off = 50), '0');
SELECT cr.same('a legal matter on both jobs links the target once', (SELECT count(*)::text FROM public.legal_matter_jobs WHERE matter_id = '00000000-0000-0000-0000-00000025210c'), '1');
SELECT cr.same('and names the target', (SELECT job_id::text FROM public.legal_matter_jobs WHERE matter_id = '00000000-0000-0000-0000-00000025210c'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a matter on the source alone now names the target', (SELECT job_id::text FROM public.legal_matter_jobs WHERE matter_id = '00000000-0000-0000-0000-00000025210d'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a sent agreement moved', (SELECT job_id::text FROM public.job_contracts WHERE id = '00000000-0000-0000-0000-00000025210e'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('a signed agreement moved', (SELECT job_id::text FROM public.job_contracts WHERE id = '00000000-0000-0000-0000-00000025210f'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('the target''s voided draft stands', (SELECT job_id::text || ' ' || status FROM public.job_contracts WHERE id = '00000000-0000-0000-0000-000000252110'), '00000000-0000-0000-0000-000000252b01 voided');
SELECT cr.same('the source''s pay application moved', (SELECT job_id::text FROM public.job_pay_applications WHERE id = '00000000-0000-0000-0000-000000252111'), '00000000-0000-0000-0000-000000252b01');
SELECT cr.same('and keeps who saved it and when', (SELECT updated_by::text || ' ' || updated_at::text FROM public.job_pay_applications WHERE id = '00000000-0000-0000-0000-000000252111'), '00000000-0000-0000-0000-000000252a03 2026-10-05 10:00:00+00');
SELECT cr.same('the target''s deleted application stays on the target', (SELECT job_id::text || ' ' || (deleted_at IS NOT NULL)::text FROM public.job_pay_applications WHERE id = '00000000-0000-0000-0000-000000252112'), '00000000-0000-0000-0000-000000252b01 true');

-- Let go on purpose.
SELECT cr.same('the drive-time cache between the two is gone', (SELECT count(*)::text FROM public.job_travel_times WHERE from_job_id IN ('00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252b01') OR to_job_id IN ('00000000-0000-0000-0000-000000252b03', '00000000-0000-0000-0000-000000252b01')), '0');
SELECT cr.same('the paid-job mail queue row is gone', (SELECT count(*)::text FROM public.paid_job_email_queue WHERE job_ledger_id = '00000000-0000-0000-0000-000000252b03'), '0');
SELECT cr.same('the source''s note count cache is gone', (SELECT count(*)::text FROM public.jobs_ledger_thread_note_stats_cache WHERE job_id = '00000000-0000-0000-0000-000000252b03'), '0');
SELECT cr.same('the target''s note count cache counts every note it now holds', (SELECT note_count::text FROM public.jobs_ledger_thread_note_stats_cache WHERE job_id = '00000000-0000-0000-0000-000000252b01'), (SELECT count(*)::text FROM public.jobs_ledger_thread_notes WHERE job_id = '00000000-0000-0000-0000-000000252b01'));
SELECT cr.same('the moved notes are among them', (SELECT count(*)::text FROM public.jobs_ledger_thread_notes WHERE job_id = '00000000-0000-0000-0000-000000252b01' AND body LIKE 'Bed note%'), '2');

DO $$
DECLARE
  v_lost text;
BEGIN
  SELECT string_agg(what, E'\n' ORDER BY n) INTO v_lost FROM cr.lost;
  IF v_lost IS NOT NULL THEN
    RAISE EXCEPTION E'What a combine lost or got wrong:\n%', v_lost;
  END IF;
  RAISE NOTICE 'combine_rows PASSED';
END $$;
ROLLBACK;
