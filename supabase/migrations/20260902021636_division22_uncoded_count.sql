SET lock_timeout = '3s';

-- Division 22 Needs You feed (v2.2627): one cheap count for the dashboard —
-- how many distinct trimmed fixture names match NO rule in the ledger
-- (a NULL-section rule counts as handled: "deliberately no code", matching
-- the client kernel's semantics). Matching mirrors classifySpecSection:
-- case-insensitive on trimmed strings; position()/left() instead of LIKE so
-- patterns containing % or _ (e.g. "our 15 %") can never wildcard-match.
-- SECURITY DEFINER (skips per-row RLS fan-out over bids_count_rows), gated
-- inside to the ledger-writer roles. STABLE, read-only, no new tables.

CREATE OR REPLACE FUNCTION public.spec_section_uncoded_name_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM (
    SELECT DISTINCT lower(btrim(r.fixture)) AS name
    FROM public.bids_count_rows r
    WHERE btrim(r.fixture) <> ''
  ) n
  WHERE EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.spec_section_match_rules m
      WHERE btrim(m.pattern) <> ''
        AND CASE m.match_kind
          WHEN 'exact' THEN n.name = lower(btrim(m.pattern))
          WHEN 'starts_with' THEN left(n.name, length(lower(btrim(m.pattern)))) = lower(btrim(m.pattern))
          ELSE position(lower(btrim(m.pattern)) IN n.name) > 0
        END
    )
$$;
