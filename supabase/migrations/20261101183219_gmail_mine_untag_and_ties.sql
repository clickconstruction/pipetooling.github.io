SET lock_timeout = '3s';

-- Messages → My email (punch list #230, a fix after PR 4's follow and PR 6's window; the review's findings 4 to 10):
-- two columns on email_tag_threads, so gmail-mine's untag and its tags' ties stand on the row instead of on guesses.
--
--   * untagging_at: when an untag began taking the conversation off its job. The untag sets it before it deletes a
--     line, and the follow (gmail-mine's cron action) never picks a row that has it and asks again before each row it
--     reads, so a run that reaches the conversation mid-untag lands nothing back. The row still goes last, so an untag
--     that stops leaves it, marked, for the next untag to find and finish; tagging the conversation again clears it.
--   * tied_line_ids: the lines of the boxes (bids@ and the team box) that this conversation's tag or its follow tied to
--     the job, each recorded before its tie. A tag onto another job moves the person's own lines and exactly these, and
--     an untag unties exactly these, leaving every line someone tied by hand. Until now the two were told apart by
--     tied_by alone, which a hand tie by the same person carries too. Empty on a row tagged before this push.
--
-- No table is created, so no fence is owed. Idempotent: each column only when missing, both in one statement so the
-- table's lock is taken once; a constant default writes no row. No index: the follow reads untagging_at only on rows
-- it already picked by person and window, and tied_line_ids only by the row's id.
ALTER TABLE public.email_tag_threads
  ADD COLUMN IF NOT EXISTS untagging_at timestamptz,
  ADD COLUMN IF NOT EXISTS tied_line_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.email_tag_threads.untagging_at IS
  'Messages → My email (punch list #230, v2.6292): when an untag began taking the conversation off its job; null otherwise. gmail-mine sets it before it deletes a line, and its follow never reads a row that has it, so nothing lands back mid-untag. The row goes last, so an untag that stops leaves it marked for the next untag; tagging the conversation again clears it.';
COMMENT ON COLUMN public.email_tag_threads.tied_line_ids IS
  'Messages → My email (punch list #230, v2.6292): the lines of the boxes (messages.id) this conversation''s tag or its follow tied to the job, each recorded before its tie. A tag onto another job moves these with the person''s own lines; an untag unties these and no line tied by hand. Empty on a row tagged before v2.6292.';
