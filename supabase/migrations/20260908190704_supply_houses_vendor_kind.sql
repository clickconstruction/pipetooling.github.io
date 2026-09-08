SET lock_timeout = '3s';

-- Supply house directory, PR 5 (to-dos/supply-house-directory): what kind of
-- vendor a supply_houses row is. The roster doubles as the vendor ledger —
-- insurers, a rental yard, the sub-invoice bucket, a fuel account, Amazon and
-- the robot's price source sit beside the real counters — and the only signal
-- was the negative flag is_insurer, which nothing in prod had ever set (22
-- rows, 0 flagged on 2026-09-08). One column, five values, seeded by hand
-- from the classification the owner approved in the to-do's mock-up.
--
-- is_insurer stays for one more release as a derived column (trigger below)
-- so a stale client's quote pickers keep hiding the same rows; a later PR
-- drops it. Push after the v2.3172 client deploys (the client writes
-- vendor_kind and falls back to writing without it until the column exists).

ALTER TABLE public.supply_houses
  ADD COLUMN IF NOT EXISTS vendor_kind text NOT NULL DEFAULT 'supply_house';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supply_houses_vendor_kind_check'
  ) THEN
    ALTER TABLE public.supply_houses
      ADD CONSTRAINT supply_houses_vendor_kind_check
      CHECK (vendor_kind IN ('supply_house', 'insurer', 'rental_yard', 'sub_ledger', 'other'));
  END IF;
END $$;

COMMENT ON COLUMN public.supply_houses.vendor_kind IS
  'supply_house = a counter we quote from and list for estimators; insurer / rental_yard / sub_ledger / other = ledger-only vendors (hidden from the RFQ and quote pickers and from the estimator directory). v2.3172.';

-- Seed. Anything the office had already flagged is an insurer; the named rows
-- are the to-do''s hand classification; everything else is a supply house.
UPDATE public.supply_houses SET vendor_kind = 'insurer'
WHERE is_insurer AND vendor_kind = 'supply_house';

UPDATE public.supply_houses SET vendor_kind = 'insurer'
WHERE vendor_kind = 'supply_house' AND btrim(name) IN ('Texas Mutual (Workers Comp)');

UPDATE public.supply_houses SET vendor_kind = 'rental_yard'
WHERE vendor_kind = 'supply_house' AND btrim(name) IN ('Sunbelt Rentals');

UPDATE public.supply_houses SET vendor_kind = 'sub_ledger'
WHERE vendor_kind = 'supply_house' AND btrim(name) IN ('Outside Subcontractors');

UPDATE public.supply_houses SET vendor_kind = 'other'
WHERE vendor_kind = 'supply_house' AND btrim(name) IN ('Alexander Oil Company', 'Amazon', '🤖 Web Research');

-- is_insurer is derived from vendor_kind from here on.
CREATE OR REPLACE FUNCTION public.supply_houses_derive_is_insurer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_insurer := (NEW.vendor_kind <> 'supply_house');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS supply_houses_derive_is_insurer ON public.supply_houses;
CREATE TRIGGER supply_houses_derive_is_insurer
  BEFORE INSERT OR UPDATE ON public.supply_houses
  FOR EACH ROW EXECUTE FUNCTION public.supply_houses_derive_is_insurer();

UPDATE public.supply_houses SET is_insurer = (vendor_kind <> 'supply_house')
WHERE is_insurer IS DISTINCT FROM (vendor_kind <> 'supply_house');

CREATE INDEX IF NOT EXISTS supply_houses_vendor_kind_idx ON public.supply_houses (vendor_kind);
