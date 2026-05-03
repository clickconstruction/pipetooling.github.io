-- One-time UX rename: two built-in labels shared "Rent or Lease"; distinguish by Schedule C line (20a / 20b).
-- Guard trigger blocks UPDATE of name on is_system_default rows; disable briefly for this data fix only.

ALTER TABLE public.mercury_drag_sort_labels
  DISABLE TRIGGER mercury_drag_sort_labels_guard_system_fields_trg;

UPDATE public.mercury_drag_sort_labels
SET name = 'Equipment Lease'
WHERE is_system_default = true
  AND default_key = 'rent_lease_20a';

UPDATE public.mercury_drag_sort_labels
SET name = 'Property Lease'
WHERE is_system_default = true
  AND default_key = 'rent_lease_20b';

ALTER TABLE public.mercury_drag_sort_labels
  ENABLE TRIGGER mercury_drag_sort_labels_guard_system_fields_trg;
