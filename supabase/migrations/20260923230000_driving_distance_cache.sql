SET lock_timeout = '3s';

-- Routed-drive cache for the driving-distance edge function (v2.3773): one row
-- per origin → destination point pair, keyed by the coordinates rounded to
-- five decimals (about a metre). Filled ONLY by the function's service-role
-- client after a Google Routes answer; nothing reads or writes it from the
-- client, so there are deliberately NO policies. A row older than the
-- function's TTL is re-routed and overwritten. Idempotent; additive.

CREATE TABLE IF NOT EXISTS public.driving_distance_cache (
  origin_key text NOT NULL,
  destination_key text NOT NULL,
  distance_meters integer NOT NULL CHECK (distance_meters >= 0),
  duration_seconds integer CHECK (duration_seconds >= 0),
  source text NOT NULL DEFAULT 'google_routes',
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (origin_key, destination_key)
);

COMMENT ON TABLE public.driving_distance_cache IS
  'Routed drive cache for the driving-distance edge function (bid Distance to Office, the clocked-in map''s Travel times): origin/destination keys are lat,lng to five decimals; written only by the function''s service-role client; no client policies.';

ALTER TABLE public.driving_distance_cache ENABLE ROW LEVEL SECURITY;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
