SET lock_timeout = '3s';

-- Punch list ticks (v2.8196): the "I am working on this" checkbox beside each card on the app's
-- /punch-list board, Taunya's ask of 2026-11-21. A tick is one person's own mark: one row per
-- person and card, read and written by that person alone. Nobody else sees it, a dev included.
--
-- A card is named by its number (the `number:` of the to-do's front matter, given once and never
-- reused), not its slug, so a renamed file keeps its tick.
--
-- `section` is the group the card was in when the person ticked it (ready, close, gated, waiting
-- or residual, as the to-do's `group:` has it). The page shows a tick only while the card is
-- still in that section, so a card that moves from one section to another loses its tick with
-- nobody having to notice the move. `board_version` is the newest shipped version the ticking
-- page's build carried: a page deletes a stale row only when its own build is newer than that,
-- so an old copy of the page left open on a phone cannot delete a tick made on a newer one.
--
-- An untick deletes the row. A table of its own, apart from `punch_list_picks`, which is shared
-- by everyone who opens the page.
CREATE TABLE IF NOT EXISTS public.punch_list_ticks (
  -- Whose tick. Gone with the account.
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE CASCADE,
  -- The card's number, `#16` on the page.
  card_number integer NOT NULL CHECK (card_number > 0),
  -- The card's group when it was ticked.
  section text NOT NULL CHECK (length(btrim(section)) > 0),
  -- The newest shipped version in the build of the page that made the tick ('' when it had none).
  board_version text NOT NULL DEFAULT '',
  ticked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_number)
);

COMMENT ON TABLE public.punch_list_ticks IS
  'Punch list (/punch-list): one person''s "I am working on this" tick on one card, by the card''s number, with the section (group) the card was in when ticked and the build''s newest version. Each person reads and writes only their own rows, and only while they can open the page (dev + master). An untick deletes the row; the page drops a tick whose card has changed section or left the list.';

ALTER TABLE public.punch_list_ticks ENABLE ROW LEVEL SECURITY;

-- A person's own rows and no others, and only for the pair that can open the page
-- (canOpenPunchList: dev + master). Each rule sits in a scalar subquery so it is read once per
-- statement, as 20261111013000 set the others.
DROP POLICY IF EXISTS punch_list_ticks_select ON public.punch_list_ticks;
CREATE POLICY punch_list_ticks_select ON public.punch_list_ticks
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.is_master_or_dev()));
DROP POLICY IF EXISTS punch_list_ticks_insert ON public.punch_list_ticks;
CREATE POLICY punch_list_ticks_insert ON public.punch_list_ticks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.is_master_or_dev()));
DROP POLICY IF EXISTS punch_list_ticks_update ON public.punch_list_ticks;
CREATE POLICY punch_list_ticks_update ON public.punch_list_ticks
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.is_master_or_dev()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND (SELECT public.is_master_or_dev()));
DROP POLICY IF EXISTS punch_list_ticks_delete ON public.punch_list_ticks;
CREATE POLICY punch_list_ticks_delete ON public.punch_list_ticks
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND (SELECT public.is_master_or_dev()));

REVOKE ALL ON TABLE public.punch_list_ticks FROM anon;
REVOKE ALL ON TABLE public.punch_list_ticks FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.punch_list_ticks TO authenticated;
GRANT ALL ON TABLE public.punch_list_ticks TO service_role;

-- A tick made again on a card (after a move hid the old one) reads as made now, whatever the
-- client sends. The function writes only the row in hand, so it runs as the caller.
CREATE OR REPLACE FUNCTION public.punch_list_ticks_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.ticked_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS punch_list_ticks_stamp ON public.punch_list_ticks;
CREATE TRIGGER punch_list_ticks_stamp
  BEFORE INSERT OR UPDATE ON public.punch_list_ticks
  FOR EACH ROW EXECUTE FUNCTION public.punch_list_ticks_stamp();

-- House rules: training mode writes nothing, a twin writes nothing here, an archived caller reads nothing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
