-- Notification history ledger: log all notifications sent to users (email/push)
CREATE TABLE public.notification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_type text NOT NULL,
  title text NOT NULL,
  body_preview text,
  channel text NOT NULL CHECK (channel IN ('email', 'push', 'both')),
  step_id uuid REFERENCES public.project_workflow_steps(id) ON DELETE SET NULL,
  workflow_id uuid REFERENCES public.project_workflows(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  checklist_instance_id uuid REFERENCES public.checklist_instances(id) ON DELETE SET NULL,
  sent_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_notification_history_recipient_sent
  ON public.notification_history (recipient_user_id, sent_at DESC);

ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own notification history"
  ON public.notification_history FOR SELECT
  USING (recipient_user_id = auth.uid());
