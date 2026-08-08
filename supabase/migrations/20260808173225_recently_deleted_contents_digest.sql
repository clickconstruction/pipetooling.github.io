SET lock_timeout = '3s';

-- Recently deleted (dev) — upfront contents digest.
--
-- The bundle cards all read "N rows across M tables"; seeing what actually
-- died means clicking "What's inside?" per bundle (a full row_data fetch).
-- After a bulk-deletion alert that is dozens of clicks. Two additive columns
-- let every card carry a real digest with zero extra round trips:
--
--   table_counts  jsonb  {"invoices": 3, "jobs_ledger_line_items": 12, ...}
--   preview_items jsonb  up to 5 trimmed rows [{"table_name": ..., "fields": {...}}],
--                        money tables (invoices, payments, pay stubs, supply house
--                        invoices, purchase orders) first, head row excluded (it
--                        already IS the label). "fields" keeps only the summary
--                        whitelist mirrored from src/lib/deletedRecordContents.ts —
--                        never the whole row.
--
-- RETURNS TABLE gains columns, which CREATE OR REPLACE cannot do → DROP first
-- (transactional, and the GRANT is re-issued below). Old clients ignore the
-- extra columns; the new client treats both as optional, so deploy order stays
-- free (client first, then this push).

DROP FUNCTION IF EXISTS public.list_deleted_records(int);

CREATE FUNCTION public.list_deleted_records(p_limit int DEFAULT 50)
RETURNS TABLE (
  group_key       text,
  kind            text,
  label           text,
  row_count       bigint,
  tables          text[],
  deleted_by      uuid,
  deleted_by_name text,
  deleted_at      timestamptz,
  table_counts    jsonb,
  preview_items   jsonb
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
  counts AS (
    SELECT t.gk, jsonb_object_agg(t.table_name, t.n) AS table_counts
    FROM (
      SELECT a.group_key AS gk, a.table_name, count(*) AS n
      FROM public.deleted_records_archive a
      WHERE a.restored_at IS NULL AND a.group_key IS NOT NULL
      GROUP BY a.group_key, a.table_name
    ) t
    GROUP BY t.gk
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
           WHEN h.head_table = 'clock_sessions' THEN
             COALESCE(
               (SELECT u.name || ' · ' FROM public.users u WHERE u.id::text = h.head_row ->> 'user_id'),
               ''
             )
             || COALESCE(NULLIF(h.head_row ->> 'work_date', ''), left(h.gk, 8))
             || COALESCE(
                  (SELECT ' · ' || COALESCE(NULLIF(j.hcp_number, ''), NULLIF(j.click_number, ''), 'job')
                   FROM public.jobs_ledger j WHERE j.id::text = h.head_row ->> 'job_ledger_id'),
                  ''
                )
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
             COALESCE(
               (SELECT 'Under job ' || COALESCE(NULLIF(j.hcp_number, ''), NULLIF(j.click_number, ''), '—')
                       || ' · ' || COALESCE(NULLIF(j.job_name, ''), 'Job')
                FROM public.jobs_ledger j WHERE j.id::text = h.gk),
               (SELECT 'Under bid ' || COALESCE(NULLIF(bd.bid_number, ''), '—')
                FROM public.bids bd WHERE bd.id::text = h.gk),
               (SELECT 'Under customer ' || c.name
                FROM public.customers c WHERE c.id::text = h.gk),
               (SELECT 'Under project ' || COALESCE(NULLIF(p.name, ''), '—')
                FROM public.projects p WHERE p.id::text = h.gk),
               (SELECT 'Under estimate ' || COALESCE(e.estimate_number::text, '—')
                FROM public.estimates e WHERE e.id::text = h.gk),
               'Partial delete under ' || left(h.gk, 8)
             )
         END,
         h.row_count, h.tables, h.deleted_by,
         (SELECT u.name FROM public.users u WHERE u.id = h.deleted_by),
         h.deleted_at,
         c.table_counts,
         pv.preview_items
  FROM head h
  LEFT JOIN counts c ON c.gk = h.gk
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
             jsonb_build_object('table_name', p.table_name, 'fields', p.fields)
             ORDER BY p.pri, p.deleted_at, p.id
           ) AS preview_items
    FROM (
      SELECT x.id, x.table_name, x.deleted_at,
             CASE WHEN x.table_name IN
               ('invoices', 'payments_made', 'pay_stubs', 'supply_house_invoices', 'purchase_orders')
               THEN 0 ELSE 1 END AS pri,
             (SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
              FROM jsonb_each(x.row_data) e
              WHERE e.key = ANY (ARRAY[
                'job_name', 'project_name', 'person_name', 'name', 'title', 'label',
                'invoice_number', 'bid_number', 'estimate_number', 'po_number',
                'part_name', 'description', 'fixture_name', 'item_name',
                'work_date', 'date', 'due_date', 'invoice_date', 'scheduled_date', 'block_date',
                'amount', 'total', 'gross_pay', 'total_amount', 'price', 'cost',
                'quantity', 'hours', 'hours_total'
              ])) AS fields
      FROM public.deleted_records_archive x
      WHERE x.group_key = h.gk
        AND x.restored_at IS NULL
        AND x.record_id IS DISTINCT FROM h.gk
      ORDER BY pri, x.deleted_at, x.id
      LIMIT 5
    ) p
  ) pv ON true
  WHERE public.is_dev()
  ORDER BY h.deleted_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;

GRANT EXECUTE ON FUNCTION public.list_deleted_records(int) TO authenticated;
