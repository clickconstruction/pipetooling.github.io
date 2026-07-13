-- Help-guide feedback: any signed-in user submits feedback from the bottom of
-- a /help guide; devs work an open/close inbox (Dashboard + Checklist Review)
-- and get a web push (notify-help-feedback edge function).
--
-- Thin clone of dispatch_requests: no group table (audience = role 'dev' via
-- is_dev()), no notes, no dismissals, no guard-update trigger (only devs can
-- UPDATE, so there is nobody to guard against). Not added to the
-- supabase_realtime publication — no subscriber ships with this feature
-- (see .cursor/rules/supabase-realtime.mdc); the inbox refreshes on load and
-- via a same-tab event.

CREATE TABLE IF NOT EXISTS public.help_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  guide_slug text NOT NULL CHECK (char_length(guide_slug) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  closed_note text
);

ALTER TABLE public.help_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS help_feedback_insert ON public.help_feedback;
DROP POLICY IF EXISTS help_feedback_select ON public.help_feedback;
DROP POLICY IF EXISTS help_feedback_update ON public.help_feedback;

CREATE POLICY help_feedback_insert ON public.help_feedback
  FOR INSERT TO authenticated
  WITH CHECK (from_user_id = (SELECT auth.uid()));

CREATE POLICY help_feedback_select ON public.help_feedback
  FOR SELECT TO authenticated
  USING (from_user_id = (SELECT auth.uid()) OR public.is_dev());

CREATE POLICY help_feedback_update ON public.help_feedback
  FOR UPDATE TO authenticated
  USING (public.is_dev())
  WITH CHECK (public.is_dev());

COMMENT ON TABLE public.help_feedback IS
  'Feedback submitted from /help guides. Any authenticated user may create (own rows); devs see the inbox and open/close items. Rows are closed, never deleted.';
COMMENT ON COLUMN public.help_feedback.guide_slug IS
  'Stable slug of the /help guide the feedback is about; deep link /help?g=<slug>.';
COMMENT ON COLUMN public.help_feedback.closed_note IS
  'Optional note entered by the dev who closed the item.';
