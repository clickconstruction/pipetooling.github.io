SET lock_timeout = '3s';

-- Rolling-horizon cutover (v2.2056): weekly items used to materialize 104
-- weeks of occurrences at save. The nightly top-up in send-scheduled-reminders
-- now keeps 35 days stocked, so the pre-created far future is dead weight that
-- pollutes every query. Prune it: ONLY weekly items, ONLY untouched rows
-- (incomplete, no conversation events) beyond the horizon. Assignee rows go
-- via ON DELETE CASCADE. Idempotent — re-running deletes nothing new.

DELETE FROM public.checklist_instances ci
USING public.checklist_items i
WHERE i.id = ci.checklist_item_id
  AND i.repeat_type = 'day_of_week'
  AND ci.completed_at IS NULL
  AND ci.scheduled_date > (CURRENT_DATE + 35)
  AND NOT EXISTS (
    SELECT 1 FROM public.checklist_instance_events e WHERE e.instance_id = ci.id
  );
