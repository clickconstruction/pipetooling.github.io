import { q, asRole } from './verify-lib.mjs';
await q('1 columns', `SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='gc_change_orders_office';`);
await q('1 reloptions', `SELECT reloptions::text FROM pg_class WHERE oid='public.gc_change_orders_office'::regclass;`);
await q('1 grants', `SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='gc_change_orders_office' GROUP BY grantee ORDER BY grantee;`);
await q('2 counts as dev', `BEGIN; ${asRole('dev')} SELECT (SELECT count(*) FROM gc_change_orders_office) AS office, (SELECT count(*) FROM gc_change_orders) AS base; ROLLBACK;`);
