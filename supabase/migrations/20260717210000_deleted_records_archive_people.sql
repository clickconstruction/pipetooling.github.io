-- Deleted-records archive coverage: public.people (the roster table) + its cascade children.
--
-- Found while sweeping delete-dialog copy (v2.707): `people` is UI-hard-deletable (People.tsx
-- `from('people').delete()`) but was NOT in the archive trigger set, so deleting a person was genuinely
-- unrecoverable — the one covered-tables gap left after tier 2 (v2.702). Its "cannot be undone" dialog
-- was correctly left as-is in v2.707 precisely because of this; now it's recoverable, and a follow-up
-- can soften that copy.
--
-- Note `people` (roster) is NOT `public.users` (accounts) — different table. Its cascade closure is
-- small: the row itself plus four ON DELETE CASCADE children. Chosen from the LIVE catalog, not by hand.
--
-- No cross-table restore-blocker to fix here: the already-covered children that reference people
-- (pay_stubs, pay_stub_days, hours_reviewed, people_pay_config, person_offsets) do so via a NULLABLE FK
-- and do NOT cascade (RESTRICT / SET NULL), so they are unaffected. The value is simply that a person
-- delete now captures the person + its genuine cascade children and can be restored.
--
-- 1 client delete, 0 server-side DELETEs — a real user action, unlike the deliberately-excluded
-- people_hours (derived/machine-churned). restore_deleted_records needs no change: it topo-sorts insert
-- order from the live pg_constraint catalog, so people-before-children is automatic.

DO $do$
DECLARE
  r         record;
  arg_frag  text;
BEGIN
  FOR r IN
    SELECT tbl, cols FROM (VALUES
      ('people',                     ARRAY[]::text[]),          -- own id
      ('external_team_job_payments', ARRAY['person_id']),
      ('external_team_sub_managers', ARRAY['person_id']),       -- composite PK, no id; bundles by person_id
      ('people_labels',              ARRAY['person_id']),       -- composite PK, no id; bundles by person_id
      ('team_feedback_peer_ratings', ARRAY['peer_person_id'])
    ) AS t(tbl, cols)
  LOOP
    IF to_regclass(format('public.%I', r.tbl)) IS NULL THEN
      RAISE WARNING 'deleted_records_archive people-coverage: table public.% not found, skipping', r.tbl;
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


-- Refresh list_deleted_records so a deleted person lists as kind 'person' with a readable name, rather
-- than the raw table name. Body is otherwise identical to the v2.702 version.
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
           WHEN 'people'                THEN 'person'
           ELSE COALESCE(h.head_table, 'partial')
         END,
         CASE
           WHEN h.head_table = 'jobs_ledger' THEN
             COALESCE(NULLIF(h.head_row ->> 'hcp_number', ''), NULLIF(h.head_row ->> 'click_number', ''), '—')
             || ' · ' || COALESCE(NULLIF(h.head_row ->> 'job_name', ''), 'Job')
           WHEN h.head_table = 'bids' THEN
             'Bid ' || COALESCE(NULLIF(h.head_row ->> 'bid_number', ''), '—')
           WHEN h.head_table IS NOT NULL THEN
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

GRANT EXECUTE ON FUNCTION public.list_deleted_records(int) TO authenticated;
