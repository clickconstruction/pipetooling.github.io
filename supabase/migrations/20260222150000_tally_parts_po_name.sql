-- Add purchase order name to list_tally_parts_with_po for Jobs Parts tab

DROP FUNCTION IF EXISTS public.list_tally_parts_with_po();

CREATE FUNCTION public.list_tally_parts_with_po()
RETURNS TABLE (
  id UUID,
  job_id UUID,
  fixture_name TEXT,
  part_id UUID,
  quantity NUMERIC,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ,
  price_at_time NUMERIC,
  purchase_order_id UUID,
  purchase_order_name TEXT,
  hcp_number TEXT,
  job_name TEXT,
  job_address TEXT,
  part_name TEXT,
  part_manufacturer TEXT,
  created_by_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jtp.id,
    jtp.job_id,
    jtp.fixture_name,
    jtp.part_id,
    jtp.quantity,
    jtp.created_by_user_id,
    jtp.created_at,
    poi.price_at_time,
    jtp.purchase_order_id,
    po.name AS purchase_order_name,
    jl.hcp_number,
    jl.job_name,
    jl.job_address,
    mp.name AS part_name,
    mp.manufacturer AS part_manufacturer,
    u.name AS created_by_name
  FROM public.jobs_tally_parts jtp
  INNER JOIN public.jobs_ledger jl ON jl.id = jtp.job_id
  LEFT JOIN public.material_parts mp ON mp.id = jtp.part_id
  LEFT JOIN public.users u ON u.id = jtp.created_by_user_id
  LEFT JOIN public.purchase_orders po ON po.id = jtp.purchase_order_id
  LEFT JOIN public.purchase_order_items poi
    ON poi.purchase_order_id = jtp.purchase_order_id
    AND poi.part_id = jtp.part_id
  WHERE EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant')
    AND (
      jl.master_user_id = auth.uid()
      OR public.is_dev()
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = auth.uid() AND assistant_id = jl.master_user_id)
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = jl.master_user_id AND assistant_id = auth.uid())
      OR public.assistants_share_master(auth.uid(), jl.master_user_id)
    )
  )
  OR (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'subcontractor')
    AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = jtp.job_id AND jtm.user_id = auth.uid())
  )
  ORDER BY jtp.created_at DESC;
$$;
