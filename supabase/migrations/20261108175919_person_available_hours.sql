-- v2.6707 — person_available_hours: the hours a person can work in a week, drawn (People → People → Utilization,
-- My Time → Hours you can work). Append-only: a change of mind is a new row from a Sunday on, so the Utilization
-- board reads an old week against the answer that held then. The first answer reads the weeks before it too
-- (the client's rule in src/lib/people/utilization.ts answerInForce). Idempotent and additive; no client reads
-- the table before PR 2 of the train lands, so deploy order is free.
SET lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS public.person_available_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- The weekly total: the drawing's hours when a week was drawn, else the number typed.
  hours_per_week numeric(4,1) NOT NULL CHECK (hours_per_week >= 0 AND hours_per_week <= 80),
  -- The week as drawn: seven arrays, Sunday first, each of [start, end] minute pairs on the company clock;
  -- NULL when only a number was given.
  days jsonb CHECK (days IS NULL OR (jsonb_typeof(days) = 'array' AND jsonb_array_length(days) = 7)),
  -- The Sunday the answer holds from.
  effective_from date NOT NULL,
  note text,
  -- Who answered: the person themself (set_by = user_id) or the office person who set it for them.
  set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS person_available_hours_user_from_idx
  ON public.person_available_hours (user_id, effective_from DESC, created_at DESC);

COMMENT ON TABLE public.person_available_hours IS
  'v2.6707: the hours a person can work in a week, drawn (days: seven arrays, Sunday first, of [start, end] minutes) or typed (hours_per_week), from the Sunday effective_from on. Append-only; the newest row in force on a week''s Sunday wins and the first row reads the weeks before it. Self-answered on My Time or set by the office on People → Utilization.';
COMMENT ON COLUMN public.person_available_hours.days IS
  'The week as drawn: seven JSON arrays, Sunday first, each a list of [start_minute, end_minute] pairs on the company clock (end exclusive). NULL when the person typed a number instead.';
COMMENT ON COLUMN public.person_available_hours.effective_from IS 'The Sunday the answer holds from (pay weeks run Sunday to Saturday).';

ALTER TABLE public.person_available_hours ENABLE ROW LEVEL SECURITY;

-- Read: your own answers, or everyone's for the roles that read other people's clock sessions (the Hours tab's gate).
DROP POLICY IF EXISTS person_available_hours_read ON public.person_available_hours;
CREATE POLICY person_available_hours_read ON public.person_available_hours
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_dev() OR public.is_assistant() OR public.has_payroll_access());

-- Write: your own answer stamped with yourself, or the office's answer for anyone stamped with the office person.
-- No UPDATE or DELETE for anyone signed in: a correction is a new answer.
DROP POLICY IF EXISTS person_available_hours_write ON public.person_available_hours;
CREATE POLICY person_available_hours_write ON public.person_available_hours
  FOR INSERT TO authenticated
  WITH CHECK (
    set_by = auth.uid()
    AND (user_id = auth.uid() OR public.is_dev() OR public.is_assistant() OR public.has_payroll_access())
  );

REVOKE ALL ON public.person_available_hours FROM anon;
GRANT SELECT, INSERT ON public.person_available_hours TO authenticated;

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
