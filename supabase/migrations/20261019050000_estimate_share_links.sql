SET lock_timeout = '3s';

-- Bills and estimates in a message, PR 3 (punch list #127, the owner's pick B; docs/migrations/20261019050000_estimate_share_links.md).
--
-- An estimate's link is a random token whose SHA-256 the row keeps (`estimates.public_token_hash`); the token itself
-- is never stored, so the emailed link cannot be read back, and Resend mints a new one that retires the old. A
-- message needs a link of its own that leaves the emailed one working. So each share makes a second token, kept the
-- same way, in its own table, and the three functions that open an estimate from a link (get-estimate-for-customer,
-- accept-estimate, log-estimate-option-view, through _shared/estimateTokenLookup.ts) read either hash.
--
--   1. estimate_share_links: the estimate, the token's hash (64 hex), who made it and when, and the day it stops
--      working (14 days, as the email's). Read by whoever may read the estimate (the estimates table's own policies,
--      through the subquery); nobody signed in writes it.
--   2. share_estimate_link(p_estimate_id): the office team makes one for a sent or approved estimate and gets the
--      token back once, to put in the message; the URL is the client's (`/estimate/accept?t=`). Refused in words:
--      signed out, a training account, a twin, off the office team, an estimate that is not there or not sent.
--
-- A new table, so the three fence appliers run at the end.

-- ---------- 1. The links ----------

CREATE TABLE IF NOT EXISTS public.estimate_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  token_hash text NOT NULL
    CONSTRAINT estimate_share_links_token_hash_shape CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  made_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  made_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT estimate_share_links_token_hash_one UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS estimate_share_links_estimate_idx ON public.estimate_share_links (estimate_id, made_at DESC);

COMMENT ON TABLE public.estimate_share_links IS
  'Bills and estimates in a message (#127): a second link to an estimate per share, so the link in the customer''s email keeps working. The token''s SHA-256 only, as estimates.public_token_hash keeps the email''s. Made through share_estimate_link; read by the three functions that open an estimate from a link.';

ALTER TABLE public.estimate_share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estimate_share_links_read ON public.estimate_share_links;
CREATE POLICY estimate_share_links_read ON public.estimate_share_links FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.estimates e WHERE e.id = estimate_share_links.estimate_id));

REVOKE ALL ON TABLE public.estimate_share_links FROM anon, authenticated;
GRANT SELECT ON TABLE public.estimate_share_links TO authenticated;

-- ---------- 2. The office makes one ----------

CREATE OR REPLACE FUNCTION public.share_estimate_link(p_estimate_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_status text;
  v_token text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in to share an estimate.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot share an estimate.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot share an estimate.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office can share an estimate.' USING ERRCODE = '42501';
  END IF;
  SELECT e.status::text INTO v_status FROM public.estimates e WHERE e.id = p_estimate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That estimate is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_status NOT IN ('sent', 'customer_accepted') THEN
    RAISE EXCEPTION 'Only a sent estimate can be shared.' USING ERRCODE = 'P0001';
  END IF;
  -- 24 random bytes as URL-safe base64 with no padding: 32 characters, as the email's token reads in a link.
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  INSERT INTO public.estimate_share_links (estimate_id, token_hash, made_by, expires_at)
  VALUES (p_estimate_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_me, now() + interval '14 days');
  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION public.share_estimate_link(uuid) IS
  'Bills and estimates in a message (#127): makes a second link to a sent or approved estimate for a message and returns its token once; the row keeps only the hash, and the emailed link keeps working. The office team only; refuses a training account, a twin, an estimate not there or not sent.';

REVOKE ALL ON FUNCTION public.share_estimate_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_estimate_link(uuid) TO authenticated;

-- ---------- 3. The fences on the new table ----------

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
