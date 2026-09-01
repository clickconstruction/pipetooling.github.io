SET lock_timeout = '3s';

-- Division 22 audit feed (v2.2598): one aggregate over every bid's count rows —
-- distinct trimmed fixture name + how many bids it appears on. Powers the
-- "Division 22 codes" audit modal (Pricing tab Share ▾ menu), which classifies
-- each name client-side through spec_section_match_rules and lets ledger-writer
-- roles pin exact rules for the uncoded ones.
--
-- SECURITY DEFINER so the aggregate doesn't fan out through per-row RLS on
-- bids_count_rows; gated inside to the same roles that can write the rules
-- ledger. Read-only (STABLE) — no fence appliers needed (no new tables).

CREATE OR REPLACE FUNCTION public.spec_section_fixture_name_audit()
RETURNS TABLE(fixture text, bid_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT btrim(r.fixture) AS fixture, COUNT(DISTINCT r.bid_id) AS bid_count
  FROM public.bids_count_rows r
  WHERE btrim(r.fixture) <> ''
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])
    )
  GROUP BY btrim(r.fixture)
  ORDER BY bid_count DESC, fixture ASC
$$;
