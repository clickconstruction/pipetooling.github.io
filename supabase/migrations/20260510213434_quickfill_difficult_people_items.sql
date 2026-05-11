-- Quickfill "Difficult people": dev adds follow-up rows (person + action +
-- reason); dev / master_technician / assistant can read and mark complete.
-- Non-dev updates are restricted by trigger to completing open items only.

CREATE TABLE public.quickfill_difficult_people_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people (id) ON DELETE RESTRICT,
  action_text text NOT NULL,
  reason_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  completed_at timestamptz,
  completed_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  CONSTRAINT quickfill_difficult_people_items_completed_pair_ck CHECK (
    (completed_at IS NULL AND completed_by IS NULL)
    OR (completed_at IS NOT NULL AND completed_by IS NOT NULL)
  )
);

COMMENT ON TABLE public.quickfill_difficult_people_items IS 'Quickfill internal follow-ups about people (dev adds; staff marks complete).';

CREATE INDEX quickfill_difficult_people_items_open_created_idx
  ON public.quickfill_difficult_people_items (created_at ASC)
  WHERE completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.quickfill_difficult_people_items_non_dev_update_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_dev() THEN
    RETURN NEW;
  END IF;

  IF NEW.person_id IS DISTINCT FROM OLD.person_id
     OR NEW.action_text IS DISTINCT FROM OLD.action_text
     OR NEW.reason_text IS DISTINCT FROM OLD.reason_text
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Only developers may edit difficult people item details';
  END IF;

  IF OLD.completed_at IS NOT NULL THEN
    IF NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.completed_by IS DISTINCT FROM OLD.completed_by THEN
      RAISE EXCEPTION 'Only developers may change completion on difficult people items';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.completed_at IS NULL THEN
    IF NEW.completed_by IS NOT DISTINCT FROM OLD.completed_by THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'completed_by must stay unset until the item is marked done';
  END IF;

  NEW.completed_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER quickfill_difficult_people_items_non_dev_update_guard_trg
  BEFORE UPDATE ON public.quickfill_difficult_people_items
  FOR EACH ROW
  EXECUTE FUNCTION public.quickfill_difficult_people_items_non_dev_update_guard();

ALTER TABLE public.quickfill_difficult_people_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quickfill_difficult_people_items_select_staff"
  ON public.quickfill_difficult_people_items
  FOR SELECT
  TO authenticated
  USING (public.is_dev_or_master_or_assistant());

CREATE POLICY "quickfill_difficult_people_items_insert_dev"
  ON public.quickfill_difficult_people_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_dev());

CREATE POLICY "quickfill_difficult_people_items_update_staff"
  ON public.quickfill_difficult_people_items
  FOR UPDATE
  TO authenticated
  USING (public.is_dev_or_master_or_assistant())
  WITH CHECK (public.is_dev_or_master_or_assistant());

CREATE POLICY "quickfill_difficult_people_items_delete_dev"
  ON public.quickfill_difficult_people_items
  FOR DELETE
  TO authenticated
  USING (public.is_dev());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quickfill_difficult_people_items TO authenticated;
