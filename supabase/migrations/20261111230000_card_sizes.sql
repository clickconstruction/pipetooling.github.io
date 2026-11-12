SET lock_timeout = '3s';

-- Cards and footers: the sizes of the business card the company offers, and a person's pick among them (punch
-- list #313, v2.6956; to-dos/cards-and-footers/README.md → A larger card). A size is another setting of the
-- card's back: a larger photo, or larger words (src/lib/brandKit/sizes.ts). The front and the email footer do
-- not change. A size is not a look: any size is drawn in any look.
--
--   * users.card_size: the size a person picked, by its name in the code ('standard', 'photo', 'text'). Null: the
--     company's default. 40 characters at most (users_card_size_short). It is not held to a list here: a pick the
--     owner has since switched off simply draws as the default (resolveSize), so switching a size off never
--     needs a write to anyone's row.
--   * Who may write it: the person on their own row and the office on anyone's, through the two policies that
--     already carry the card's other facts and the look (20261111200000, 20261111220000). The column is granted
--     by name, as those were. users_guard_privileged_columns does not name it.
--   * app_settings 'card_sizes_v1': one row, a JSON object in value_text: {"approved": [...], "default": "..."}.
--     It is a row of its own, apart from 'card_looks_v1', so saving the looks never rewrites the sizes. Any
--     signed-in person reads app_settings; only a dev writes it ("Devs can manage app settings"). With no row the
--     app offers the standard card alone.
--   * The row is seeded with the three sizes on and the standard card as the default: asked which sizes to
--     offer, the owner said all three on 2026-11-11. ON CONFLICT DO NOTHING, so a later push never overwrites
--     what he has switched since.
--
-- No table is made, so no fence call. The client reads the column and the setting fail-soft (cardIo.ts): before
-- this is pushed nobody is offered a size, and the cards draw as they did. So the client deploys first and this is
-- pushed after the merge.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS card_size text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_card_size_short' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_card_size_short CHECK (card_size IS NULL OR char_length(card_size) <= 40);
  END IF;
END $$;

GRANT UPDATE (card_size) ON public.users TO authenticated;

COMMENT ON COLUMN public.users.card_size IS
  'Cards and footers (punch list #313): the size of business card the person picked, by its name in the code. Null, or a size the owner no longer offers: the company''s default.';

INSERT INTO public.app_settings (key, value_text)
VALUES ('card_sizes_v1', '{"approved":["standard","photo","text"],"default":"standard"}')
ON CONFLICT (key) DO NOTHING;
