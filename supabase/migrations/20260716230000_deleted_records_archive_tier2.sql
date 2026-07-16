-- Deleted-records archive — tier 2 coverage: customers, projects, estimates, payroll, time, AP,
-- sub labor, purchase orders, material templates, licences and writeups.
--
-- Phase 1/1.5 covered the jobs and bids trees (42 tables). Everything else in the app was still
-- hard-deleted with no snapshot. This adds 38 more tables (→ 80), chosen from the LIVE catalog rather
-- than by hand — hand-enumeration from baseline.sql is exactly what made Phase 1 miss four bid tables.
--
-- Two bugs this also fixes, both found by querying for "covered table --NOT NULL FK--> UNCOVERED table
-- ON DELETE CASCADE" (the generalised form of the price_book_versions blocker from 20260716150000):
--
--   * supply_house_invoice_job_allocations.invoice_id -> supply_house_invoices (CASCADE, NOT NULL).
--     Deleting a supply-house invoice cascade-killed its archived allocations' parent, so those rows
--     could never be re-inserted. supply_house_invoices is now covered.
--   * bids_takeoff_template_mappings.template_id -> material_templates (CASCADE, NOT NULL). Same shape.
--     material_templates is now covered.
--
-- And one silent hole: `projects` was uncovered while project-anchored `reports` were covered. Deleting
-- a project archived the reports but made them UNRESTORABLE — restore would null the dangling
-- reports.project_id, leaving all three anchors NULL and violating the reports_one_anchor CHECK.
-- Covering projects means the anchor comes back with them.
--
-- Note `customers` cascades into `projects` (and onward through workflows/steps/reports/inspections),
-- so a customer delete is far wider than it looks. That whole subtree is now captured as one bundle.
--
-- DELIBERATELY EXCLUDED — public.people_hours: it has 6 server-side DELETE statements and zero client
-- deletes because it is *derived*, machine-maintained data (recomputed from clock_sessions on approve /
-- revoke / session edit). Archiving it would churn the archive constantly and bury real deletions in
-- noise, to protect rows that can simply be recomputed. clock_sessions IS covered — its server-side
-- deletes are deliberate user actions (delete session, split by ids), which are worth archiving.
--
-- Group keys are each table's FK to its immediate cascade parent, so a bundle assembles via the restore
-- RPC's recursive walk (child.group_key ∈ collected record_ids). Roots group by their own id, except
-- two composite-PK tables with no id column: hours_days_correct (PK work_date) and people_pay_config
-- (PK person_name) — a NULL group_key would leave them captured but unlistable, so they key on their PK.
--
-- Still uncovered, deliberately — each was checked and has ZERO client-side deletes, so no UI path can
-- trigger the blocker: mercury_transactions (synced from Mercury), service_types (admin reference data),
-- and users. users is the notable one: it is soft-archived via the archive-user edge function rather than
-- hard-deleted, and public.users.id FKs to auth.users, which lives outside the public-schema sweep — so a
-- restored users row would dangle anyway. A hard user delete therefore still cascades their jobs and
-- reports blocked-but-safe: restore_deleted_records reports the missing master_user_id and commits
-- nothing, which is the correct outcome.
--
-- No restore-RPC change is needed: its insert order is topologically sorted from the live pg_constraint
-- catalog, so it picks these up automatically. list_deleted_records is refreshed below for labels.

DO $do$
DECLARE
  r         record;
  arg_frag  text;
BEGIN
  FOR r IN
    SELECT tbl, cols FROM (VALUES
      -- customers → projects → workflows → steps (one cascade tree)
      ('customers',                                     ARRAY[]::text[]),
      ('customer_contacts',                             ARRAY['customer_id']),
      ('customer_contact_persons',                      ARRAY['customer_id']),
      ('projects',                                      ARRAY['customer_id']),
      ('project_workflows',                             ARRAY['project_id']),
      ('project_workflow_steps',                        ARRAY['workflow_id']),
      ('project_workflow_step_actions',                 ARRAY['step_id']),
      ('project_superintendents',                       ARRAY['project_id']),
      ('step_subscriptions',                            ARRAY['step_id']),
      ('workflow_projections',                          ARRAY['workflow_id']),
      ('workflow_step_dependencies',                    ARRAY['step_id','depends_on_step_id']),
      ('workflow_step_line_items',                      ARRAY['step_id']),
      -- estimates
      ('estimates',                                     ARRAY[]::text[]),
      ('estimate_customer_events',                      ARRAY['estimate_id']),
      ('estimates_thread_notes',                        ARRAY['estimate_id']),
      -- payroll
      ('pay_stubs',                                     ARRAY[]::text[]),
      ('pay_stub_days',                                 ARRAY['pay_stub_id']),
      ('pay_stub_deductions',                           ARRAY['pay_stub_id']),
      ('pay_stub_additional_lines',                     ARRAY['pay_stub_id']),
      ('pay_stub_payments',                             ARRAY['pay_stub_id']),
      ('people_pay_config',                             ARRAY['person_name']),
      ('person_offsets',                                ARRAY[]::text[]),
      -- time (people_hours excluded on purpose — see header)
      ('clock_sessions',                                ARRAY[]::text[]),
      ('hours_reviewed',                                ARRAY[]::text[]),
      ('hours_days_correct',                            ARRAY['work_date']),
      -- AP / supply houses (also unblocks supply_house_invoice_job_allocations restore).
      -- supply_houses is UI-deletable and cascades to its invoices, template prices and part prices —
      -- covering it keeps those children restorable (same blocker class as price_book_versions).
      ('supply_houses',                                 ARRAY[]::text[]),
      ('supply_house_invoices',                         ARRAY['supply_house_id']),
      ('mercury_transaction_supply_house_invoice_links', ARRAY['invoice_id']),
      ('material_part_prices',                          ARRAY['supply_house_id']),
      -- sub labor
      ('people_labor_jobs',                             ARRAY[]::text[]),
      ('people_labor_job_items',                        ARRAY['job_id']),
      ('people_labor_job_payments',                     ARRAY['job_id']),
      -- purchasing
      ('purchase_orders',                               ARRAY[]::text[]),
      ('purchase_order_items',                          ARRAY['purchase_order_id']),
      -- material catalog (also unblocks bids_takeoff_template_mappings restore). material_parts is
      -- UI-deletable and cascades to part prices + template items, so it is covered too.
      ('material_templates',                            ARRAY[]::text[]),
      ('material_template_items',                       ARRAY['template_id','nested_template_id']),
      ('material_template_prices',                      ARRAY['template_id','supply_house_id']),
      ('material_parts',                                ARRAY[]::text[]),
      -- people records
      ('person_licenses',                               ARRAY[]::text[]),
      ('person_license_cost_lines',                     ARRAY['person_license_id']),
      ('writeups',                                      ARRAY[]::text[])
    ) AS t(tbl, cols)
  LOOP
    IF to_regclass(format('public.%I', r.tbl)) IS NULL THEN
      RAISE WARNING 'deleted_records_archive tier2: table public.% not found, skipping trigger', r.tbl;
      CONTINUE;
    END IF;
    arg_frag := COALESCE((SELECT string_agg(quote_literal(c), ', ') FROM unnest(r.cols) AS c), '');
    EXECUTE format('DROP TRIGGER IF EXISTS zzz_archive_on_delete ON public.%I', r.tbl);
    EXECUTE format(
      'CREATE TRIGGER zzz_archive_on_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_record(%s)',
      r.tbl, arg_frag
    );
  END LOOP;
END $do$;


-- Refresh list_deleted_records so the new kinds get readable labels instead of raw table names.
-- Job/bid keep their existing shape; everything else falls back to a generic name lookup.
CREATE OR REPLACE FUNCTION public.list_deleted_records(p_limit int DEFAULT 50)
RETURNS TABLE (
  group_key       text,
  kind            text,
  label           text,
  row_count       bigint,
  tables          text[],
  deleted_by      uuid,
  deleted_by_name text,
  deleted_at      timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH bundles AS (
    SELECT a.group_key AS gk,
           count(*)                                              AS row_count,
           array_agg(DISTINCT a.table_name ORDER BY a.table_name) AS tables,
           max(a.deleted_at)                                     AS deleted_at,
           (array_agg(a.deleted_by ORDER BY a.deleted_at DESC))[1] AS deleted_by
    FROM public.deleted_records_archive a
    WHERE a.restored_at IS NULL AND a.group_key IS NOT NULL
    GROUP BY a.group_key
  ),
  head AS (
    SELECT b.*, h.table_name AS head_table, h.row_data AS head_row
    FROM bundles b
    LEFT JOIN LATERAL (
      SELECT x.table_name, x.row_data
      FROM public.deleted_records_archive x
      WHERE x.group_key = b.gk AND x.record_id = b.gk AND x.restored_at IS NULL
      LIMIT 1
    ) h ON true
  )
  SELECT h.gk,
         CASE h.head_table
           WHEN 'jobs_ledger'           THEN 'job'
           WHEN 'bids'                  THEN 'bid'
           WHEN 'customers'             THEN 'customer'
           WHEN 'projects'              THEN 'project'
           WHEN 'estimates'             THEN 'estimate'
           WHEN 'pay_stubs'             THEN 'pay stub'
           WHEN 'clock_sessions'        THEN 'clock session'
           WHEN 'supply_house_invoices' THEN 'supply house invoice'
           WHEN 'people_labor_jobs'     THEN 'sub labor job'
           WHEN 'purchase_orders'       THEN 'purchase order'
           WHEN 'material_templates'    THEN 'material template'
           WHEN 'person_licenses'       THEN 'licence'
           WHEN 'writeups'              THEN 'writeup'
           ELSE COALESCE(h.head_table, 'partial')
         END,
         CASE
           WHEN h.head_table = 'jobs_ledger' THEN
             COALESCE(NULLIF(h.head_row ->> 'hcp_number', ''), NULLIF(h.head_row ->> 'click_number', ''), '—')
             || ' · ' || COALESCE(NULLIF(h.head_row ->> 'job_name', ''), 'Job')
           WHEN h.head_table = 'bids' THEN
             'Bid ' || COALESCE(NULLIF(h.head_row ->> 'bid_number', ''), '—')
           WHEN h.head_table IS NOT NULL THEN
             -- generic: first name-ish field on the head row, else a short id
             COALESCE(
               NULLIF(h.head_row ->> 'name', ''),
               NULLIF(h.head_row ->> 'project_name', ''),
               NULLIF(h.head_row ->> 'title', ''),
               NULLIF(h.head_row ->> 'invoice_number', ''),
               NULLIF(h.head_row ->> 'estimate_number', ''),
               NULLIF(h.head_row ->> 'person_name', ''),
               NULLIF(h.head_row ->> 'work_date', ''),
               left(h.gk, 8)
             )
           ELSE
             'Partial delete under ' || left(h.gk, 8)
         END,
         h.row_count, h.tables, h.deleted_by,
         (SELECT u.name FROM public.users u WHERE u.id = h.deleted_by),
         h.deleted_at
  FROM head h
  WHERE public.is_dev()
  ORDER BY h.deleted_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;

COMMENT ON FUNCTION public.list_deleted_records(int) IS 'Dev-only: restorable bundles in deleted_records_archive (restored_at IS NULL), newest first, one row per group_key. Non-devs get zero rows. Labels job/bid explicitly; other kinds fall back to a name-ish field on the bundle head.';

GRANT EXECUTE ON FUNCTION public.list_deleted_records(int) TO authenticated;
