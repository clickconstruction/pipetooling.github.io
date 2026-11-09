-- v2.6784 — Research: the hint beside who pulled a permit (punch list #292, PR 2).
-- One read: for each normalized name the ledger asks about, how many bids we have priced to a
-- customer or builder of that name, how many we won, when the last one was, and whether an open
-- GC lead of that name already sits on the deck. The ledger draws it as one word (warm, cold,
-- new name) with its reason; it is a hint, never the verdict. No table, so no fences.
SET lock_timeout = '3s';

-- A name as the ledger keys it: lower-case letters and digits only, the company suffixes dropped.
CREATE OR REPLACE FUNCTION public.research_name_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(lower(COALESCE(p_name, '')), '\m(llc|l\.l\.c\.|inc|inc\.|co|co\.|corp|corp\.|ltd|ltd\.|llp|pllc|company|incorporated)\M', '', 'g'),
      '[^a-z0-9]+', '', 'g'),
    '');
$$;
COMMENT ON FUNCTION public.research_name_key(text) IS
  'Research (punch list #292): a company name as the permit ledger keys it — lower-case letters and digits, the LLC/Inc/Co suffixes dropped.';
GRANT EXECUTE ON FUNCTION public.research_name_key(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.research_contact_history(p_keys text[])
RETURNS TABLE (
  key text,
  bids integer,
  won integer,
  last_bid_on date,
  on_deck boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH keys AS (
    SELECT DISTINCT k AS key FROM unnest(COALESCE(p_keys, ARRAY[]::text[])) AS k WHERE k IS NOT NULL AND k <> ''
  ),
  named_bids AS (
    SELECT b.id, b.outcome, b.created_at::date AS bid_on,
           public.research_name_key(c.name) AS customer_key,
           public.research_name_key(g.name) AS builder_key
    FROM public.bids b
    LEFT JOIN public.customers c ON c.id = b.customer_id
    LEFT JOIN public.bids_gc_builders g ON g.id = b.gc_builder_id
  ),
  hits AS (
    SELECT k.key, nb.id, nb.outcome, nb.bid_on
    FROM keys k
    JOIN named_bids nb ON nb.customer_key = k.key OR nb.builder_key = k.key
  ),
  deck AS (
    SELECT k.key, true AS on_deck
    FROM keys k
    WHERE EXISTS (
      SELECT 1 FROM public.prospects p
      WHERE p.kind = 'gc_lead' AND p.prospect_fit_status IS NULL
        AND public.research_name_key(p.company_name) = k.key
    )
  )
  SELECT k.key,
         COUNT(DISTINCT h.id)::integer AS bids,
         COUNT(DISTINCT h.id) FILTER (WHERE h.outcome IN ('won', 'started_or_complete'))::integer AS won,
         MAX(h.bid_on) AS last_bid_on,
         COALESCE(d.on_deck, false) AS on_deck
  FROM keys k
  LEFT JOIN hits h ON h.key = k.key
  LEFT JOIN deck d ON d.key = k.key
  GROUP BY k.key, d.on_deck;
$$;
COMMENT ON FUNCTION public.research_contact_history(text[]) IS
  'Research (punch list #292): per normalized name, our bids to a customer or builder of that name, the wins, the last bid day, and whether an open GC lead of that name is on the deck. A hint beside who pulled a permit.';
GRANT EXECUTE ON FUNCTION public.research_contact_history(text[]) TO authenticated;
