-- Banking Mercury Drag Sort: built-in "Internal Transfers" accounting label.
-- Movement between the org's own accounts. Treated as a non-expense:
-- excluded from Schedule C totals and from the Materials cost rollup in
-- Overhead Parts (see src/lib/overheadPartsAccountingBuckets.ts) and
-- mutually exclusive with mercury_transaction_splits in the UI.

INSERT INTO public.mercury_drag_sort_labels (
  default_key,
  name,
  schedule_c_line,
  description,
  is_system_default,
  sort_order
)
VALUES (
  'internal_transfers',
  'Internal Transfers',
  'N/A',
  'Movement between your own Mercury accounts. Not an expense — excluded from Schedule C totals and from job/material cost rollups. Cannot be assigned to a job split.',
  true,
  9999
)
ON CONFLICT (default_key) DO NOTHING;
