-- Customer estimate document: rename default “Valid through” prefix to “Expires on:” for orgs still on seeded copy.
UPDATE public.app_settings
SET value_text = 'Expires on: '
WHERE key = 'estimate_doc_valid_through_prefix'
  AND value_text = 'Valid through ';
