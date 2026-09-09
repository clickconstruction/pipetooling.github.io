SET lock_timeout = '3s';

-- v2.3210 — tap-answerable robot questions. A robot filing an estimator-lane
-- question through twin-mcp ask_question must now offer 2–4 short choices
-- (and may name its recommended pick); the Standing rulings card renders them
-- as buttons so one tap answers. Rows without choices keep the free-text box.
-- Additive and idempotent; only the edge function (service role) writes the
-- two columns, so no policy change — the twin UPDATE/DELETE bans stand.

ALTER TABLE public.twin_questions ADD COLUMN IF NOT EXISTS choices jsonb;
ALTER TABLE public.twin_questions ADD COLUMN IF NOT EXISTS recommended text;

ALTER TABLE public.twin_questions DROP CONSTRAINT IF EXISTS twin_questions_choices_is_array;
ALTER TABLE public.twin_questions
  ADD CONSTRAINT twin_questions_choices_is_array
  CHECK (choices IS NULL OR jsonb_typeof(choices) = 'array');

COMMENT ON COLUMN public.twin_questions.choices IS
  'v2.3210: 2–4 short answer labels the robot offered (jsonb array of strings); the Standing rulings card renders them as one-tap buttons. NULL = free text only.';
COMMENT ON COLUMN public.twin_questions.recommended IS
  'v2.3210: the robot''s own pick, one of choices (case-insensitive match); shown first and filled.';
