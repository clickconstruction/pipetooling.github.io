INSERT INTO public.mercury_drag_sort_labels (
  default_key,
  name,
  schedule_c_line,
  description,
  is_system_default,
  sort_order
)
VALUES (
  'employee_benefits',
  'Employee Benefits',
  '19',
  'deductible contributions you made as an employer to certain employee benefit programs for your employees (not for yourself as the sole proprietor)',
  true,
  85
)
ON CONFLICT (default_key) DO NOTHING;
