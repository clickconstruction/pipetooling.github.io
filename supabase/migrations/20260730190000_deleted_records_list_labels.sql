SET lock_timeout = '3s';

-- Recently deleted (dev) — label quality pass (v2.1129).
--
-- Two blind spots in list_deleted_records():
--   1. Partial bundles (children deleted while the parent lives on) rendered as
--      "Partial delete under f845bed0" — the group_key IS the live parent's id,
--      so we can name it: "Under job 878 · Take 5- Seguin".
--   2. clock_sessions bundles labeled by work_date alone — now "<user> · <date>"
--      (plus the job number when the session points at a live job).
--
-- Return shape is UNCHANGED (same columns, same types), so old clients keep
-- working regardless of deploy order. CREATE OR REPLACE only — no table DDL.

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
             -- Partial bundle: the parent survived the delete, so name it.
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
         h.deleted_at
  FROM head h
  WHERE public.is_dev()
  ORDER BY h.deleted_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;

GRANT EXECUTE ON FUNCTION public.list_deleted_records(int) TO authenticated;
