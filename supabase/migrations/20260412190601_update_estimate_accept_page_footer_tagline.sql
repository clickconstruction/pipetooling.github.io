-- Acceptance page footer tagline: plumbing -> service (matches builtin BUILTIN_ACCEPT_PAGE_FOOTER).

UPDATE public.app_settings
SET value_text = replace(
  value_text,
  'Reliable plumbing today, innovative solutions for tomorrow.',
  'Reliable service today, innovative solutions for tomorrow.'
)
WHERE key = 'estimate_accept_page_footer'
  AND position('Reliable plumbing today, innovative solutions for tomorrow.' in value_text) > 0;
