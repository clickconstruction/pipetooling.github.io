-- prospect_calling_locks: prevent multiple users from calling the same prospect
-- One lock per prospect; when a user views a prospect in Follow Up, they lock it
CREATE TABLE IF NOT EXISTS public.prospect_calling_locks (
  prospect_id UUID PRIMARY KEY REFERENCES public.prospects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_calling_locks_user_id ON public.prospect_calling_locks(user_id);

ALTER TABLE public.prospect_calling_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see all prospect calling locks"
ON public.prospect_calling_locks
FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own prospect calling lock"
ON public.prospect_calling_locks
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own prospect calling lock"
ON public.prospect_calling_locks
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own prospect calling lock"
ON public.prospect_calling_locks
FOR DELETE
USING (user_id = auth.uid());
