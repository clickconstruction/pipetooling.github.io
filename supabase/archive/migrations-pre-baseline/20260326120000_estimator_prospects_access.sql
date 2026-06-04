-- Estimator Prospects access: column + helper + RLS so estimators with flag match dev/master/assistant on prospects stack

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS estimator_prospects_access boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.estimator_prospects_access IS 'When role is estimator, grants Prospects CRM access (RLS + UI).';

CREATE OR REPLACE FUNCTION public.user_has_prospects_staff_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND (
        u.role IN ('dev', 'master_technician', 'assistant')
        OR (u.role = 'estimator' AND COALESCE(u.estimator_prospects_access, false))
      )
  );
$$;

COMMENT ON FUNCTION public.user_has_prospects_staff_access() IS 'True for dev/master/assistant, or estimator with estimator_prospects_access. Used by Prospects-related RLS.';

GRANT EXECUTE ON FUNCTION public.user_has_prospects_staff_access() TO authenticated;

-- prospects (universal policies from 20260230000011)
DROP POLICY IF EXISTS "Devs, masters, and assistants can see all prospects" ON public.prospects;
CREATE POLICY "Devs, masters, and assistants can see all prospects"
ON public.prospects
FOR SELECT
USING (public.user_has_prospects_staff_access());

DROP POLICY IF EXISTS "Devs, masters, and assistants can update all prospects" ON public.prospects;
CREATE POLICY "Devs, masters, and assistants can update all prospects"
ON public.prospects
FOR UPDATE
USING (public.user_has_prospects_staff_access())
WITH CHECK (public.user_has_prospects_staff_access());

DROP POLICY IF EXISTS "Devs, masters, and assistants can delete all prospects" ON public.prospects;
CREATE POLICY "Devs, masters, and assistants can delete all prospects"
ON public.prospects
FOR DELETE
USING (public.user_has_prospects_staff_access());

-- prospects INSERT (20260230000009): staff access + ownership; estimators assign to a master_technician
DROP POLICY IF EXISTS "Devs, masters, and assistants can insert prospects" ON public.prospects;
CREATE POLICY "Devs, masters, and assistants can insert prospects"
ON public.prospects
FOR INSERT
WITH CHECK (
  public.user_has_prospects_staff_access()
  AND created_by = auth.uid()
  AND (
    master_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'master_technician')
    )
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = master_user_id
      AND assistant_id = auth.uid()
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.users eu
        WHERE eu.id = auth.uid()
        AND eu.role = 'estimator'
        AND COALESCE(eu.estimator_prospects_access, false)
      )
      AND EXISTS (
        SELECT 1 FROM public.users m
        WHERE m.id = master_user_id
        AND m.role = 'master_technician'
      )
    )
  )
);

-- prospect_comments
DROP POLICY IF EXISTS "Devs, masters, and assistants can see all prospect comments" ON public.prospect_comments;
CREATE POLICY "Devs, masters, and assistants can see all prospect comments"
ON public.prospect_comments
FOR SELECT
USING (public.user_has_prospects_staff_access());

DROP POLICY IF EXISTS "Devs, masters, and assistants can insert prospect comments" ON public.prospect_comments;
CREATE POLICY "Devs, masters, and assistants can insert prospect comments"
ON public.prospect_comments
FOR INSERT
WITH CHECK (
  public.user_has_prospects_staff_access()
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.prospects p
    WHERE p.id = prospect_id
  )
);

DROP POLICY IF EXISTS "Devs, masters, and assistants can delete prospect comments" ON public.prospect_comments;
CREATE POLICY "Devs, masters, and assistants can delete prospect comments"
ON public.prospect_comments
FOR DELETE
USING (public.user_has_prospects_staff_access());

-- prospect_callbacks INSERT (shared staff)
DROP POLICY IF EXISTS "Devs, masters, and assistants can insert prospect callbacks" ON public.prospect_callbacks;
CREATE POLICY "Devs, masters, and assistants can insert prospect callbacks"
ON public.prospect_callbacks
FOR INSERT
WITH CHECK (
  public.user_has_prospects_staff_access()
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.prospects p
    WHERE p.id = prospect_id
  )
);

-- prospect_email_sent SELECT
DROP POLICY IF EXISTS "Devs masters assistants can see all prospect_email_sent" ON public.prospect_email_sent;
CREATE POLICY "Devs masters assistants can see all prospect_email_sent"
ON public.prospect_email_sent
FOR SELECT
USING (public.user_has_prospects_staff_access());

-- prospect_timer_events INSERT (Follow Up timer buttons)
DROP POLICY IF EXISTS "Users can insert their own prospect timer events" ON public.prospect_timer_events;
CREATE POLICY "Users can insert their own prospect timer events"
ON public.prospect_timer_events
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND public.user_has_prospects_staff_access()
);
