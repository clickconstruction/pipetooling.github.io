-- Allow assistants to see all prospect_timer_events for Prospects Team tab
CREATE POLICY "Assistants can see all prospect timer events"
ON public.prospect_timer_events
FOR SELECT
USING (public.is_assistant());
