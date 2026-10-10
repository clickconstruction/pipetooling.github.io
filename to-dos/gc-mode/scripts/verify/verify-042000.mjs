import { q, asRole } from './verify-lib.mjs'
await q('1 the row, off (expect false)', `SELECT value_text FROM public.app_settings WHERE key = 'gc_card_bill_on_v1';`)
await q('2 the policy (expect UPDATE, authenticated, naming the key and is_master_or_dev)', `SELECT policyname, cmd, roles::text, qual, with_check FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'master_or_dev_update_gc_card_bill_on';`)
await q('3a the controller flips it: expect 0 rows (rolled back)', `BEGIN; ${asRole('controller')} WITH u AS (UPDATE public.app_settings SET value_text = 'true' WHERE key = 'gc_card_bill_on_v1' RETURNING 1) SELECT count(*) AS rows_reached FROM u; ROLLBACK;`)
await q('3b the owner flips it: expect 1 row (rolled back)', `BEGIN; ${asRole('master_technician')} WITH u AS (UPDATE public.app_settings SET value_text = 'true' WHERE key = 'gc_card_bill_on_v1' RETURNING 1) SELECT count(*) AS rows_reached FROM u; ROLLBACK;`)
await q('3c still off after the rollbacks (expect false)', `SELECT value_text FROM public.app_settings WHERE key = 'gc_card_bill_on_v1';`)
