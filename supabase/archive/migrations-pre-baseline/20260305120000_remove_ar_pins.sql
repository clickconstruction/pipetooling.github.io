-- Remove AR pins (path=/jobs, tab=receivables) - feature deprecated in favor of Billed pin
DELETE FROM public.user_pinned_tabs
WHERE path = '/jobs' AND tab = 'receivables';
