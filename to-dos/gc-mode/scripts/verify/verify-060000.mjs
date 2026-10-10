import { q, asRole } from './verify-lib.mjs'
await q('1 the switch, off (expect false)', `SELECT value_text FROM public.app_settings WHERE key = 'gc_office_notices_on_v1';`)
await q('2 the record: rows, policies, the two _once indexes (expect 0; money_read SELECT plus fences only; 2)', `SELECT (SELECT count(*) FROM public.gc_office_notices) AS rows, (SELECT string_agg(policyname || ':' || cmd || ':' || permissive, ',' ORDER BY policyname) FROM pg_policies WHERE tablename = 'gc_office_notices') AS policies, (SELECT count(*) FROM pg_indexes WHERE tablename = 'gc_office_notices' AND indexname LIKE '%_once%') AS once_indexes;`)
await q('3 what is due as the service role (expect today, the bill day, notices empty while off)', `BEGIN; SET LOCAL ROLE service_role; SELECT public.get_gc_office_notices_due(); ROLLBACK;`)
await q('4 the controller may not read it (expect permission denied; rolled back)', `BEGIN; ${asRole('controller')} SELECT public.get_gc_office_notices_due(); ROLLBACK;`)
