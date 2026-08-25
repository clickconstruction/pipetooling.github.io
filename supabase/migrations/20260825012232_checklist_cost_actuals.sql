SET lock_timeout = '3s';

-- Actuals vs estimates (cost-lens follow-up): how long a costed task really
-- took, recorded at sign-off (one tap; an untouched sign-off records nothing)
-- or after the fact from the cost modal. Same dev/controller RLS as the row.
ALTER TABLE public.checklist_item_costs
  ADD COLUMN IF NOT EXISTS actual_hours numeric NULL CHECK (actual_hours > 0),
  ADD COLUMN IF NOT EXISTS actual_recorded_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actual_recorded_at timestamptz NULL;
