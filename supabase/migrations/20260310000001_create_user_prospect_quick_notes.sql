-- Per-user quick note buttons for Prospects Follow Up (e.g. "left voicemail")
-- Users can add and delete their own quick notes; clicking inserts that text as a prospect_comment

CREATE TABLE IF NOT EXISTS public.user_prospect_quick_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, label)
);

CREATE INDEX IF NOT EXISTS idx_user_prospect_quick_notes_user_id ON public.user_prospect_quick_notes(user_id);

ALTER TABLE public.user_prospect_quick_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prospect quick notes"
ON public.user_prospect_quick_notes FOR ALL
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
