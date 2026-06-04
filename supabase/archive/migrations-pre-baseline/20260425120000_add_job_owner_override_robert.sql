-- Job owner override: Robert creates jobs as Malachi
-- Uses name matching; verify names match your users table
INSERT INTO public.app_settings (key, value_text)
SELECT
  'job_owner_override_' || robert.id,
  (SELECT id::text FROM public.users WHERE name ILIKE '%Malachi%' LIMIT 1)
FROM public.users robert
WHERE robert.role = 'dev' AND robert.name ILIKE '%Robert%'
LIMIT 1
ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;
