-- Follow Up tab: warmth_count, last_contact, prospect_comments, prospect_callbacks

-- Add columns to prospects
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS warmth_count INTEGER DEFAULT 0;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS last_contact TIMESTAMPTZ;

-- prospect_comments: all interactions (answered, didnt_answer, no_longer_fit, user_comment)
CREATE TABLE IF NOT EXISTS public.prospect_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  comment_text TEXT NOT NULL,
  interaction_type TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prospect_comments_prospect_id ON public.prospect_comments(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_comments_created_at ON public.prospect_comments(created_at);

ALTER TABLE public.prospect_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see prospect comments for prospects they can access"
ON public.prospect_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.prospects p
    WHERE p.id = prospect_comments.prospect_id
    AND (
      p.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician'))
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = p.master_user_id AND assistant_id = auth.uid())
    )
  )
);

CREATE POLICY "Devs, masters, and assistants can insert prospect comments"
ON public.prospect_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.prospects p
    WHERE p.id = prospect_id
    AND (
      p.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician'))
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = p.master_user_id AND assistant_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can delete prospect comments for prospects they can access"
ON public.prospect_comments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.prospects p
    WHERE p.id = prospect_comments.prospect_id
    AND (
      p.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician'))
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = p.master_user_id AND assistant_id = auth.uid())
    )
  )
);

-- prospect_callbacks: calendar callbacks for prospects
CREATE TABLE IF NOT EXISTS public.prospect_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  callback_date TIMESTAMPTZ NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_callbacks_user_id ON public.prospect_callbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_prospect_callbacks_callback_date ON public.prospect_callbacks(callback_date);

ALTER TABLE public.prospect_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own prospect callbacks"
ON public.prospect_callbacks
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Devs, masters, and assistants can insert prospect callbacks"
ON public.prospect_callbacks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.prospects p
    WHERE p.id = prospect_id
    AND (
      p.master_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician'))
      OR EXISTS (SELECT 1 FROM public.master_assistants WHERE master_id = p.master_user_id AND assistant_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can delete their own prospect callbacks"
ON public.prospect_callbacks
FOR DELETE
USING (user_id = auth.uid());
