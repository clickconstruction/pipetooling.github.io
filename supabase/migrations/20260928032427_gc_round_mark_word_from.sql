SET lock_timeout = '3s';

-- GC Review for one operator, step 2 (punch list #49): whose word it is.
--
-- Only the office works GC Review. When the account man knows where a GC
-- stands, the assistant phones him and types his answer in — and the mark had
-- one person on it, acted_by, which RLS pins to whoever is signed in. His read
-- was filed as hers on every pill, board and email.
--
-- The mark keeps its one row per (week, GC). Beside who wrote the row it now
-- holds the word's own facts: who it came from, how the person entering it
-- heard it, who entered it, and when. acted_by / acted_at / channel stay the
-- statement's. Nothing is forged: acted_by is still auth.uid() (the v2.2072
-- policies are untouched), and word_from_* is a statement about the source.
--
-- Rows written before this read as word_from NULL = the person who marked it.
--
-- Additive and idempotent; no new table, so the read-only policy re-apply
-- calls are not needed.

ALTER TABLE public.gc_statement_round_marks
  ADD COLUMN IF NOT EXISTS word_from_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS word_from_name text,
  ADD COLUMN IF NOT EXISTS word_heard_via text,
  ADD COLUMN IF NOT EXISTS word_entered_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS word_entered_by_name text,
  ADD COLUMN IF NOT EXISTS word_at timestamptz;

ALTER TABLE public.gc_statement_round_marks
  DROP CONSTRAINT IF EXISTS gc_statement_round_marks_word_heard_via_check;
ALTER TABLE public.gc_statement_round_marks
  ADD CONSTRAINT gc_statement_round_marks_word_heard_via_check
  CHECK (word_heard_via IS NULL OR word_heard_via IN ('call', 'text', 'in_person', 'email', 'other'));

COMMENT ON COLUMN public.gc_statement_round_marks.word_from_user_id IS
  'Whose read of the GC this is — usually the account man (v2.3954). NULL with word_from_name NULL = the person who marked it (rows from before the column).';
COMMENT ON COLUMN public.gc_statement_round_marks.word_from_name IS
  'The name of whoever the word came from, as shown. Kept beside the id so the record reads the same after a user is renamed or removed.';
COMMENT ON COLUMN public.gc_statement_round_marks.word_heard_via IS
  'How the person entering the word heard it from its source: call | text | in_person | email | other. NULL when the source entered it themselves.';
COMMENT ON COLUMN public.gc_statement_round_marks.word_entered_by IS
  'Who typed the word in. Differs from word_from_user_id when an assistant records what the account man told her.';
COMMENT ON COLUMN public.gc_statement_round_marks.word_entered_by_name IS
  'Name of whoever typed the word in, as shown.';
COMMENT ON COLUMN public.gc_statement_round_marks.word_at IS
  'When the word was recorded. acted_at stays the statement''s day when the row is a sent mark.';
COMMENT ON TABLE public.gc_statement_round_marks IS
  'GC Review week marks (v2.2072 → v2.3954): one row per (week, GC), upsertable, holding the statement and the word. sent = a statement went out (channel, acted_by, acted_at); skipped = deferred this week; contacted = the word with no statement. The word — temperature, note, expected_pay_by — carries its own source (word_from_*), how it was heard, who entered it and when. Only sent feeds the last-sent pills and the week''s sent count.';
