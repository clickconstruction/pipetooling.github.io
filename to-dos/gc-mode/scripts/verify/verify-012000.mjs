import { q, P, ASK, asRole, asTrainee } from './verify-lib.mjs'
const dev = asRole('dev'); const askPkg = `SELECT package_id FROM public.gc_invites WHERE id='${ASK}'`
const BID = 'c4117b0d-0c64-4935-933f-01bd96bfef60'
const add = (projectSql, pkgSql, question, extra='') => `public.gc_add_rfi(jsonb_build_object('projectId', (${projectSql})::text, 'packageId', (${pkgSql})::text, 'question', '${question}', 'sheets', jsonb_build_array('S-102'), 'neededDays', 3${extra}))`
await q('1 functions, rights, constraints', `SELECT p.proname, p.prosecdef AS definer, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS signed_in_can, has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_can FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public' WHERE p.proname IN ('gc_add_rfi','gc_send_rfi_to_architect','gc_answer_rfi','gc_rfi_change_order','gc_trade_rfi_ask') ORDER BY p.proname;`)
await q('1b constraints', `SELECT string_agg(conname, ',' ORDER BY conname) FROM pg_constraint WHERE conrelid = 'public.gc_rfis'::regclass AND conname LIKE 'gc_rfis_change_order%';`)
await q('2a bidding job refused', `BEGIN; ${dev} SELECT ${add(`SELECT '${BID}'::uuid`, `SELECT id FROM public.gc_trade_packages WHERE project_id='${BID}' LIMIT 1`, 'Verify, delete me')}; ROLLBACK;`)
await q('2b blank question refused', `BEGIN; ${dev} SELECT ${add(`SELECT '${P}'::uuid`, askPkg, '')}; ROLLBACK;`)
await q('3 the flow, awarded inside the transaction, rolled back', `BEGIN; ${dev}
SELECT public.gc_award('${ASK}') AS sow;
CREATE TEMP TABLE r AS SELECT ${add(`SELECT '${P}'::uuid`, askPkg, 'Verify, delete me', `, 'holds', jsonb_build_array((SELECT id FROM public.gc_scope_items WHERE package_id = (${askPkg}) LIMIT 1)::text)`)} AS id;
CREATE TEMP TABLE s AS SELECT (SELECT number FROM public.gc_rfis WHERE id = (SELECT id FROM r)) AS number, (SELECT count(*) FROM public.gc_rfi_holds h WHERE h.rfi_id = (SELECT id FROM r)) AS holds;
SELECT public.gc_send_rfi_to_architect((SELECT id FROM r)) AS sent;
SELECT public.gc_answer_rfi((SELECT id FROM r), jsonb_build_object('text', 'Verify answer', 'by', 'architect', 'impact', 'cost', 'cost', 100, 'days', 1)) AS answered;
CREATE TEMP TABLE c AS SELECT public.gc_rfi_change_order((SELECT id FROM r), 'Verify, delete me: RFI change', 110) AS co;
SELECT s.number, s.holds, (SELECT change_order_id = (SELECT co FROM c) FROM public.gc_rfis WHERE id = (SELECT id FROM r)) AS linked, (SELECT reason FROM public.gc_change_orders WHERE id = (SELECT co FROM c)) AS reason, (SELECT status FROM public.gc_change_orders WHERE id = (SELECT co FROM c)) AS co_status FROM s;
DELETE FROM public.gc_change_orders WHERE id = (SELECT co FROM c);
SELECT change_order_id IS NULL AS link_cleared FROM public.gc_rfis WHERE id = (SELECT id FROM r);
ROLLBACK;`)
await q('4 training account', `BEGIN; ${asTrainee} SELECT ${add(`SELECT '${P}'::uuid`, askPkg, 'Verify')}; ROLLBACK;`)
await q('5 trade press as a dev (permission denied)', `BEGIN; ${dev} SELECT public.gc_trade_rfi_ask('ff11d0fb-269e-44de-b92a-e7256c180f67', (${askPkg}), 'x'); ROLLBACK;`)
await q('after: nothing kept', `SELECT (SELECT count(*) FROM public.gc_rfis) AS rfis, (SELECT count(*) FROM public.gc_sows) AS sows, (SELECT count(*) FROM public.gc_change_orders WHERE reason = 'plans') AS plan_cos;`)
