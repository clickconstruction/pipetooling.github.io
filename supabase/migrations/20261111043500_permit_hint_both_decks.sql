-- v2.6917 — Permits: the hint beside a name sees a lead on either calling deck (punch list #302, call 4).
-- Since v2.6907 a pursued general contractor's lead lands on the Customers deck, and an owner's or
-- an architect's on Jobs to GC. `research_contact_history` said "on the deck" only for an open
-- `gc_lead`, so the next permit from a general contractor we are already calling read "new name".
-- It now counts an open lead of either kind. The deck's names are keyed once per call, not once
-- per name asked, since the Customers deck is the long one. Same signature and columns; no table,
-- so no fences.
SET lock_timeout = '3s';

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
  deck_names AS (
    SELECT DISTINCT public.research_name_key(p.company_name) AS key
    FROM public.prospects p
    WHERE p.kind IN ('gc_lead', 'customer') AND p.prospect_fit_status IS NULL
  ),
  deck AS (
    SELECT k.key, true AS on_deck
    FROM keys k
    JOIN deck_names n ON n.key = k.key
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
  'Research (punch list #292): per normalized name, our bids to a customer or builder of that name, the wins, the last bid day, and whether an open lead of that name is on a calling deck (Customers or Jobs to GC). A hint beside who pulled a permit.';
GRANT EXECUTE ON FUNCTION public.research_contact_history(text[]) TO authenticated;
