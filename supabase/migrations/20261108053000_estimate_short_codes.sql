SET lock_timeout = '3s';

-- The estimate text's link: a ten-character code, and the guard on guessing it (v2.6677, punch list #281 PR 2;
-- docs/migrations/20261108053000_estimate_short_codes.md).
--
-- share_estimate_link (20261019050000_estimate_share_links.sql, #127) minted 24 random bytes as 32 base64url
-- characters. The owner's call 2 of 2026-11-07: the text's code is 10 characters from an alphabet of 31 letters with no
-- 0, O, 1, l or I, so it reads aloud over the phone without a mistake. 31^10 is about 8 × 10^14 codes, about 49.5 bits.
-- The row still keeps only the code's SHA-256 (the hash the edge functions compute from the `t` in the link), so the
-- shape check, the unique, the 14 days and _shared/estimateTokenLookup.ts are unchanged, and a 32-character link made
-- before this migration keeps opening until its day.
--
--   1. share_estimate_link(p_estimate_id): the same refusals; the token is now the ten-letter code. Each byte of
--      gen_random_bytes is used only when it is under 248 (8 × 31), so every letter is as likely as every other; a
--      code the table already holds (one chance in 10^14) is thrown away and minted again.
--   2. estimate_link_misses: the hour, a SHA-256 of the caller's address (never the address itself) and the count of
--      links from it that opened nothing. estimate_link_miss(p_source_hash) bumps the hour's row and answers the count;
--      the three functions that open an estimate from a link call it on a lookup that finds no hash and answer 429
--      once the count passes 20 in the hour (_shared/estimateLinkMisses.ts). The service role alone may call it;
--      nobody signed in reads or writes the table (RLS on, no permissive policy, every grant revoked). A nightly
--      pg_cron line drops hours older than a day.
--
-- A new table, so the four fence appliers run at the end.

-- ---------- 1. The ten-letter code ----------

CREATE OR REPLACE FUNCTION public.share_estimate_link(p_estimate_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_status text;
  -- 31 letters: the digits 2–9 and the lowercase letters without l and o, nothing that reads as another over the phone.
  v_alphabet CONSTANT text := '23456789abcdefghjkmnpqrstuvwxyz';
  v_length CONSTANT int := 10;
  v_bytes bytea;
  v_i int;
  v_b int;
  v_code text;
  v_tries int := 0;
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
  LOOP
    v_code := '';
    v_bytes := extensions.gen_random_bytes(32);
    v_i := 0;
    WHILE length(v_code) < v_length LOOP
      IF v_i >= length(v_bytes) THEN
        v_bytes := extensions.gen_random_bytes(32);
        v_i := 0;
      END IF;
      v_b := get_byte(v_bytes, v_i);
      v_i := v_i + 1;
      -- 248 = 8 × 31: a byte at or past it is thrown away, so no letter is likelier than another.
      IF v_b < 248 THEN
        v_code := v_code || substr(v_alphabet, (v_b % 31) + 1, 1);
      END IF;
    END LOOP;
    BEGIN
      INSERT INTO public.estimate_share_links (estimate_id, token_hash, made_by, expires_at)
      VALUES (p_estimate_id, encode(extensions.digest(v_code, 'sha256'), 'hex'), v_me, now() + interval '14 days');
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- The same code twice: one chance in 10^14. Mint another; give up only if it keeps happening.
      v_tries := v_tries + 1;
      IF v_tries >= 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.share_estimate_link(uuid) IS
  'The estimate text''s link (#127, #281): makes a second link to a sent or approved estimate and returns its code once, ten letters from an alphabet with no look-alikes (v2.6677); the row keeps only the SHA-256, and the emailed link keeps working. The office team only; refuses a training account, a twin, an estimate not there or not sent.';

REVOKE ALL ON FUNCTION public.share_estimate_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_estimate_link(uuid) TO authenticated;

-- ---------- 2. The guard on guessing ----------

CREATE TABLE IF NOT EXISTS public.estimate_link_misses (
  hour timestamptz NOT NULL,
  source_hash text NOT NULL
    CONSTRAINT estimate_link_misses_source_hash_shape CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  misses integer NOT NULL DEFAULT 0,
  CONSTRAINT estimate_link_misses_pkey PRIMARY KEY (hour, source_hash)
);

COMMENT ON TABLE public.estimate_link_misses IS
  'The guard on guessing an estimate link (#281, v2.6677): by the hour, the SHA-256 of a caller''s address (never the address) and how many links from it opened nothing. Bumped by estimate_link_miss from the three functions that open an estimate from a link; past 20 in the hour they answer 429. Nobody signed in reads or writes it; a nightly cron drops hours older than a day.';

ALTER TABLE public.estimate_link_misses ENABLE ROW LEVEL SECURITY;
-- No permissive policy on purpose: the service role bypasses RLS, and no signed-in role has a reason to read a count.
REVOKE ALL ON TABLE public.estimate_link_misses FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.estimate_link_miss(p_source_hash text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.estimate_link_misses AS m (hour, source_hash, misses)
  VALUES (date_trunc('hour', now()), p_source_hash, 1)
  ON CONFLICT (hour, source_hash) DO UPDATE SET misses = m.misses + 1
  RETURNING m.misses;
$$;

COMMENT ON FUNCTION public.estimate_link_miss(text) IS
  'One more estimate link that opened nothing from this source (the SHA-256 of its address) in the current hour; answers the hour''s count (#281, v2.6677). The service role alone, from get-estimate-for-customer, accept-estimate and log-estimate-option-view.';

REVOKE ALL ON FUNCTION public.estimate_link_miss(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estimate_link_miss(text) TO service_role;

-- Nightly: an hour older than a day says nothing anyone reads.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-estimate-link-misses') THEN
      PERFORM cron.unschedule('purge-estimate-link-misses');
    END IF;
    PERFORM cron.schedule(
      'purge-estimate-link-misses', '40 9 * * *',
      $cmd$DELETE FROM public.estimate_link_misses WHERE hour < now() - interval '1 day'$cmd$
    );
  ELSE
    RAISE WARNING 'pg_cron not installed; estimate_link_misses nightly purge not scheduled';
  END IF;
END $$;

-- ---------- 3. The fences on the new table ----------

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
