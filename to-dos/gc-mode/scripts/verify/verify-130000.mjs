import { q, asRole } from './verify-lib.mjs';
await q('1 switch off', `SELECT value_text FROM public.app_settings WHERE key='gc_customer_due_notices_on_v1';`);
await q('2 column', `SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name='gc_office_notices' AND column_name='due_on';`);
await q('2 checks', `SELECT conname, convalidated, pg_get_constraintdef(oid) LIKE '%pay_soon%' AS names_pay_soon FROM pg_constraint WHERE conrelid='public.gc_office_notices'::regclass AND conname IN ('gc_office_notices_kind_known','gc_office_notices_due_said') ORDER BY 1;`);
await q('3 due list, switch off', `SELECT public.get_gc_customer_due_notices()::text;`);
await q('3b due list as if on 30 days', `SELECT jsonb_typeof(public.get_gc_customer_due_notices(NULL, current_date - 30)) AS t, jsonb_array_length(COALESCE(public.get_gc_customer_due_notices(NULL, current_date - 30)->'notices','[]'::jsonb)) AS notices;`);
await q('4 controller refused', `BEGIN; ${asRole('controller')} SELECT public.get_gc_customer_due_notices(); ROLLBACK;`);
await q('4b grants', `SELECT has_function_privilege('authenticated','public.get_gc_customer_due_notices(date,date)','EXECUTE') AS authed, has_function_privilege('service_role','public.get_gc_customer_due_notices(date,date)','EXECUTE') AS service;`);
