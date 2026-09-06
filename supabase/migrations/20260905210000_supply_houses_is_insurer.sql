SET lock_timeout = '3s';

-- Tier-2 #19 (journey-map J34-N2): the supply_houses roster doubles as the vendor ledger —
-- "Texas Mutual (Workers Comp)", "Sunbelt Rentals", "Outside Subcontractors", "Amazon" sit
-- beside the real counters — so the RFQ "pick the supply house…" list offered a quote link
-- to a workers-comp insurer. One flag, set from the supply-house edit form (Materials →
-- Supply Houses); the quote pickers (RFQ compose, Plug in quotes, Prepare fixture copy)
-- drop flagged rows. Nothing is seeded: the office tags the insurers in the UI.

ALTER TABLE public.supply_houses ADD COLUMN IF NOT EXISTS is_insurer boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.supply_houses.is_insurer IS
  'Not a supplier you quote from (insurer, rental yard, payee-only vendor). Stays in the ledger and on Materials; hidden from the quote / RFQ supply-house pickers.';
