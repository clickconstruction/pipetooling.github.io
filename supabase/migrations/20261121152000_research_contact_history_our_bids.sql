SET lock_timeout = '3s';

-- Permits (v2.8181, punch list #405): the word beside who pulled a permit, warm · cold · new name, counts our bids by
-- the one rule Builders and Market's call list took in *_research_builders_our_bids. `research_contact_history` kept
-- its own count: every bid ever made under a name, the robots' practice bids among them. So a name could read
-- "Never bid" on Market and "cold" on the skim card. `named_bids` now reads only the bids `research_bid_counts`
-- passes (not a practice bid, made in the last 730 days by the company calendar), keys each name with
-- `research_bid_party_key` (never a ZZ name, never a bid platform's bucket) and takes a bid's day on the company
-- calendar. Nothing else in the body changed, and the shape is the same, so no client and no type changes with it.
-- The body this replaces is the one in *_permit_hint_both_decks.
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
    SELECT b.id, b.outcome, (b.created_at AT TIME ZONE 'America/Chicago')::date AS bid_on,
           public.research_bid_party_key(c.name) AS customer_key,
           public.research_bid_party_key(g.name) AS builder_key
    FROM public.bids b
    LEFT JOIN public.customers c ON c.id = b.customer_id
    LEFT JOIN public.bids_gc_builders g ON g.id = b.gc_builder_id
    WHERE public.research_bid_counts(b.project_name, b.created_at)
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
  'Research (punch list #292, #405): per normalized name, our bids to a customer or builder of that name by the one rule (research_bid_counts, research_bid_party_key: no practice bid, the last two years, no bid platform''s bucket), the wins, the last bid day on the company calendar, and whether an open lead of that name is on a calling deck (Customers or Jobs to GC). A hint beside who pulled a permit.';
GRANT EXECUTE ON FUNCTION public.research_contact_history(text[]) TO authenticated;
