import { q, asRole } from './verify-lib.mjs'
await q('1 two functions, invoker, anon', `SELECT count(*), bool_and(NOT prosecdef) AS invoker, bool_or(has_function_privilege('anon', oid, 'EXECUTE')) AS anon_can FROM pg_proc WHERE proname IN ('gc_draft_change_order_from_request','gc_turn_down_change_request');`)
await q('2a estimator refused (money team)', `BEGIN; ${asRole('estimator')} SELECT public.gc_turn_down_change_request('00000000-0000-0000-0000-000000000001', 'Verify'); ROLLBACK;`)
await q('2b controller refused (dev door)', `BEGIN; ${asRole('controller')} SELECT public.gc_turn_down_change_request('00000000-0000-0000-0000-000000000001', 'Verify'); ROLLBACK;`)
await q('2c dev: not there (rolled back)', `BEGIN; ${asRole('dev')} SELECT public.gc_turn_down_change_request('00000000-0000-0000-0000-000000000001', 'Verify'); ROLLBACK;`)
await q('after', `SELECT count(*) AS requests FROM public.gc_trade_change_requests;`)
