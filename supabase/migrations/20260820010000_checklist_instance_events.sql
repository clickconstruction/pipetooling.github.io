SET lock_timeout = '3s';

-- Checklist card history + comments + lead review (Phase 1 of the checklist-card
-- redesign): an append-only per-instance event stream, review stamps on the
-- instance, and a trigger that logs completion transitions automatically so
-- EVERY write path (current Today tab, future card UI, RPCs) feeds history.
--
-- Event types:
--   completed  — completed_at transitioned NULL -> set   (trigger-written)
--   reopened   — completed_at transitioned set -> NULL   (trigger-written; clears review stamps)
--   accepted   — reviewed_at transitioned NULL -> set    (trigger-written; the lead's "dismiss")
--   comment    — a person wrote a note on the card       (client-written under RLS)
--
-- Clients may INSERT only 'comment' rows; the transition rows come from the
-- SECURITY DEFINER trigger (owner postgres, bypasses RLS). Visibility delegates
-- to checklist_instances' own RLS via a nested EXISTS, so events are readable
-- by exactly whoever can read the instance (assignees, the item's creator,
-- dev/master/assistant).

CREATE TABLE IF NOT EXISTS public.checklist_instance_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES public.checklist_instances(id) ON DELETE CASCADE,
  event_type    text NOT NULL CHECK (event_type IN ('completed', 'reopened', 'comment', 'accepted')),
  actor_user_id uuid REFERENCES public.users(id),
  body          text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.checklist_instance_events IS
  'Append-only card history for checklist instances: completed/reopened/accepted transitions (trigger-written) + comments (client-written). Powers the card status strip, comment threads, and the lead review queue.';

CREATE INDEX IF NOT EXISTS checklist_instance_events_instance_created_idx
  ON public.checklist_instance_events (instance_id, created_at);

-- Lead review stamps ("dismiss" in the review queue). Reopening clears them.
ALTER TABLE public.checklist_instances ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.checklist_instances ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(id);

COMMENT ON COLUMN public.checklist_instances.reviewed_at IS
  'When a reviewer (item creator / notify-target / office) dismissed this completion from the review queue. Cleared automatically on reopen.';

-- Transition logger. BEFORE UPDATE so a reopen can clear the review stamps on
-- NEW in the same write. The event INSERT is guarded: history must never make
-- a completion toggle fail (mirrors archive_deleted_record's never-break rule).
CREATE OR REPLACE FUNCTION public.log_checklist_instance_transitions()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL) THEN
    BEGIN
      INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body)
      VALUES (NEW.id, 'completed', auth.uid(), COALESCE(NEW.notes, ''));
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'checklist completed event insert failed for %: %', NEW.id, SQLERRM;
    END;
  ELSIF (OLD.completed_at IS NOT NULL AND NEW.completed_at IS NULL) THEN
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
    BEGIN
      INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body)
      VALUES (NEW.id, 'reopened', auth.uid(), '');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'checklist reopened event insert failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  IF (OLD.reviewed_at IS NULL AND NEW.reviewed_at IS NOT NULL) THEN
    BEGIN
      INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body)
      VALUES (NEW.id, 'accepted', COALESCE(NEW.reviewed_by, auth.uid()), '');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'checklist accepted event insert failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checklist_instance_transitions_trigger ON public.checklist_instances;
CREATE TRIGGER checklist_instance_transitions_trigger
  BEFORE UPDATE ON public.checklist_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.log_checklist_instance_transitions();

-- RLS: read follows the parent instance's own policies (nested RLS in the
-- EXISTS runs as the querying user); clients may insert ONLY comments, as
-- themselves, on instances they can see. No UPDATE/DELETE — append-only.
ALTER TABLE public.checklist_instance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read events where instance visible" ON public.checklist_instance_events;
CREATE POLICY "Read events where instance visible" ON public.checklist_instance_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.checklist_instances i WHERE i.id = instance_id)
  );

DROP POLICY IF EXISTS "Insert own comments on visible instances" ON public.checklist_instance_events;
CREATE POLICY "Insert own comments on visible instances" ON public.checklist_instance_events
  FOR INSERT WITH CHECK (
    event_type = 'comment'
    AND actor_user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.checklist_instances i WHERE i.id = instance_id)
  );

GRANT SELECT, INSERT ON TABLE public.checklist_instance_events TO authenticated;

-- Backfill so no existing history is lost and old cards read correctly:
-- a 'completed' event per already-completed instance, and a 'comment' event
-- per non-empty legacy notes value (author = whoever completed). Idempotent
-- via NOT EXISTS on (instance, type).
INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body, created_at)
SELECT i.id, 'completed', i.completed_by_user_id, '', i.completed_at
FROM public.checklist_instances i
WHERE i.completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.checklist_instance_events e
    WHERE e.instance_id = i.id AND e.event_type = 'completed'
  );

INSERT INTO public.checklist_instance_events (instance_id, event_type, actor_user_id, body, created_at)
SELECT i.id, 'comment', i.completed_by_user_id, i.notes, COALESCE(i.completed_at, i.created_at, now())
FROM public.checklist_instances i
WHERE i.notes IS NOT NULL AND btrim(i.notes) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.checklist_instance_events e
    WHERE e.instance_id = i.id AND e.event_type = 'comment'
  );

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
