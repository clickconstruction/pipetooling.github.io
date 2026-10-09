import { q, asRole, P, ASK } from './verify-lib.mjs'
await q('1 trigger on gc_trade_packages (expect one row, O)', `SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.gc_trade_packages'::regclass AND tgname = 'gc_trade_packages_award_guard';`)
await q('2 gc_award names the flag twice (expect 2)', `SELECT (length(prosrc) - length(replace(prosrc, 'gc.award_write', ''))) / length('gc.award_write') AS flags FROM pg_proc WHERE oid = 'public.gc_award(uuid, uuid)'::regprocedure;`)
await q('3 a dev plain write refused in words (rolled back)', `BEGIN; ${asRole('dev')} UPDATE public.gc_trade_packages SET awarded_by = auth.uid() WHERE project_id = '${P}'; ROLLBACK;`)
await q('4 gc_award still awards as a dev, flag empty after (rolled back)', `BEGIN; ${asRole('dev')} SELECT public.gc_award('${ASK}') IS NOT NULL AS awarded, coalesce(current_setting('gc.award_write', true), '') AS flag_after; ROLLBACK;`)
await q('5 awards after the rollbacks (expect 0)', `SELECT count(*) AS awarded FROM public.gc_trade_packages WHERE awarded_invite_id IS NOT NULL OR awarded_by IS NOT NULL;`)
