-- Per-user time off (PTO, etc.) for calendar + salary sync skip.
-- RLS: self CRUD; read for pay staff / team leads (parity with salary schedule).

CREATE TABLE public.user_time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  kind TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_time_off_end_after_start CHECK (end_date >= start_date),
  CONSTRAINT user_time_off_kind_check CHECK (kind IN ('pto', 'unpaid', 'other'))
);

CREATE INDEX idx_user_time_off_user_dates
ON public.user_time_off (user_id, start_date, end_date);

COMMENT ON TABLE public.user_time_off IS 'User-entered time-off ranges (company calendar dates). Resolution: PTO before salary template/overrides; sync deletes non-final salary_schedule rows.';

ALTER TABLE public.user_time_off ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_time_off_select"
ON public.user_time_off FOR SELECT
USING (
  user_id = auth.uid()
  OR public.salary_schedule_staff_or_self_target(user_id)
  OR public.is_team_lead_for_member(auth.uid(), user_id)
);

CREATE POLICY "user_time_off_insert"
ON public.user_time_off FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_time_off_update"
ON public.user_time_off FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_time_off_delete"
ON public.user_time_off FOR DELETE
USING (user_id = auth.uid());
