SET lock_timeout = '3s';

-- Journey-map Tier-3 B19 (C68 — findings J28-F1 / J28-N1). The three header-search RPCs
-- built their ILIKE patterns straight from the typed text, so a stray `%` or `_` widened a
-- job / bid / estimate search to "the 50 newest rows", and `search_jobs_ledger` ordered the
-- effective job number as TEXT under `LIMIT 50` — "J999" outranked "J1004", so the cap dropped
-- the newest jobs first. Every picker that calls these RPCs (header search, Clock In, Dispatch
-- / Estimator task modals, Hours Unassigned, Crew Jobs, Supply-house bills, Mercury
-- allocations) inherits both fixes; no client change is needed and clients keep passing raw
-- text (escaping happens here once — do NOT escape on the client too).
--
-- ESCAPE RULE (one place, `public.escape_like_pattern`): in user text destined for a LIKE /
-- ILIKE pattern, `\` -> `\\`, `%` -> `\%`, `_` -> `\_`. LIKE's default ESCAPE character is
-- the backslash, so no ESCAPE clause is needed at the call sites. Apply it to the REMAINDER
-- after any prefix strip ("J1004" -> "1004"), never to the prefix comparison itself, which is
-- now a literal `left(text, n) = prefix` equality instead of `text LIKE prefix || '%'`.
--
-- Signatures, RETURNS shapes, SECURITY mode (jobs + bids: SECURITY DEFINER; estimates:
-- SECURITY INVOKER), `search_path`, LIMIT 50 and grants are unchanged — plain
-- CREATE OR REPLACE, so `src/types/database.ts` needs no regeneration.

-- ---------------------------------------------------------------------------------------
-- 0) The escape helper.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.escape_like_pattern(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
SET search_path TO ''
AS $$
  SELECT replace(replace(replace(p_text, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
$$;

COMMENT ON FUNCTION public.escape_like_pattern(text) IS
  'Escape user text for use inside a LIKE / ILIKE pattern: backslash -> \\, % -> \%, _ -> \_ (default ESCAPE char is backslash). Used by search_jobs_ledger, search_bids_for_clock, search_estimates_for_nav (v2.2902).';

GRANT EXECUTE ON FUNCTION public.escape_like_pattern(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- 1) search_jobs_ledger — job picker / global search. Escaped patterns + numeric ordering
--    of the effective (hcp-else-click) job number: rows with a number first, by the first
--    run of digits descending (25077 > 999), ties and letter-only numbers by text.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_jobs_ledger(search_text text DEFAULT ''::text)
RETURNS TABLE(id uuid, service_type_id uuid, service_type_name text, hcp_number text, job_name text, job_address text, click_number text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH q AS (
    SELECT
      coalesce(search_text, '') AS raw,
      public.escape_like_pattern(coalesce(search_text, '')) AS esc,
      -- Legacy "J1004" -> "1004": the remainder after the J, escaped.
      CASE
        WHEN length(coalesce(search_text, '')) >= 2 AND lower(left(search_text, 1)) = 'j'
        THEN public.escape_like_pattern(substring(search_text from 2))
      END AS j_rest
  )
  SELECT
    r.id,
    r.service_type_id,
    r.service_type_name,
    r.hcp_number,
    r.job_name,
    r.job_address,
    r.click_number
  FROM (
    SELECT
      jl.id,
      jl.service_type_id,
      coalesce(stj.name, '')::text AS service_type_name,
      coalesce(jl.hcp_number, '')::text AS hcp_number,
      coalesce(jl.job_name, '')::text AS job_name,
      coalesce(jl.job_address, '')::text AS job_address,
      coalesce(jl.click_number, '')::text AS click_number,
      coalesce(nullif(jl.hcp_number, ''), jl.click_number, '') AS effective_number
    FROM public.jobs_ledger jl
    LEFT JOIN public.service_types stj ON stj.id = jl.service_type_id
    CROSS JOIN q
    WHERE (
      q.raw = ''
      OR jl.hcp_number ILIKE '%' || q.esc || '%'
      OR jl.click_number ILIKE '%' || q.esc || '%'
      OR (
        q.j_rest IS NOT NULL
        AND (
          jl.hcp_number ILIKE '%' || q.j_rest || '%'
          OR jl.click_number ILIKE '%' || q.j_rest || '%'
        )
      )
      OR jl.job_name ILIKE '%' || q.esc || '%'
      OR jl.job_address ILIKE '%' || q.esc || '%'
      OR EXISTS (
        SELECT 1
        FROM public.service_types st
        WHERE st.ledger_job_prefix IS NOT NULL
          AND btrim(st.ledger_job_prefix) <> ''
          AND q.raw <> ''
          AND length(q.raw) > length(btrim(st.ledger_job_prefix))
          AND lower(left(q.raw, length(btrim(st.ledger_job_prefix)))) = lower(btrim(st.ledger_job_prefix))
          AND (
            jl.hcp_number ILIKE '%' || public.escape_like_pattern(substring(q.raw from length(btrim(st.ledger_job_prefix)) + 1)) || '%'
            OR jl.click_number ILIKE '%' || public.escape_like_pattern(substring(q.raw from length(btrim(st.ledger_job_prefix)) + 1)) || '%'
          )
      )
    )
  ) r
  ORDER BY
    (CASE WHEN r.effective_number = '' THEN 1 ELSE 0 END),
    (substring(r.effective_number from '[0-9]+'))::numeric DESC NULLS LAST,
    r.effective_number DESC
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.search_jobs_ledger(text) IS
  'Search jobs_ledger by HCP / Click number, job name, or address. J prefix and ledger_job_prefix normalized; %/_/\ in the typed text are escaped (escape_like_pattern); ordered by job number NUMERICALLY (first digit run, desc) under LIMIT 50. Returns service_type_id, service_type_name, click_number. SECURITY DEFINER.';

GRANT ALL ON FUNCTION public.search_jobs_ledger(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- 2) search_bids_for_clock — Clock In / Dispatch bid picker. Escaped patterns; the
--    ORDER BY (project_name) is unchanged.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_bids_for_clock(p_search_text text DEFAULT ''::text, p_service_type_id uuid DEFAULT NULL::uuid, p_service_type_ids uuid[] DEFAULT NULL::uuid[])
RETURNS TABLE(id uuid, service_type_id uuid, bid_number text, project_name text, address text, customer_name text, service_type_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH q AS (
    SELECT
      coalesce(p_search_text, '') AS raw,
      public.escape_like_pattern(coalesce(p_search_text, '')) AS esc,
      -- Legacy "B352" -> "352": the remainder after the B, escaped.
      CASE
        WHEN length(coalesce(p_search_text, '')) >= 2 AND lower(left(p_search_text, 1)) = 'b'
        THEN public.escape_like_pattern(substring(p_search_text from 2))
      END AS b_rest
  )
  SELECT
    b.id,
    b.service_type_id,
    coalesce(b.bid_number, '')::text,
    coalesce(b.project_name, '')::text,
    coalesce(b.address, '')::text,
    coalesce(c.name, bgb.name, '')::text,
    coalesce(st.name, '')::text
  FROM public.bids b
  LEFT JOIN public.customers c ON c.id = b.customer_id
  LEFT JOIN public.bids_gc_builders bgb ON bgb.id = b.gc_builder_id
  LEFT JOIN public.service_types st ON st.id = b.service_type_id
  CROSS JOIN q
  WHERE (
    (p_service_type_ids IS NOT NULL AND coalesce(array_length(p_service_type_ids, 1), 0) > 0 AND b.service_type_id = ANY(p_service_type_ids))
    OR ((p_service_type_ids IS NULL OR coalesce(array_length(p_service_type_ids, 1), 0) = 0) AND (p_service_type_id IS NULL OR b.service_type_id = p_service_type_id))
  )
  AND (
    q.raw = ''
    OR b.bid_number ILIKE '%' || q.esc || '%'
    OR (q.b_rest IS NOT NULL AND b.bid_number ILIKE '%' || q.b_rest || '%')
    OR b.project_name ILIKE '%' || q.esc || '%'
    OR b.address ILIKE '%' || q.esc || '%'
    OR c.name ILIKE '%' || q.esc || '%'
    OR bgb.name ILIKE '%' || q.esc || '%'
    OR EXISTS (
      SELECT 1
      FROM public.service_types stp
      WHERE stp.ledger_bid_prefix IS NOT NULL
        AND btrim(stp.ledger_bid_prefix) <> ''
        AND q.raw <> ''
        AND length(q.raw) > length(btrim(stp.ledger_bid_prefix))
        AND lower(left(q.raw, length(btrim(stp.ledger_bid_prefix)))) = lower(btrim(stp.ledger_bid_prefix))
        AND b.bid_number ILIKE '%' || public.escape_like_pattern(substring(q.raw from length(btrim(stp.ledger_bid_prefix)) + 1)) || '%'
    )
  )
  ORDER BY b.project_name
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.search_bids_for_clock(text, uuid, uuid[]) IS
  'Search bids for Clock In/Dispatch. B + ledger_bid_prefix stripping; %/_/\ in the typed text are escaped (escape_like_pattern); returns service_type_id and service_type_name. SECURITY DEFINER.';

GRANT ALL ON FUNCTION public.search_bids_for_clock(text, uuid, uuid[]) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- 3) search_estimates_for_nav — header search, estimates. Escaped patterns; SECURITY INVOKER
--    (RLS enforced) and the updated_at ordering are unchanged.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_estimates_for_nav(search_text text DEFAULT ''::text)
RETURNS TABLE(id uuid, estimate_number integer, title text, customer_name text, subtitle text)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  WITH q AS (
    SELECT
      btrim(coalesce(search_text, '')) AS raw,
      public.escape_like_pattern(btrim(coalesce(search_text, ''))) AS esc,
      -- Legacy "E120" -> "120": the remainder after the E, escaped.
      CASE
        WHEN length(btrim(coalesce(search_text, ''))) >= 2 AND lower(left(btrim(search_text), 1)) = 'e'
        THEN public.escape_like_pattern(substring(btrim(search_text) from 2))
      END AS e_rest
  )
  SELECT
    e.id,
    e.estimate_number,
    coalesce(e.title, '')::text,
    coalesce(c.name, '')::text,
    nullif(
      btrim(
        concat_ws(
          ' — ',
          nullif(btrim(coalesce(c.address, '')), ''),
          nullif(btrim(coalesce(e.for_address, '')), ''),
          nullif(btrim(coalesce(e.customer_email, '')), '')
        )
      ),
      ''
    )::text
  FROM public.estimates e
  LEFT JOIN public.customers c ON c.id = e.customer_id
  CROSS JOIN q
  WHERE length(q.raw) >= 1
  AND (
    e.estimate_number::text ILIKE '%' || q.esc || '%'
    OR (q.e_rest IS NOT NULL AND e.estimate_number::text ILIKE '%' || q.e_rest || '%')
    OR e.title ILIKE '%' || q.esc || '%'
    OR e.customer_email ILIKE '%' || q.esc || '%'
    OR e.for_address ILIKE '%' || q.esc || '%'
    OR c.name ILIKE '%' || q.esc || '%'
    OR c.address ILIKE '%' || q.esc || '%'
  )
  ORDER BY e.updated_at DESC NULLS LAST
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.search_estimates_for_nav(text) IS
  'Search estimates by quote #, title, customer, address, email. E prefix matches estimate_number; %/_/\ in the typed text are escaped (escape_like_pattern). RLS enforced (SECURITY INVOKER).';

GRANT ALL ON FUNCTION public.search_estimates_for_nav(text) TO anon, authenticated, service_role;
