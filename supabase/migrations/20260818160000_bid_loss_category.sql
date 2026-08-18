SET lock_timeout = '3s';

-- Bids: structured loss category (Why we lost lens, 2026-08-18).
--
-- loss_reason stays the free-text detail ("what they said"); loss_category is
-- the structured bucket the Followup tab's "Why we lost" lens records and
-- rolls up. App-validated values (bidLossCategories.ts is the single source):
--   gc_lost      — our GC didn't win the project (not our competitive loss)
--   price        — we were too high
--   other_sub    — owner/GC went with another sub or the incumbent
--   project_died — project canceled, on hold, or re-scoped away
--   no_bid       — we never finished/submitted a real bid
--   no_answer    — asked, no reason given
--
-- Backfill below maps only the UNAMBIGUOUS existing free-text reasons; anything
-- fuzzy stays NULL and feeds the Friday triage queue on the new lens.

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS loss_category text;

COMMENT ON COLUMN public.bids.loss_category IS
  'Structured why-we-lost bucket (gc_lost | price | other_sub | project_died | no_bid | no_answer); loss_reason holds the free-text detail. Values validated app-side in src/lib/bidLossCategories.ts.';

UPDATE public.bids SET loss_category = 'gc_lost'
WHERE loss_category IS NULL AND outcome = 'lost' AND (
  loss_reason ILIKE '%gc lost%'
  OR loss_reason ILIKE '%gc did not get%'
  OR loss_reason ILIKE '%builder did not get%'
  OR loss_reason ILIKE '%contractor lost%'
  OR loss_reason ILIKE '%not awarded%'
  OR loss_reason ILIKE '%did not get the job%'
  OR loss_reason ILIKE '%did not get that one%'
  OR loss_reason ILIKE '%knight did not get%'
);

UPDATE public.bids SET loss_category = 'price'
WHERE loss_category IS NULL AND outcome = 'lost' AND (
  lower(trim(loss_reason)) = 'price'
  OR loss_reason ILIKE '%too high%'
  OR loss_reason ILIKE '%pricing was too high%'
  OR loss_reason ILIKE '%grand over%'
);

UPDATE public.bids SET loss_category = 'other_sub'
WHERE loss_category IS NULL AND outcome = 'lost' AND (
  loss_reason ILIKE '%original contractor%'
  OR loss_reason ILIKE '%went with%'
);

UPDATE public.bids SET loss_category = 'project_died'
WHERE loss_category IS NULL AND outcome = 'lost' AND (
  loss_reason ILIKE '%on hold%'
  OR loss_reason ILIKE '%re-engineering%'
  OR loss_reason ILIKE '%changed their mind%'
);

UPDATE public.bids SET loss_category = 'no_bid'
WHERE loss_category IS NULL AND outcome = 'lost' AND (
  loss_reason ILIKE '%did not finish bidding%'
  OR loss_reason ILIKE '%declined to bid%'
  OR loss_reason ILIKE '%longshot%'
);

UPDATE public.bids SET loss_category = 'no_answer'
WHERE loss_category IS NULL AND outcome = 'lost' AND (
  loss_reason ILIKE '%unsaid by owner%'
  OR loss_reason ILIKE '%didn''t say%'
  OR loss_reason ILIKE '%did not say%'
);
