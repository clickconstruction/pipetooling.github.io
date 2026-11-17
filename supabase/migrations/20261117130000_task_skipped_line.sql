SET lock_timeout = '3s';

-- v2.7551 (punch list #369, step D3): a repeating task that was not ticked can say it was skipped.
--
-- A daily or weekly task that is not ticked drops off the list the next morning, and nothing asks why. Checklist ->
-- Today now asks once, the day after: did you do it, or was it skipped? *Did it* marks that day's row done, which
-- needs nothing new. *Skipped* needs a line in the thread, so the question is not asked twice and History can tell a
-- skipped day from one nobody answered for. This adds that one kind and lets a person write it.
--
--   1. `skipped` joins the kinds of checklist_instance_events.event_type, beside the twelve of 20261117120000.
--   2. Whoever can read a day row may write a skipped line on it, as themself, like a note, a stuck line and its answer.
--
-- A skipped line changes nothing but the thread: the row stays not done. No function is added.
--
-- Idempotent: the check is dropped by what it holds and added back, and the policy is dropped and remade. No table
-- is created, so no fence is called.

DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.checklist_instance_events'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%event_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.checklist_instance_events DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.checklist_instance_events
  ADD CONSTRAINT checklist_instance_events_event_type_check
  CHECK (event_type IN ('completed', 'reopened', 'comment', 'accepted', 'progress', 'criterion', 'moved', 'stuck', 'unstuck', 'dropped', 'handed', 'map', 'skipped'));
COMMENT ON COLUMN public.checklist_instance_events.event_type IS 'What happened on the day row. completed, reopened and accepted are written by the transitions trigger. comment, progress, criterion, stuck, unstuck and skipped are written by a person who can read the row. moved, dropped, handed and map are written only by the task_* functions of 20261117120000 (punch list #369): the due day moved (body: the day), the task closed as no longer applying (body: why), the task handed on (body: who to, then why), a map put on it (body: the map''s name). skipped (20261117130000): a repeating task''s day that the person says they did not do.';

DROP POLICY IF EXISTS "Insert own comments on visible instances" ON public.checklist_instance_events;
CREATE POLICY "Insert own comments on visible instances" ON public.checklist_instance_events
  FOR INSERT WITH CHECK (
    event_type IN ('comment', 'progress', 'criterion', 'stuck', 'unstuck', 'skipped')
    AND actor_user_id = (SELECT auth.uid())
    AND (event_type <> 'progress' OR percent IS NOT NULL)
    AND EXISTS (SELECT 1 FROM public.checklist_instances i WHERE i.id = instance_id)
  );
