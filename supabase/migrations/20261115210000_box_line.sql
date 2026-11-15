SET lock_timeout = '3s';

-- Materials on site (punch list #351, PR 2, v2.7348): what is in a box, on a line of its own.
--
-- Nothing said what was in a box but its part lines, so people typed it into the name (G76 TOILETS). PR 1
-- (20261114100000, v2.7276) held the name to letters and a number and parked the words on the where line. This file
-- gives them their own column.
--
-- job_containers.description is a person's own words for what is in the box, at most 80 characters, and null until
-- someone says. The app writes the line a screen shows from the box's parts while it is null (boxLine.ts: one kind of
-- part reads its name and count, several read how many and the first two), and a person's words win from the moment
-- they are typed. Clearing them writes null again, which hands the line back to the app. So the column holds a
-- person's words alone, never the app's line, and an empty string is refused: nothing said is null.
--
-- This file makes no table, so no fence call is owed, and it changes no policy, trigger or function. The box's own
-- UPDATE policy (job_containers_update, on_site_can_touch_job) is the gate: whoever may rename a box may say what is
-- in it. on_site_carry_job moves a box by its job_id, so its words go with it.
--
-- Order with the client: the client's box reads name this column, so push right after the merge, before the Pages
-- deploy finishes. Until the push a read of a job's boxes is refused with the column's name. box-read and
-- _shared/boxPage.ts read it too and are redeployed after the push; the function deployed before answers as it did.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS carries its CHECK, so a second run adds nothing. The column is nullable with
-- no default, so no row is rewritten and the lock is a moment.

ALTER TABLE public.job_containers
  ADD COLUMN IF NOT EXISTS description text
  CONSTRAINT job_containers_description_check CHECK (description IS NULL OR (char_length(description) <= 80 AND btrim(description) <> ''));

COMMENT ON COLUMN public.job_containers.description IS
  'Materials on site (#351): what is in the box, in a person''s own words, at most 80 characters. Null until someone says: the screens then write the line from the box''s parts (boxLine.ts). Clearing the words writes null, which hands the line back to the app. Never an empty string.';
