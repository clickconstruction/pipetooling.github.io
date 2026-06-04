-- Allow masters and assistants to see which users have push notifications enabled (for People page green dot)
CREATE POLICY "Masters and assistants can select push subscriptions" ON public.push_subscriptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('master_technician', 'assistant')
  )
);
