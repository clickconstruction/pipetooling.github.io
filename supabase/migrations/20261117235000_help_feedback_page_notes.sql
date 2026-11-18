SET lock_timeout = '3s';

-- Tell the dev (punch list #380, PR 1): help_feedback takes a note from any page, not only from a
-- Help guide. The table, its row security, its push and its inbox stay; four columns are added and
-- three checks are restated. No new table, so no fence call: the fences already on this table stand.
--
-- kind       'guide' (the box under a Help guide, every row written before today), or one of the
--            three starts of the wrench's box: 'want', 'confusing', 'broken'.
-- page_key   the page as the activity heartbeat names it ('jobs:stages'), for grouping.
-- page_path  the address the note was written on, so the dev can open that page.
-- context    what the box listed before the press: the open window, the role, the screen, the
--            version, the last error line shown, the calls the server refused. Never a picture.
--
-- The table holds no rows today, so every statement here is instant.

ALTER TABLE public.help_feedback
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'guide',
  ADD COLUMN IF NOT EXISTS page_key text,
  ADD COLUMN IF NOT EXISTS page_path text,
  ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}'::jsonb;

-- A page note has no guide.
ALTER TABLE public.help_feedback ALTER COLUMN guide_slug DROP NOT NULL;

-- The words: a guide note and an "I want" note need some. "This page is confusing" and "Something
-- went wrong" may be sent with none, because the page and its state already say where and what.
ALTER TABLE public.help_feedback DROP CONSTRAINT IF EXISTS help_feedback_body_check;
ALTER TABLE public.help_feedback DROP CONSTRAINT IF EXISTS help_feedback_body_len;
ALTER TABLE public.help_feedback
  ADD CONSTRAINT help_feedback_body_len CHECK (char_length(body) <= 2000);
ALTER TABLE public.help_feedback DROP CONSTRAINT IF EXISTS help_feedback_body_words;
ALTER TABLE public.help_feedback
  ADD CONSTRAINT help_feedback_body_words
  CHECK (kind IN ('confusing', 'broken') OR char_length(btrim(body)) >= 1);

ALTER TABLE public.help_feedback DROP CONSTRAINT IF EXISTS help_feedback_kind_check;
ALTER TABLE public.help_feedback
  ADD CONSTRAINT help_feedback_kind_check CHECK (kind IN ('guide', 'want', 'confusing', 'broken'));

-- A guide note names its guide; a page note names its page.
ALTER TABLE public.help_feedback DROP CONSTRAINT IF EXISTS help_feedback_where_check;
ALTER TABLE public.help_feedback
  ADD CONSTRAINT help_feedback_where_check
  CHECK (CASE WHEN kind = 'guide' THEN guide_slug IS NOT NULL ELSE page_key IS NOT NULL END);

ALTER TABLE public.help_feedback DROP CONSTRAINT IF EXISTS help_feedback_page_size;
ALTER TABLE public.help_feedback
  ADD CONSTRAINT help_feedback_page_size
  CHECK (
    (page_key IS NULL OR char_length(page_key) BETWEEN 1 AND 80)
    AND (page_path IS NULL OR char_length(page_path) BETWEEN 1 AND 600)
    AND octet_length(context::text) <= 12000
  );

COMMENT ON TABLE public.help_feedback IS
  'Notes to the dev: feedback under a /help guide (kind guide) and, since punch list #380, a note from any page (want, confusing, broken) with the page and its state. Any authenticated user may create (own rows); the owner or a dev reads the inbox and answers. Rows are closed, never deleted.';
COMMENT ON COLUMN public.help_feedback.guide_slug IS
  'Stable slug of the /help guide the feedback is about; deep link /help?g=<slug>. Null for a page note.';
COMMENT ON COLUMN public.help_feedback.kind IS
  'guide, or the start the sender picked in the wrench''s box: want, confusing, broken.';
COMMENT ON COLUMN public.help_feedback.page_key IS
  'The page a page note was written on, as the activity heartbeat names it (jobs:stages).';
COMMENT ON COLUMN public.help_feedback.page_path IS
  'The in-app address a page note was written on, path and query, so the dev can open that page.';
COMMENT ON COLUMN public.help_feedback.context IS
  'What the box listed before the press: open window, role, screen, version, last error line, refused calls. Never a picture of the screen.';
COMMENT ON COLUMN public.help_feedback.closed_note IS
  'The answer the owner or a dev typed when closing; the sender reads it under Your notes.';
