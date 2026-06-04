-- Canonical user-facing label: Superintendent Report → Status Report (stored name)
UPDATE public.report_templates
SET name = 'Status Report'
WHERE name = 'Superintendent Report';
