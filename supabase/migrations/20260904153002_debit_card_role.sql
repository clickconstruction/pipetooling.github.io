SET lock_timeout = '3s';

-- Debit cards (v2.2750): a card is either a person's card or a company card
-- (management tools — GPS, charging, app subscriptions). Company cards never
-- count as anyone's fuel on People → Vehicles → Wheels and never appear on the
-- "no person on it" list. Lives beside the nickname so the Debit cards modal
-- edits both in one row.
ALTER TABLE public.mercury_debit_card_nicknames
  ADD COLUMN IF NOT EXISTS card_role text NOT NULL DEFAULT 'person';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mercury_debit_card_nicknames_card_role_check'
  ) THEN
    ALTER TABLE public.mercury_debit_card_nicknames
      ADD CONSTRAINT mercury_debit_card_nicknames_card_role_check
      CHECK (card_role IN ('person', 'company'));
  END IF;
END $$;

COMMENT ON COLUMN public.mercury_debit_card_nicknames.card_role IS
  'person (default) | company — company cards are management tools, never a person''s fuel. v2.2750';
