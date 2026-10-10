import { q, asRole } from './verify-lib.mjs'
const T = ['gc_sows','gc_sow_lines','gc_draws','gc_draw_lines','gc_sow_line_reports','gc_change_order_trade_sends','gc_back_charges']
await q('1 the seven money_read policies (expect 7 rows, SELECT, authenticated, gc_money_team in qual, beside _dev ALL)', `SELECT tablename, policyname, cmd, roles::text, qual FROM pg_policies WHERE tablename IN (${T.map(t=>`'${t}'`).join(',')}) AND policyname LIKE '%_money_read' ORDER BY 1;`)
await q('1b the _dev policies still there (expect 7)', `SELECT count(*) AS dev_policies FROM pg_policies WHERE tablename IN (${T.map(t=>`'${t}'`).join(',')}) AND policyname LIKE '%_dev' AND cmd = 'ALL';`)
const counts = T.map(t => `(SELECT count(*) FROM public.${t}) AS ${t}`).join(', ')
await q('2a counts as a dev (rolled back)', `BEGIN; ${asRole('dev')} SELECT ${counts}; ROLLBACK;`)
await q('2b counts as the controller (expect equal to 2a; rolled back)', `BEGIN; ${asRole('controller')} SELECT ${counts}; ROLLBACK;`)
await q('3 the controller writes none (expect 0 rows reached; rolled back)', `BEGIN; ${asRole('controller')} WITH u AS (UPDATE public.gc_draws SET signed_title = signed_title RETURNING 1) SELECT count(*) AS rows_reached FROM u; ROLLBACK;`)
await q('3b the controller approving a made-up draw (expect the not-found words; rolled back)', `BEGIN; ${asRole('controller')} SELECT public.gc_approve_draw('00000000-0000-0000-0000-000000000001'); ROLLBACK;`)
