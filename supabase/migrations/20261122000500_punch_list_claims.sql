SET lock_timeout = '3s';

-- Punch list claims (v2.8224): a tick becomes a claim other people can see. Taunya's ask of
-- 2026-11-21, a few hours after the tick itself went live: "add to the punch list when a user has
-- claimed a card that they are working on, And then they should release that claim after they've
-- not updated the card in 12 hours". A second person is about to work from the list, and nothing
-- on the page said which cards were taken.
--
-- Two changes to `punch_list_ticks` (20261121193000), which held no row when this was written:
--
-- 1. Everyone who may open the page (dev + master) reads every row, so the page can say who is
--    working on a card. Writing stays a person's own: only the person who ticked a card can
--    change or take off their tick.
-- 2. `claimer_name` holds the person's name as the page prints it, stamped by the trigger from
--    their own `users` row on every write. The page reads it from the row, not from `users`,
--    because a master cannot read a dev's `users` row and would see a claim with no name.
--
-- `ticked_at` is unchanged in the database and wider in meaning: the trigger sets it to now() on
-- every insert and update, so it is the last time the person said they were on the card, by the
-- tick or by the page's "Still on it" press (an update of their own row). The 12 quiet hours are
-- worked out by the page at read time, from this time and the card file's last change on main.
-- Nothing here expires a row and no job runs.
ALTER TABLE public.punch_list_ticks
  ADD COLUMN IF NOT EXISTS claimer_name text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.punch_list_ticks.claimer_name IS
  'The claimer''s name as the page prints it, stamped by punch_list_ticks_stamp from users.name on every write. Whatever the client sends is replaced.';
COMMENT ON COLUMN public.punch_list_ticks.ticked_at IS
  'The last time the person said they were on the card: the tick, or a Still on it press. Stamped by punch_list_ticks_stamp on every insert and update. The page counts a claim''s 12 quiet hours from the newer of this and the card file''s last change on main.';
COMMENT ON TABLE public.punch_list_ticks IS
  'Punch list (/punch-list): one person''s claim on one card ("I am working on this"), by the card''s number, with the section (group) the card was in when ticked, the build''s newest version, the claimer''s name and the last time they said so. Everyone who can open the page (dev + master) reads every row; a person writes only their own. An untick deletes the row; the page drops a claim whose card has changed section or left the list, and reads a claim as gone quiet after 12 hours.';

-- Everyone who may open the page reads every claim. The rule sits in a scalar subquery so it is
-- read once per statement.
DROP POLICY IF EXISTS punch_list_ticks_select ON public.punch_list_ticks;
CREATE POLICY punch_list_ticks_select ON public.punch_list_ticks
  FOR SELECT TO authenticated
  USING ((SELECT public.is_master_or_dev()));

-- The stamp: the time and the name are the server's, whatever the client sends. The function
-- reads the caller's own users row, which every signed-in person may read, so it runs as the
-- caller. A row written by the service key takes the name of the user it names.
CREATE OR REPLACE FUNCTION public.punch_list_ticks_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.ticked_at := now();
  NEW.claimer_name := coalesce((SELECT btrim(u.name) FROM public.users u WHERE u.id = NEW.user_id), '');
  RETURN NEW;
END;
$$;
