SET lock_timeout = '3s';

-- Cards and footers: the looks the company offers, and a person's pick among them (punch list #313, v2.6951;
-- to-dos/cards-and-footers/README.md → Other looks, and offering approved ones). A look is the business card and
-- the email footer in other colours over the same layouts (src/lib/brandKit/looks.ts). A developer draws one in
-- code. Nobody is offered it until the owner switches it on.
--
--   * users.card_look: the look a person picked, by its name in the code ('classic', 'navy-orange', 'navy-yellow').
--     Null: the company's default. 40 characters at most (users_card_look_short). It is not held to a list here:
--     a pick the owner has since switched off, or a look that was retired, simply draws as the default
--     (resolveLook), so switching a look off never needs a write to anyone's row.
--   * Who may write it: the person on their own row and the office on anyone's, through the two policies that
--     already carry a name, a phone and the card's other facts (20261111200000). The column is granted by name, as
--     those were. users_guard_privileged_columns does not name it.
--   * app_settings 'card_looks_v1': one row, a JSON object in value_text: {"approved": [...], "default": "..."}.
--     Any signed-in person reads app_settings; only a dev writes it ("Devs can manage app settings"), so the owner's
--     card needs no new policy. With no row the app offers the look in use alone.
--   * The row is seeded with the three looks on and the look in use as the default: the owner approved navy and
--     orange and navy and yellow as alternatives on 2026-11-11. ON CONFLICT DO NOTHING, so a later push never
--     overwrites what he has switched since.
--
-- No table is made, so no fence call. The client reads the column and the setting fail-soft (cardIo.ts): before
-- this is pushed nobody is offered a look, and the cards draw as they did. So the client deploys first and this is
-- pushed after the merge.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS card_look text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_card_look_short' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_card_look_short CHECK (card_look IS NULL OR char_length(card_look) <= 40);
  END IF;
END $$;

GRANT UPDATE (card_look) ON public.users TO authenticated;

COMMENT ON COLUMN public.users.card_look IS
  'Cards and footers (punch list #313): the look the person picked for their card and footer, by its name in the code. Null, or a look the owner no longer offers: the company''s default.';

INSERT INTO public.app_settings (key, value_text)
VALUES ('card_looks_v1', '{"approved":["classic","navy-orange","navy-yellow"],"default":"classic"}')
ON CONFLICT (key) DO NOTHING;
