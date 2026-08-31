SET lock_timeout = '3s';

-- Shadows lens (v2.2544): the sealed envelope becomes REAL at the API layer.
-- v2.2539 gave staff a blanket SELECT on twin_shadow_runs — which exposes
-- locked_total on unscored runs. Seeing the robot's sealed number before the
-- human bid is sent could anchor the estimate and contaminate the blindness in
-- the other direction. Staff now read through list_shadow_runs(), which nulls
-- the money columns until a run is scored. Twin-mcp (service role) bypasses
-- RLS and is unaffected.

DROP POLICY IF EXISTS twin_shadow_runs_select ON public.twin_shadow_runs;

CREATE OR REPLACE FUNCTION public.list_shadow_runs()
RETURNS TABLE (
  id uuid,
  status text,
  axis text,
  created_at timestamptz,
  locked_at timestamptz,
  scored_at timestamptz,
  shadow_bid_number text,
  reference_bid_number text,
  project_name text,
  requested_by_name text,
  reference_sent_at timestamptz,
  locked_total numeric,
  reference_value numeric,
  delta_pct numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.status,
    r.axis,
    r.created_at,
    r.locked_at,
    r.scored_at,
    sb.bid_number AS shadow_bid_number,
    rb.bid_number AS reference_bid_number,
    rb.project_name,
    ru.name AS requested_by_name,
    rb.bid_date_sent::timestamptz AS reference_sent_at,
    -- The seal: money columns stay NULL until the run is scored.
    CASE WHEN r.status = 'scored' THEN r.locked_total END AS locked_total,
    CASE WHEN r.status = 'scored' THEN r.reference_value END AS reference_value,
    CASE WHEN r.status = 'scored' THEN r.delta_pct END AS delta_pct
  FROM public.twin_shadow_runs r
  JOIN public.bids sb ON sb.id = r.shadow_bid_id
  JOIN public.bids rb ON rb.id = r.reference_bid_id
  LEFT JOIN public.users ru ON ru.id = rb.robot_requested_by
  ORDER BY r.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_shadow_runs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_shadow_runs() TO service_role;
REVOKE EXECUTE ON FUNCTION public.list_shadow_runs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_shadow_runs() FROM public;
