-- Allow devs to see all prospect_timer_events for Team tab activity tracking
CREATE POLICY "Devs can see all prospect timer events"
ON public.prospect_timer_events
FOR SELECT
USING (public.is_dev());
