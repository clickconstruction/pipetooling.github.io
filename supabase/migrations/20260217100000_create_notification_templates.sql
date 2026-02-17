-- Notification templates for push notifications (browser/OS notifications)
-- Devs can customize title and body; use {{variable}} for substitution

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type text NOT NULL UNIQUE,
  push_title text NOT NULL,
  push_body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON public.notification_templates(template_type);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Devs can read notification templates"
ON public.notification_templates FOR SELECT
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev'));

CREATE POLICY "Devs can insert notification templates"
ON public.notification_templates FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev'));

CREATE POLICY "Devs can update notification templates"
ON public.notification_templates FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev'))
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'dev'));

-- Seed default templates
INSERT INTO public.notification_templates (template_type, push_title, push_body) VALUES
  ('checklist_completed', 'Checklist completed', '{{assignee_name}} completed: {{item_title}}'),
  ('test_notification', 'Test notification', 'If you see this, push notifications are working!'),
  ('stage_assigned_started', 'Stage started', '{{project_name}} - {{stage_name}} has been started. Assigned to {{assigned_to_name}}.'),
  ('stage_assigned_complete', 'Stage completed', '{{project_name}} - {{stage_name}} has been completed by {{assigned_to_name}}.'),
  ('stage_assigned_reopened', 'Stage re-opened', '{{project_name}} - {{stage_name}} has been re-opened. Assigned to {{assigned_to_name}}.'),
  ('stage_me_started', 'Stage started', '{{stage_name}} in {{project_name}} has been started.'),
  ('stage_me_complete', 'Stage completed', '{{stage_name}} in {{project_name}} has been completed.'),
  ('stage_me_reopened', 'Stage re-opened', '{{stage_name}} in {{project_name}} has been re-opened.'),
  ('stage_next_complete_or_approved', 'Your turn: Stage completed', '{{stage_name}} has been completed. You''re up next for {{next_stage_name}}.'),
  ('stage_prior_rejected', 'Stage rejected', '{{stage_name}} was rejected. Reason: {{rejection_reason}}')
ON CONFLICT (template_type) DO NOTHING;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON public.notification_templates;
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
