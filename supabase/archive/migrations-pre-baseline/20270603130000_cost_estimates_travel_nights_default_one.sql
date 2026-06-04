-- Default the Travel section to 1 traveler and 1 night. travel_people already
-- defaults to 1; bump travel_nights from 0 to 1. Existing rows are backfilled
-- 0 -> 1 (safe: travel_meals_rate / travel_hotel_rate are NULL on all current
-- rows, so travelCost = people x nights x (0 + 0) = 0 regardless, i.e. no cost
-- or margin impact -- this only changes the default shown in the UI).

ALTER TABLE public.cost_estimates
  ALTER COLUMN travel_nights SET DEFAULT 1;

UPDATE public.cost_estimates
SET travel_nights = 1
WHERE travel_nights = 0;
