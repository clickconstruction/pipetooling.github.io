import { q, P, ASK, asRole, asTrainee } from './verify-lib.mjs'
const dev = asRole('dev')
const add = (pkgSql, extra='') => `public.gc_add_submittal(jsonb_build_object('packageId', (${pkgSql})::text, 'title', 'Verify, delete me', 'kind', 'product data'${extra}))`
const askPkg = `SELECT package_id FROM public.gc_invites WHERE id='${ASK}'`
await q('1 six functions, rights', `SELECT p.proname, p.prosecdef AS definer, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS signed_in_can, has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_can FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public' WHERE p.proname IN ('gc_submittal_move','gc_add_submittal','gc_submittal_came_in','gc_send_submittal_to_architect','gc_answer_submittal','gc_trade_submittal_send') ORDER BY p.proname;`)
await q('2a no trade', `BEGIN; ${dev} SELECT ${add(`SELECT '00000000-0000-0000-0000-000000000001'::uuid`)}; ROLLBACK;`)
await q('2b our own crew (Plumbing)', `BEGIN; ${dev} SELECT ${add(`SELECT id FROM public.gc_trade_packages WHERE project_id='${P}' AND ours LIMIT 1`)}; ROLLBACK;`)
await q('2c not awarded', `BEGIN; ${dev} SELECT ${add(askPkg)}; ROLLBACK;`)
await q('3 the flow, awarded inside the transaction, rolled back', `BEGIN; ${dev}
SELECT public.gc_award('${ASK}') AS sow;
CREATE TEMP TABLE s AS SELECT ${add(askPkg, `, 'specSection', '03 30 00', 'lineIds', jsonb_build_array((SELECT id FROM public.gc_scope_items WHERE package_id = (${askPkg}) LIMIT 1)::text)`)} AS id;
SELECT number, title, (SELECT count(*) FROM public.gc_submittal_holds h WHERE h.submittal_id = s.id) AS holds FROM public.gc_submittals, s WHERE gc_submittals.id = s.id;
ROLLBACK;`)
await q('4 training account', `BEGIN; ${asTrainee} SELECT ${add(askPkg)}; ROLLBACK;`)
await q('5 trade verb as a dev (permission denied)', `BEGIN; ${dev} SELECT public.gc_trade_submittal_send('${P}', '00000000-0000-0000-0000-000000000001', 'x'); ROLLBACK;`)
await q('after: nothing kept', `SELECT (SELECT count(*) FROM public.gc_submittals) AS submittals, (SELECT count(*) FROM public.gc_sows) AS sows;`)
