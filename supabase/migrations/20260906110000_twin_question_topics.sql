SET lock_timeout = '3s';

-- v2.2939 — twin_questions.topic (LEARNING_PLAN.md lever 1: the standing-rulings key).
--
-- Robots keep asking variants of the same doctrine question on different bids
-- (travel bands, small-TI absorption, package boundaries) and each variant costs
-- the estimator a separate read. `topic` is a kebab slug naming the doctrine
-- issue ('travel-bands'); ask_question stamps it, and the standing-rulings
-- surface groups open questions by it so one answer settles the whole pile.
-- NULLABLE, NO DEFAULT: a bid-specific question legitimately has no topic, and
-- old rows stay ungrouped until someone (or the digest) backfills them.
--
-- Additive + idempotent; the old client and the old edge function ignore it.

ALTER TABLE public.twin_questions ADD COLUMN IF NOT EXISTS topic text;

COMMENT ON COLUMN public.twin_questions.topic IS
  'Standing-rulings key: one kebab slug per doctrine issue (travel-bands, small-ti-absorption) so duplicate robot asks collapse into one ruling. NULL = bid-specific, ungrouped.';

CREATE INDEX IF NOT EXISTS twin_questions_topic_idx
  ON public.twin_questions (topic)
  WHERE topic IS NOT NULL;
