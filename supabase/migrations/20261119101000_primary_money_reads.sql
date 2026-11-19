SET lock_timeout = '3s';

-- A primary's money reads on one job, held to the job's people (punch list #400, PR 2 of 5;
-- to-dos/primary-job-doors.md). The tables behind these reads have carried the restrictive primary_scope_* fence
-- since 20260823172141 (job_activity_events, jobs_ledger_invoices, jobs_ledger_payments, jobs_ledger_fixtures,
-- jobs_tally_parts). The functions below run as the owner, so the fence never reached them, and each let a primary
-- through on the role alone, or on master_primaries, which has paired every master with every primary since v2.921.
-- On a whole-schema bed a primary on no job read another job's activity with its money lines, its supply house
-- bills, its parts and its payment's lines.
--
-- Each function is its live definition (pg_get_functiondef on a bed that holds every migration on main at
-- aa0e5ff7f) with ONE change, named in its header line:
--   * can_read_job_activity(job, financial): in both legs the primary clause takes `and public.is_job_people(j.id)`
--     (20261019060000, widened 20261108100000). The crew leg of the plain half stays, so a primary on a job's crew
--     reads the plain feed, as a helper does. It is the gate of list_job_activity_events, job_account_job_identity,
--     list_job_account_strip, the read and the request policies of job_supply_house_accounts and of
--     trip_put_on_job_line, so each follows with nothing else rewritten.
--   * get_invoice_amounts_for_jobs, get_invoice_allocation_lines_for_jobs, list_tally_parts_with_po: the primary
--     leg asks `public.is_job_people(jl.id)` in place of the master_primaries row.
--   * get_payment_line_items and its bulk shape: the gate is a role list with no job in it, so the payment's own
--     row takes `AND (NOT public.is_primary() OR public.is_job_people(p.job_id))`.
-- is_job_people is the scope of a primary's own money strips (list_my_money_strip, list_customer_money_strip,
-- list_bid_money_strip) and of the paid verbs, so their screens keep every number they show. Dev, master,
-- assistant, controller, estimator, superintendent, helper and subcontractor are untouched. No name, argument or
-- returned shape changes. CREATE OR REPLACE keeps each function's grants and owner. Idempotent.

-- ---------- can_read_job_activity(uuid,boolean): both legs, the primary clause ----------

CREATE OR REPLACE FUNCTION public.can_read_job_activity(p_job_id uuid, p_financial boolean)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p_financial then (
      exists (
        select 1 from public.users u
        where u.id = auth.uid()
          and u.role = any (array['dev','master_technician','assistant', 'controller','primary']::user_role[])
      )
      and exists (
        select 1 from public.jobs_ledger j
        where j.id = p_job_id
          and (
            j.master_user_id = auth.uid()
            or public.is_dev()
            or (exists (select 1 from public.users u2 where u2.id = auth.uid() and u2.role = 'primary'::user_role) and public.is_job_people(j.id))
            or public.is_office_or_estimator()
            or public.is_office_or_estimator()
            or public.assistants_share_master(auth.uid(), j.master_user_id)
          )
      )
    )
    else exists (
      select 1 from public.jobs_ledger j
      where j.id = p_job_id
        and (
          j.master_user_id = auth.uid()
          or public.is_dev()
          or (exists (select 1 from public.users u2 where u2.id = auth.uid() and u2.role = 'primary'::user_role) and public.is_job_people(j.id))
          or public.is_office_or_estimator()
          or public.is_office_or_estimator()
          or public.assistants_share_master(auth.uid(), j.master_user_id)
          or exists (select 1 from public.jobs_ledger_team_members t where t.job_id = j.id and t.user_id = auth.uid())
        )
    )
  end;
$function$;

-- ---------- get_invoice_amounts_for_jobs(uuid[]): the primary leg, the job's people in place of the adoption that pairs every master with every primary ----------

CREATE OR REPLACE FUNCTION public.get_invoice_amounts_for_jobs(p_job_ids uuid[])
 RETURNS TABLE(job_id uuid, invoice_amount numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH visible_jobs AS (
    SELECT jl.id
    FROM public.jobs_ledger jl
    WHERE jl.id = ANY(p_job_ids)
    AND (
      (auth.role() = 'service_role' AND auth.uid() IS NULL)
      OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller')
        AND (
          jl.master_user_id = auth.uid()
          OR public.is_dev()
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), jl.master_user_id)
        )
      )
      OR (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
        AND public.is_job_people(jl.id)
      )
      OR (
        public.auth_uid_is_helpers_or_subcontractor()
        AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = jl.id AND jtm.user_id = auth.uid())
      )
    )
  )
  SELECT
    a.job_id,
    COALESCE(SUM(i.amount * a.pct / 100), 0)::numeric AS invoice_amount
  FROM public.supply_house_invoice_job_allocations a
  INNER JOIN public.supply_house_invoices i ON i.id = a.invoice_id
  INNER JOIN visible_jobs v ON v.id = a.job_id
  GROUP BY a.job_id;
$function$;

-- ---------- get_invoice_allocation_lines_for_jobs(uuid[]): the primary leg, the same ----------

CREATE OR REPLACE FUNCTION public.get_invoice_allocation_lines_for_jobs(p_job_ids uuid[])
 RETURNS TABLE(job_id uuid, invoice_id uuid, allocated_amount numeric, invoice_number text, invoice_date date, invoice_total_amount numeric, supply_house_name text, website_url text, invoice_link text, pct numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH visible_jobs AS (
    SELECT jl.id
    FROM public.jobs_ledger jl
    WHERE jl.id = ANY(p_job_ids)
    AND (
      EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller')
        AND (
          jl.master_user_id = auth.uid()
          OR public.is_dev()
          OR public.is_office_or_estimator()
          OR public.is_office_or_estimator()
          OR public.assistants_share_master(auth.uid(), jl.master_user_id)
        )
      )
      OR (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
        AND public.is_job_people(jl.id)
      )
      OR (
        public.auth_uid_is_helpers_or_subcontractor()
        AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = jl.id AND jtm.user_id = auth.uid())
      )
    )
  )
  SELECT
    a.job_id,
    a.invoice_id,
    (i.amount * a.pct / 100)::numeric AS allocated_amount,
    i.invoice_number::text,
    i.invoice_date::date AS invoice_date,
    i.amount::numeric AS invoice_total_amount,
    COALESCE(sh.name, '')::text AS supply_house_name,
    sh.website_url::text AS website_url,
    i.link::text AS invoice_link,
    a.pct
  FROM public.supply_house_invoice_job_allocations a
  INNER JOIN public.supply_house_invoices i ON i.id = a.invoice_id
  INNER JOIN public.supply_houses sh ON sh.id = i.supply_house_id
  INNER JOIN visible_jobs v ON v.id = a.job_id
  ORDER BY a.job_id, i.invoice_date DESC NULLS LAST, i.invoice_number;
$function$;

-- ---------- list_tally_parts_with_po(): the primary leg, the same ----------

CREATE OR REPLACE FUNCTION public.list_tally_parts_with_po()
 RETURNS TABLE(id uuid, job_id uuid, fixture_name text, part_id uuid, quantity numeric, created_by_user_id uuid, created_at timestamp with time zone, price_at_time numeric, fixture_cost numeric, purchase_order_id uuid, purchase_order_name text, purchase_order_status text, hcp_number text, job_name text, job_address text, part_name text, part_manufacturer text, created_by_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jtp.id, jtp.job_id, jtp.fixture_name, jtp.part_id, jtp.quantity, jtp.created_by_user_id, jtp.created_at,
    poi.price_at_time, jtp.fixture_cost, jtp.purchase_order_id, po.name AS purchase_order_name, po.status::TEXT AS purchase_order_status,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
    jl.job_name, jl.job_address, mp.name AS part_name, mp.manufacturer AS part_manufacturer, u.name AS created_by_name
  FROM public.jobs_tally_parts jtp
  INNER JOIN public.jobs_ledger jl ON jl.id = jtp.job_id
  LEFT JOIN public.material_parts mp ON mp.id = jtp.part_id
  LEFT JOIN public.users u ON u.id = jtp.created_by_user_id
  LEFT JOIN public.purchase_orders po ON po.id = jtp.purchase_order_id
  LEFT JOIN public.purchase_order_items poi ON poi.purchase_order_id = jtp.purchase_order_id AND poi.part_id = jtp.part_id
  WHERE (auth.role() = 'service_role' AND auth.uid() IS NULL)
  OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller')
    AND (jl.master_user_id = auth.uid() OR public.is_dev()
      OR public.is_office_or_estimator()
      OR public.is_office_or_estimator()
      OR public.assistants_share_master(auth.uid(), jl.master_user_id)))
  OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    AND public.is_job_people(jl.id))
  OR (public.auth_uid_is_helpers_or_subcontractor()
    AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = jtp.job_id AND jtm.user_id = auth.uid()))
  ORDER BY jtp.created_at DESC;
$function$;

-- ---------- get_payment_line_items(uuid): a primary reads a payment's lines on the jobs they are people of ----------

CREATE OR REPLACE FUNCTION public.get_payment_line_items(p_payment_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH gate AS (
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid())
             AND u.role IN ('master_technician', 'primary')
         )
      AS ok
),
pmt AS (
  SELECT p.id, p.invoice_id, p.job_id, i.amount AS bill_amount
  FROM public.jobs_ledger_payments p
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  WHERE p.id = p_payment_id
    AND (NOT public.is_primary() OR public.is_job_people(p.job_id))
),
items AS (
  SELECT f.name, f.count, f.line_unit_price, f.line_description, f.sequence_order
  FROM public.jobs_ledger_fixtures f, pmt
  WHERE (pmt.invoice_id IS NOT NULL AND f.invoice_id = pmt.invoice_id)
     OR (pmt.invoice_id IS NULL AND f.job_id = pmt.job_id)
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) OR NOT EXISTS (SELECT 1 FROM pmt) THEN NULL ELSE
  jsonb_build_object(
    'linked', (SELECT invoice_id IS NOT NULL FROM pmt),
    'billAmount', (SELECT bill_amount FROM pmt),
    'items',
    COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object(
                  'name', name,
                  'count', count,
                  'unitPrice', line_unit_price,
                  'description', line_description,
                  'amount', CASE WHEN line_unit_price IS NULL THEN NULL ELSE round((count * line_unit_price)::numeric, 2) END
                )
                ORDER BY sequence_order, name
              )
         FROM items),
      '[]'::jsonb
    )
  )
END
$function$;

-- ---------- get_payment_line_items_bulk(uuid[]): the same, per payment ----------

CREATE OR REPLACE FUNCTION public.get_payment_line_items_bulk(p_payment_ids uuid[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH gate AS (
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid())
             AND u.role IN ('master_technician', 'primary')
         )
      AS ok
),
pmts AS (
  SELECT p.id, p.invoice_id, p.job_id, i.amount AS bill_amount
  FROM public.jobs_ledger_payments p
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  WHERE p.id = ANY (p_payment_ids[1:200])
    AND (NOT public.is_primary() OR public.is_job_people(p.job_id))
),
items AS (
  SELECT
    pm.id AS payment_id,
    f.name, f.count, f.line_unit_price, f.line_description, f.sequence_order
  FROM pmts pm
  JOIN public.jobs_ledger_fixtures f
    ON (pm.invoice_id IS NOT NULL AND f.invoice_id = pm.invoice_id)
    OR (pm.invoice_id IS NULL AND f.job_id = pm.job_id)
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  COALESCE(
    (SELECT jsonb_object_agg(
              pm.id::text,
              jsonb_build_object(
                'linked', pm.invoice_id IS NOT NULL,
                'billAmount', pm.bill_amount,
                'items',
                COALESCE(
                  (SELECT jsonb_agg(
                            jsonb_build_object(
                              'name', it.name,
                              'count', it.count,
                              'unitPrice', it.line_unit_price,
                              'description', it.line_description,
                              'amount', CASE WHEN it.line_unit_price IS NULL THEN NULL ELSE round((it.count * it.line_unit_price)::numeric, 2) END
                            )
                            ORDER BY it.sequence_order, it.name
                          )
                     FROM items it
                    WHERE it.payment_id = pm.id),
                  '[]'::jsonb
                )
              )
            )
       FROM pmts pm),
    '{}'::jsonb
  )
END
$function$;

