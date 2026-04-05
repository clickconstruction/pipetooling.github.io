-- Update org app_settings only where the checkbox label still matches the previous seeded default.

UPDATE public.app_settings
SET value_text =
  'I agree to conduct business electronically with Click Plumbing and Electrical and have read and agree to this estimate and the terms above.'
WHERE key = 'estimate_accept_checkbox_label'
  AND value_text = 'I have read and agree to this estimate and the terms above.';
