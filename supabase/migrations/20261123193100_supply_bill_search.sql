SET lock_timeout = '3s';

-- One search across every supply house bill (punch list #431, PR 5).
--
-- The office finds a bill by what is on it: its number, its house, its PO, its amount, or a part printed on its paper
-- (the lines punch list #298 reads into supply_paper_lines: the description, the house's code, the maker's number).
-- Every word must be met, by the bill's own facts or by a line. A day, a month or a year narrows by the invoice date.
--
-- SECURITY INVOKER on purpose: the caller's own policies on supply_house_invoices, supply_papers, supply_paper_lines
-- and jobs_ledger decide what comes back, so nobody finds here a bill the app would not show them. No table changes
-- and no index: a few hundred bills and a few thousand lines are read whole in milliseconds.

CREATE OR REPLACE FUNCTION public.search_supply_bills(
  p_words text[] DEFAULT '{}'::text[],
  p_year integer DEFAULT NULL,
  p_month integer DEFAULT NULL,
  p_day integer DEFAULT NULL,
  p_limit integer DEFAULT 60
)
RETURNS TABLE (
  invoice_id uuid,
  invoice_number text,
  invoice_date date,
  amount numeric,
  supply_house_id uuid,
  supply_house_name text,
  purchase_order_number text,
  is_paid boolean,
  has_pdf boolean,
  jobs jsonb,
  on_paper text,
  on_paper_code text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  WITH words AS (
    -- Each word folded: as typed for a LIKE with its own % and _ made plain, with its marks dropped for a number or a
    -- code typed without them, and as digits alone when it is an amount typed with a $ or commas.
    SELECT
      t.ord,
      '%' || replace(replace(replace(t.w, '\', '\\'), '%', '\%'), '_', '\_') || '%' AS pat,
      regexp_replace(t.w, '[^a-z0-9]', '', 'g') AS bare,
      CASE WHEN replace(replace(t.w, '$', ''), ',', '') ~ '^[0-9]+(\.[0-9]*)?$' THEN replace(replace(t.w, '$', ''), ',', '') END AS money
    FROM (
      SELECT lower(btrim(u.w)) AS w, u.ord
      FROM unnest(coalesce(p_words, '{}'::text[])) WITH ORDINALITY AS u(w, ord)
      WHERE btrim(u.w) <> ''
      ORDER BY u.ord
      LIMIT 8
    ) t
  ),
  bills AS (
    SELECT i.id, i.invoice_number, i.invoice_date, i.amount, i.supply_house_id, i.purchase_order_number, i.is_paid, i.link, i.bill_read,
           coalesce(sh.name, '') AS house
    FROM public.supply_house_invoices i
    JOIN public.supply_houses sh ON sh.id = i.supply_house_id
    WHERE (p_year IS NULL OR extract(year FROM i.invoice_date) = p_year)
      AND (p_month IS NULL OR extract(month FROM i.invoice_date) = p_month)
      AND (p_day IS NULL OR extract(day FROM i.invoice_date) = p_day)
  ),
  judged AS (
    SELECT
      b.id,
      -- No word at all is every bill the date left.
      coalesce(bool_and(m.by_fact OR m.line_desc IS NOT NULL), true) AS met,
      (array_agg(m.line_desc ORDER BY m.ord) FILTER (WHERE NOT m.by_fact AND m.line_desc IS NOT NULL))[1] AS on_paper,
      (array_agg(m.line_code ORDER BY m.ord) FILTER (WHERE NOT m.by_fact AND m.line_desc IS NOT NULL))[1] AS on_paper_code
    FROM bills b
    LEFT JOIN LATERAL (
      SELECT
        w.ord,
        (
          lower(b.house) LIKE w.pat ESCAPE '\'
          OR lower(b.invoice_number) LIKE w.pat ESCAPE '\'
          OR (length(w.bare) >= 2 AND regexp_replace(lower(b.invoice_number), '[^a-z0-9]', '', 'g') LIKE '%' || w.bare || '%')
          OR lower(coalesce(b.purchase_order_number, '')) LIKE w.pat ESCAPE '\'
          OR (w.money IS NOT NULL AND to_char(abs(b.amount), 'FM999999999990.00') LIKE '%' || w.money || '%')
        ) AS by_fact,
        ln.description AS line_desc,
        ln.house_code AS line_code
      FROM words w
      LEFT JOIN LATERAL (
        SELECT
          -- A line with no description is named by its code, so a hit always has words to show.
          coalesce(nullif(btrim(l.description), ''), nullif(btrim(l.house_code), ''), l.mfr_number) AS description,
          l.house_code
        FROM public.supply_papers p
        JOIN public.supply_paper_lines l ON l.paper_id = p.id
        WHERE p.invoice_id = b.id
          AND (
            lower(l.description) LIKE w.pat ESCAPE '\'
            OR lower(l.house_code) LIKE w.pat ESCAPE '\'
            OR lower(l.mfr_number) LIKE w.pat ESCAPE '\'
            OR (length(w.bare) >= 2 AND l.house_code <> '' AND regexp_replace(lower(l.house_code), '[^a-z0-9]', '', 'g') LIKE '%' || w.bare || '%')
            OR (length(w.bare) >= 2 AND l.mfr_number <> '' AND regexp_replace(lower(l.mfr_number), '[^a-z0-9]', '', 'g') LIKE '%' || w.bare || '%')
          )
        ORDER BY l.line_no
        LIMIT 1
      ) ln ON true
    ) m ON true
    GROUP BY b.id
  )
  SELECT
    b.id,
    b.invoice_number::text,
    b.invoice_date::date,
    b.amount::numeric,
    b.supply_house_id,
    b.house::text,
    b.purchase_order_number::text,
    coalesce(b.is_paid, false),
    (nullif(btrim(coalesce(b.link, '')), '') IS NOT NULL OR nullif(b.bill_read #>> '{file,path}', '') IS NOT NULL),
    coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', jl.id, 'hcp_number', jl.hcp_number, 'click_number', jl.click_number, 'job_name', jl.job_name, 'pct', a.pct) ORDER BY a.pct DESC, jl.job_name)
      FROM public.supply_house_invoice_job_allocations a
      JOIN public.jobs_ledger jl ON jl.id = a.job_id
      WHERE a.invoice_id = b.id
    ), '[]'::jsonb),
    j.on_paper::text,
    j.on_paper_code::text
  FROM bills b
  JOIN judged j ON j.id = b.id
  WHERE j.met
  ORDER BY b.invoice_date DESC NULLS LAST, b.invoice_number
  LIMIT least(greatest(coalesce(p_limit, 60), 1), 200)
$function$;

COMMENT ON FUNCTION public.search_supply_bills(text[], integer, integer, integer, integer) IS
  'One search across every supply house bill (punch list #431): each word must be met by the bill''s number, house, PO or amount, or by a line read from its paper (description, the house''s code, the maker''s number); p_year, p_month and p_day narrow by the invoice date. on_paper is the first line that met a word the bill''s own facts did not. SECURITY INVOKER: the caller''s own policies decide what comes back.';

REVOKE ALL ON FUNCTION public.search_supply_bills(text[], integer, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_supply_bills(text[], integer, integer, integer, integer) TO authenticated, service_role;
