-- Remove Quickfill Schedule per-person day calendar events (revert feature).

DROP POLICY IF EXISTS "user_day_calendar_events_schedule_roles_all"
  ON public.user_day_calendar_events;

DROP TABLE IF EXISTS public.user_day_calendar_events;
