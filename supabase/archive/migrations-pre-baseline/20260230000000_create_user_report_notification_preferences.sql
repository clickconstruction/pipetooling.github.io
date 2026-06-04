-- user_report_notification_preferences: Masters, Assistants, Devs select which report types
-- (Superintendent Report, Walk Report, Note) trigger push notifications when submitted

CREATE TABLE IF NOT EXISTS public.user_report_notification_preferences (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.report_templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, template_id)
);
CREATE INDEX IF NOT EXISTS idx_user_report_notification_preferences_user ON public.user_report_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_report_notification_preferences_template ON public.user_report_notification_preferences(template_id);
ALTER TABLE public.user_report_notification_preferences ENABLE ROW LEVEL SECURITY;
-- Masters, Assistants, Devs: manage own preferences (SELECT, INSERT, DELETE)
CREATE POLICY "Masters assistants devs can manage own report notification preferences"
ON public.user_report_notification_preferences
FOR ALL
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant')
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant')
  )
);
