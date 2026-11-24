SET lock_timeout = '3s';

-- Punch list answers (v2.8519, punch list #438): a card can carry the question it waits on
-- (`ask:` in its front matter), and the board's pick is how a person answers it. Two additive
-- changes to `punch_list_picks` so the pick can hold that answer:
--
-- 1. `pick` may be 'change': on a card with a question the control reads Go ahead, Change,
--    Not now. Go ahead is the pick 'do' and Not now is 'later', which the table already holds.
--    Change had no value: until now it could only be a note with no pick.
-- 2. `answers_ask` keeps the question the pick answered, as the card wrote it. A card's question
--    changes when a session acts on the answer, and the old pick must not read as the answer to
--    the new question. The page compares the two; '' is a pick made on a card with no question.
--
-- Nobody writes either yet. A client that does not know 'change' reads it as no pick
-- (`picksFromRows`), and no client names the new column.
ALTER TABLE public.punch_list_picks
  ADD COLUMN IF NOT EXISTS answers_ask text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.punch_list_picks.answers_ask IS
  'The card''s question (its ask) as it read when this pick was made; '''' for a pick on a card with no question. The page treats a pick as the answer only while this equals the card''s question today.';

ALTER TABLE public.punch_list_picks DROP CONSTRAINT IF EXISTS punch_list_picks_pick_check;
ALTER TABLE public.punch_list_picks
  ADD CONSTRAINT punch_list_picks_pick_check CHECK (pick IN ('', 'do', 'later', 'drop', 'change'));

COMMENT ON TABLE public.punch_list_picks IS
  'Punch list (/punch-list) — the shared pick and note per to-do slug, with who last changed it: Do / Later / Drop on a card that is not built, and Go ahead (do) / Change / Not now (later) on a card that carries a question. dev + master read and write (the page''s door).';
