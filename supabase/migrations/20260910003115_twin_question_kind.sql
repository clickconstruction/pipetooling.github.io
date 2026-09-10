SET lock_timeout = '3s';

-- v2.3212 — what kind of thing the robot is asking for. 'decision' is a
-- judgment the estimator rules on (Standing rulings); 'plans' means the robot
-- needs a different or additional plan set on ONE bid and is routed to that
-- bid's robot needs sheet instead. Written by the twin-mcp edge function
-- (service role) on ask_question — the robot names it, else the text decides;
-- NULL rows classify from their text on read. Additive and idempotent.

ALTER TABLE public.twin_questions ADD COLUMN IF NOT EXISTS kind text;

ALTER TABLE public.twin_questions DROP CONSTRAINT IF EXISTS twin_questions_kind_check;
ALTER TABLE public.twin_questions
  ADD CONSTRAINT twin_questions_kind_check
  CHECK (kind IS NULL OR kind IN ('decision', 'plans'));

COMMENT ON COLUMN public.twin_questions.kind IS
  'v2.3212: decision = a judgment for Standing rulings; plans = the robot needs a different/additional plan set on this bid (routed to the robot needs sheet). NULL = classify from the text.';
