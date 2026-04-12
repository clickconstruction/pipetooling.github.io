-- Default thank-you body: add closing sentence (estimate acceptance public page).

UPDATE public.app_settings
SET value_text =
  'Your response has been recorded. The contractor will follow up with you. We are excited to see you soon.'
WHERE key = 'estimate_thank_you_body';
