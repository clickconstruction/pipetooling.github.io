SET lock_timeout = '3s';

-- The header's global search finds a job by its development's name (2026-11-02, the owner: the Pipeline
-- search "doesn't seem to include the names of developments"; the Pipeline's own server search learned
-- it in v2.6354, this is the global search's half). search_jobs_ledger: 20261031020000's body with one
-- EXISTS over public.developments — the job's development_id names a development whose name holds the
-- typed text, escaped like every other column, archived developments included (their jobs still carry
-- the id). Same signature, same order, same LIMIT, same billing-only rule; grants restated as 20261009130000 set them.
CREATE OR REPLACE FUNCTION public.search_jobs_ledger(search_text text DEFAULT ''::text, include_billing_only boolean DEFAULT false)
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
    WHERE (include_billing_only OR NOT jl.billing_only)
    AND (
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
      -- The numbers a job answered to before a combine (prior_numbers, 2026-10-31): 'HCP 550', 'C# 543'.
      OR EXISTS (
        SELECT 1 FROM unnest(jl.prior_numbers) AS pn
        WHERE pn ILIKE '%' || q.esc || '%'
          OR (q.j_rest IS NOT NULL AND pn ILIKE '%' || q.j_rest || '%')
      )
      OR jl.job_name ILIKE '%' || q.esc || '%'
      OR jl.job_address ILIKE '%' || q.esc || '%'
      -- The development the job sits in (2026-11-02): its name, archived or not.
      OR (
        q.raw <> ''
        AND jl.development_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.developments d
          WHERE d.id = jl.development_id
            AND d.name ILIKE '%' || q.esc || '%'
        )
      )
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

COMMENT ON FUNCTION public.search_jobs_ledger(text, boolean) IS
  'Search jobs_ledger by HCP / Click number, a prior number, job name, address, or the name of the job''s development. J prefix and ledger_job_prefix normalized; %/_/\ in the typed text are escaped (escape_like_pattern); ordered by job number NUMERICALLY (first digit run, desc) under LIMIT 50. Leaves billing-only jobs out unless include_billing_only (the money and office searches). Returns service_type_id, service_type_name, click_number. SECURITY DEFINER.';

REVOKE EXECUTE ON FUNCTION public.search_jobs_ledger(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_jobs_ledger(text, boolean) TO authenticated, service_role;
