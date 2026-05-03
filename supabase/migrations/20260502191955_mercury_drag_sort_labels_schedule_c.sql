-- Banking Drag Sort labels: optional Schedule C line + description (tax / bookkeeping notes).

ALTER TABLE public.mercury_drag_sort_labels
  ADD COLUMN schedule_c_line text
    CONSTRAINT mercury_drag_sort_labels_schedule_c_line_len_chk CHECK (
      schedule_c_line IS NULL
      OR (
        char_length(trim(schedule_c_line)) >= 1
        AND char_length(schedule_c_line) <= 32
      )
    ),
  ADD COLUMN description text
    CONSTRAINT mercury_drag_sort_labels_description_len_chk CHECK (
      description IS NULL
      OR char_length(description) <= 2000
    );

COMMENT ON COLUMN public.mercury_drag_sort_labels.schedule_c_line IS
  'User hint: IRS Form 1040 Schedule C line reference (e.g. 8); optional.';

COMMENT ON COLUMN public.mercury_drag_sort_labels.description IS
  'User notes on what expenses belong in this Drag Sort label bucket; optional.';
