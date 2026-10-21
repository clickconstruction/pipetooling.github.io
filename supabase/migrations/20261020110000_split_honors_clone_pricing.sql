SET lock_timeout = '3s';

-- Punch list #137 follow-up: on an unsplit bid, the "Split into two versions" window's
-- "Copy all this bid's prices" checkbox was unticked and the NEW child still came out with its
-- own starred price copies (live walk 2026-10-21, ZZ bid B517) — while the already-split
-- "+ version" path, which calls create_bid_version directly with the same p_clone_pricing,
-- honors the box. Every definition in this repo honors the flag: the client passes the
-- checkbox, split_bid_into_versions forwards it, and create_bid_version's whole clone-and-★
-- block sits inside IF p_clone_pricing THEN. The only way the live symptom can happen is a
-- drifted prod body of split_bid_into_versions (the one function only the unsplit path
-- exercises). This re-asserts the repo's definition — verbatim the newest (and only) body,
-- 20260610190000 — so prod converges back to the repo; where prod already matches, a no-op.
CREATE OR REPLACE FUNCTION public.split_bid_into_versions(
  p_bid_id uuid,
  p_current_name text,
  p_new_name text,
  p_clone_pricing boolean,
  p_pricing_source_version_id uuid
) RETURNS uuid
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_base uuid;
  v_new uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  v_base := public.materialize_bid_version(p_bid_id, p_current_name);
  v_new := public.create_bid_version(p_bid_id, p_new_name, v_base, p_clone_pricing, p_pricing_source_version_id);
  RETURN v_new;
END;
$$;

COMMENT ON FUNCTION public.split_bid_into_versions(uuid, text, text, boolean, uuid) IS
  'Atomic first-split: materialize current setup as a named version + create a new variant, one transaction. Returns the new variant id. p_clone_pricing=false leaves the new variant unpriced (re-asserted 20261020110000).';
