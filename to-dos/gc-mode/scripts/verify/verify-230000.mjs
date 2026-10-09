import { q, P, asRole } from './verify-lib.mjs'
await q('1 function once, invoker, anon', `SELECT count(*), bool_and(NOT prosecdef) AS invoker, has_function_privilege('anon','public.gc_record_acceptance(uuid, date, text, text, text)','EXECUTE') AS anon_can FROM pg_proc WHERE proname = 'gc_record_acceptance';`)
await q('2 keep trigger', `SELECT count(*) FROM pg_trigger WHERE tgname = 'gc_owner_acceptances_keep' AND NOT tgisinternal;`)
await q('3 nothing accepted', `SELECT count(*) AS acceptances FROM public.gc_owner_acceptances;`)
await q('extra: a refusal as a dev, rolled back (not every line billed)', `BEGIN; ${asRole('dev')} SELECT public.gc_record_acceptance('${P}', public.app_today(), 'Verify, delete me'); ROLLBACK;`)
await q('after', `SELECT count(*) AS acceptances FROM public.gc_owner_acceptances;`)
