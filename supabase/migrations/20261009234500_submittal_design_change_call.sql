SET lock_timeout = '3s';

-- Submittals, decision 11 (the owner's call of 2026-10-09): a design-change row says whose call it is
-- and records the sign-off — who signed off, on what day, and how it came. The office enters them on
-- the row; the review room prints them under the row's why. Additive: four nullable columns on an
-- existing table, so no read-only or digital-twin fences to re-apply.

ALTER TABLE public.bid_submittal_items
  ADD COLUMN IF NOT EXISTS call_by text NULL,
  ADD COLUMN IF NOT EXISTS signoff_name text NULL,
  ADD COLUMN IF NOT EXISTS signoff_on date NULL,
  ADD COLUMN IF NOT EXISTS signoff_via text NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_submittal_items_call_by_check') THEN
    ALTER TABLE public.bid_submittal_items
      ADD CONSTRAINT bid_submittal_items_call_by_check CHECK (call_by IS NULL OR call_by IN ('architect', 'engineer', 'gc', 'owner'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_submittal_items_signoff_name_check') THEN
    ALTER TABLE public.bid_submittal_items
      ADD CONSTRAINT bid_submittal_items_signoff_name_check CHECK (signoff_name IS NULL OR length(btrim(signoff_name)) BETWEEN 1 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_submittal_items_signoff_via_check') THEN
    ALTER TABLE public.bid_submittal_items
      ADD CONSTRAINT bid_submittal_items_signoff_via_check CHECK (signoff_via IS NULL OR signoff_via IN ('email', 'letter', 'stamped_drawing', 'meeting', 'phone'));
  END IF;
END $$;

COMMENT ON COLUMN public.bid_submittal_items.call_by IS
  'Submittals decision 11 (2026-10-09): on a design change, whose call it is — architect · engineer · gc · owner. NULL = not said.';
COMMENT ON COLUMN public.bid_submittal_items.signoff_name IS
  'Submittals decision 11: who signed off on the design change, as the office recorded it (a name, often the engineer).';
COMMENT ON COLUMN public.bid_submittal_items.signoff_on IS
  'Submittals decision 11: the day the sign-off came.';
COMMENT ON COLUMN public.bid_submittal_items.signoff_via IS
  'Submittals decision 11: how the sign-off came — email · letter · stamped_drawing · meeting · phone.';
