SET lock_timeout = '3s';

-- Commitment ledger for one-off due dates (Tier A of the pushed-back-markers
-- design; client lands separately).
--
-- Editing a due date currently overwrites the old one as if it never
-- existed — the new deadline looks original and the "N days late" clock
-- resets. This ledger remembers: every change to checklist_items.due_date
-- (set / move / clear) writes one row via a single AFTER UPDATE trigger, so
-- the modal edit, any future bulk tool, and manual SQL all leave the same
-- trail. Derived facts (original due = first non-null to_due or the first
-- row's from_due; push count = rows moving later; net slip = current −
-- original) power the "pushed ×N" chips — computed client-side, nothing
-- stored twice. Because from_due captures the pre-change value, items
-- due-dated before this ships get their original recorded on their first
-- push — no backfill needed.

CREATE TABLE IF NOT EXISTS public.checklist_item_due_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  from_due date,
  to_due date
);

COMMENT ON TABLE public.checklist_item_due_changes IS
  'Due-date change ledger for one-off checklist tasks: one row per due_date set/move/clear, written only by the due-change trigger. Original commitment, push count, and net slip derive from it client-side.';

CREATE INDEX IF NOT EXISTS checklist_item_due_changes_item_idx
  ON public.checklist_item_due_changes (checklist_item_id, changed_at);

ALTER TABLE public.checklist_item_due_changes ENABLE ROW LEVEL SECURITY;

-- Visibility mirrors the item itself: the subquery runs under the caller's
-- checklist_items RLS, so whoever can read the task can read its ledger.
-- No client write policies — writes happen only inside the trigger.
DROP POLICY IF EXISTS "Read due changes with the item" ON public.checklist_item_due_changes;
CREATE POLICY "Read due changes with the item" ON public.checklist_item_due_changes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.checklist_items i WHERE i.id = checklist_item_id)
  );

CREATE OR REPLACE FUNCTION public.record_checklist_due_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    INSERT INTO public.checklist_item_due_changes (checklist_item_id, changed_by, from_due, to_due)
    VALUES (NEW.id, auth.uid(), OLD.due_date, NEW.due_date);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.record_checklist_due_change() IS
  'Writes one checklist_item_due_changes row per due_date change (set/move/clear). changed_by = auth.uid(); null for service-role/SQL paths.';

REVOKE EXECUTE ON FUNCTION public.record_checklist_due_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_checklist_due_change() FROM anon;

DROP TRIGGER IF EXISTS record_checklist_due_change ON public.checklist_items;
CREATE TRIGGER record_checklist_due_change
  AFTER UPDATE OF due_date ON public.checklist_items
  FOR EACH ROW
  WHEN (OLD.due_date IS DISTINCT FROM NEW.due_date)
  EXECUTE FUNCTION public.record_checklist_due_change();

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
