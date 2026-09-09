SET lock_timeout = '3s';

-- v2.3186 — twin_questions.audience: which human a robot's question is for.
--
-- ask_question was the robot's only outlet when it got stuck, so every
-- infrastructure failure ("the sandbox blocked the substrate insert", "the write
-- fence denied cost_estimate_labor_rows") landed on the estimator's Standing
-- rulings panel next to real doctrine questions. Wendi: "this robot is talking
-- to you not me." Two lanes from here:
--   estimator — a judgment about the job (Bids → Audits → Standing rulings)
--   operator  — the machine is in the robot's way (Settings → Digital twins)
-- The robot names the lane on ask_question; twin-mcp classifies from the text
-- when it doesn't; a human can bounce a row across with one click.
--
-- Additive + idempotent. NOT NULL DEFAULT 'estimator' is metadata-only on PG17
-- (no rewrite). The old client reads select('*') and treats a missing key as
-- "classify from the text", so it never needs this column to exist.

ALTER TABLE public.twin_questions
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'estimator';

DO $$
BEGIN
  ALTER TABLE public.twin_questions
    ADD CONSTRAINT twin_questions_audience_check CHECK (audience IN ('estimator', 'operator'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

COMMENT ON COLUMN public.twin_questions.audience IS
  'Which human the question is for: estimator (a judgment about the job — Bids → Audits) or operator (the machine is in the robot''s way — Settings → Digital twins). Set by ask_question (robot''s choice, else classified from the text); a human can bounce it.';

CREATE INDEX IF NOT EXISTS twin_questions_open_audience_idx
  ON public.twin_questions (audience)
  WHERE status = 'open';

-- Backfill the OPEN rows with the same signals the shared kernel uses
-- (supabase/functions/_shared/twinQuestionAudience.ts) — the seven machine-side
-- questions sitting on Wendi's panel on 2026-09-08 move to the operator lane the
-- moment this lands. Answered/dismissed history is left as it was.
UPDATE public.twin_questions
SET audience = 'operator', updated_at = now()
WHERE status = 'open'
  AND audience = 'estimator'
  AND (
       question ~* '\m(sandbox(es|ed)?|sign-?in|(write[- ])?fence|service account|api ?key|substrate|harness|twin[- ]mcp|(run )?work(space| folder)|permission (layer|denied)|(db|database) (lane|insert|row)|403s?)\M'
    OR question ~  '\mRLS\M'
    OR question ~  '\mJSON\M'
    OR question ~* '\m(mcp|harness) verb\M|\badd a (harness|twin-mcp)? ?verb\M|\mverb for\M'
    OR question ~  '\m(get|put|open|lock|score|file|paste|submit|mint)_[a-z_]+\M'
    OR question ~  '\m[a-z]+(_[a-z0-9]+)+\M'
    OR question ~* '^\s*answer parked\M'
  );
