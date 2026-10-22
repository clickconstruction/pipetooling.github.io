SET lock_timeout = '3s';

-- Robot rounds, PR 7 (punch list #142, decision 9): Ask the robot to look. A person's question
-- about a bid's plans, asked from the Plans panel when the plans' own answer was not enough; the
-- robot answers it within a round, after that bid's shadow is sealed (blind both ways), citing
-- sheets; the thread lives on the bid for the office; an answer that says the plans do not say
-- can become an RFI. The robot writes its answer through twin-mcp's service role (put_plan_answer),
-- never through the fence, because the human bid is not its to write. Nothing here is money.

BEGIN;

CREATE TABLE IF NOT EXISTS public.bid_plan_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (length(question) BETWEEN 3 AND 600),
  asked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  asked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'dismissed')),
  claimed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  answer text,
  sheet_refs text[] NOT NULL DEFAULT '{}',
  answered_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  answered_at timestamptz,
  seen_at timestamptz,
  rfi_id uuid REFERENCES public.bids_rfis(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bid_plan_questions_bid_idx ON public.bid_plan_questions (bid_id, asked_at DESC);
CREATE INDEX IF NOT EXISTS bid_plan_questions_open_idx ON public.bid_plan_questions (status, asked_at) WHERE status = 'open';

ALTER TABLE public.bid_plan_questions ENABLE ROW LEVEL SECURITY;

-- The bid roles read the thread; a bid role asks as themselves; estimator and up may dismiss a
-- question, mark it seen, or tie it to an RFI. The robot's answer lands through the service role.
DROP POLICY IF EXISTS "Bid roles read bid_plan_questions" ON public.bid_plan_questions;
CREATE POLICY "Bid roles read bid_plan_questions" ON public.bid_plan_questions FOR SELECT
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role])));
DROP POLICY IF EXISTS "Bid roles ask bid_plan_questions as themselves" ON public.bid_plan_questions;
CREATE POLICY "Bid roles ask bid_plan_questions as themselves" ON public.bid_plan_questions FOR INSERT
  WITH CHECK (asked_by = ( SELECT auth.uid() ) AND status = 'open' AND answer IS NULL AND EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])));
DROP POLICY IF EXISTS "Estimators and up update bid_plan_questions" ON public.bid_plan_questions;
CREATE POLICY "Estimators and up update bid_plan_questions" ON public.bid_plan_questions FOR UPDATE
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])))
  WITH CHECK (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])));

COMMENT ON TABLE public.bid_plan_questions IS 'Robot rounds (v2.5737, punch list #142): a person''s question about a bid''s plans from the Plans panel; the robot answers it within a round after the bid''s shadow is sealed, citing sheets; may become an RFI. Never money.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();

COMMIT;
