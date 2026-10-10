import { q, asRole } from './verify-lib.mjs';
await q('1 rls', `SELECT relrowsecurity FROM pg_class WHERE oid='public.gc_trade_files'::regclass;`);
await q('1 policies', `SELECT policyname, permissive, cmd FROM pg_policies WHERE tablename='gc_trade_files' ORDER BY policyname;`);
await q('1b table grants', `SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='gc_trade_files' GROUP BY grantee ORDER BY grantee;`);
await q('1c paper checks', `SELECT conname FROM pg_constraint WHERE conrelid='public.gc_trade_files'::regclass AND contype='c' ORDER BY 1;`);
await q('2 ask_change signatures', `SELECT p.oid::regprocedure::text FROM pg_proc p WHERE p.proname='gc_trade_ask_change';`);
await q('2 five functions grants', `SELECT f, has_function_privilege('authenticated', f, 'EXECUTE') AS client, has_function_privilege('service_role', f, 'EXECUTE') AS service FROM unnest(ARRAY['public.gc_trade_file_link(text)','public.gc_trade_file_tie(uuid, text, text, uuid)','public.gc_trade_ask_change(uuid, uuid, text, text, numeric, integer, text)','public.gc_trade_submit_quote(uuid, uuid, jsonb)','public.gc_trade_submittal_send(uuid, uuid, text, text, text)']) f;`);
await q('3 estimator reads none; rows zero', `BEGIN; ${asRole('estimator')} SELECT count(*) AS est_sees FROM gc_trade_files; ROLLBACK;`);
await q('3b dev count', `BEGIN; ${asRole('dev')} SELECT count(*) AS dev_sees FROM gc_trade_files; ROLLBACK;`);
