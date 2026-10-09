import { q } from './verify-lib.mjs'
await q('1 table policies', `SELECT count(*) AS pols, string_agg(policyname, ',' ORDER BY policyname) AS names FROM pg_policies WHERE tablename = 'gc_money_monday_email_requests';`)
await q('2 payload is the service role\'s only', `SELECT has_function_privilege('authenticated','public.get_gc_money_monday_payload()','EXECUTE') AS signed_in, has_function_privilege('service_role','public.get_gc_money_monday_payload()','EXECUTE') AS service, has_function_privilege('anon','public.get_gc_money_monday_payload()','EXECUTE') AS anon;`)
await q('3 the cron', `SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'gc-money-monday-email';`)
await q('4 the payload as the service role, read only', `BEGIN; SET LOCAL ROLE service_role; SELECT public.get_gc_money_monday_payload() AS payload; ROLLBACK;`)
