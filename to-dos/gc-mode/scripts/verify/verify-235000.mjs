import { q, asRole } from './verify-lib.mjs'
await q('1 one function, five args, anon', `SELECT count(*), min(pronargs) AS args, bool_or(has_function_privilege('anon', oid, 'EXECUTE')) AS anon_can FROM pg_proc WHERE proname = 'gc_answer_change_order';`)
await q('2 no declined note yet', `SELECT count(*) AS notes FROM public.gc_change_orders WHERE declined_note <> '';`)
await q('extra: a signed-in user saying portal is refused, rolled back', `BEGIN; ${asRole('dev')} SELECT public.gc_answer_change_order((SELECT id FROM public.gc_change_orders ORDER BY created_at LIMIT 1), true, public.app_today(), 'portal', ''); ROLLBACK;`)
await q('after', `SELECT count(*) AS answered_portal FROM public.gc_change_orders WHERE answered_how = 'portal';`)
