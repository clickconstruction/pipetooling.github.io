-- Drag Sort: built-in Schedule C style labels per user (idempotent insert from app).

ALTER TABLE public.mercury_drag_sort_labels
  ADD COLUMN is_system_default boolean NOT NULL DEFAULT false,
  ADD COLUMN default_key text
    CONSTRAINT mercury_drag_sort_labels_default_key_len_chk CHECK (
      default_key IS NULL
      OR (
        char_length(default_key) >= 1
        AND char_length(default_key) <= 64
      )
    );

COMMENT ON COLUMN public.mercury_drag_sort_labels.is_system_default IS
  'True for app-seeded built-in labels; name/schedule_c_line/description cannot be edited.';

COMMENT ON COLUMN public.mercury_drag_sort_labels.default_key IS
  'Stable id for built-in label (e.g. advertising); NULL for user-created labels.';

ALTER TABLE public.mercury_drag_sort_labels
  ADD CONSTRAINT mercury_drag_sort_labels_system_default_key_consistency_chk CHECK (
    (
      is_system_default = false
      AND default_key IS NULL
    )
    OR (
      is_system_default = true
      AND default_key IS NOT NULL
    )
  );

CREATE UNIQUE INDEX mercury_drag_sort_labels_user_default_key_uidx
  ON public.mercury_drag_sort_labels (user_id, default_key);

CREATE OR REPLACE FUNCTION public.mercury_drag_sort_labels_guard_system_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF OLD.is_system_default
     AND (
       NEW.name IS DISTINCT FROM OLD.name
       OR NEW.schedule_c_line IS DISTINCT FROM OLD.schedule_c_line
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.default_key IS DISTINCT FROM OLD.default_key
       OR NEW.is_system_default IS DISTINCT FROM OLD.is_system_default
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
     )
  THEN
    RAISE EXCEPTION 'Built-in Drag Sort labels cannot be edited'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER mercury_drag_sort_labels_guard_system_fields_trg
  BEFORE UPDATE ON public.mercury_drag_sort_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.mercury_drag_sort_labels_guard_system_fields();
