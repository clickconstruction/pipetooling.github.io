import { q, asRole } from './verify-lib.mjs';
await q('1 policies', `SELECT policyname, permissive, cmd FROM pg_policies WHERE tablename='gc_customer_contacts' ORDER BY 1;`);
await q('1 table grants to authenticated', `SELECT string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs FROM information_schema.role_table_grants WHERE table_name='gc_customer_contacts' AND grantee='authenticated' AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE');`);
await q('1 INSERT columns', `SELECT string_agg(column_name, ',' ORDER BY column_name) AS cols FROM information_schema.column_privileges WHERE table_name='gc_customer_contacts' AND grantee='authenticated' AND privilege_type='INSERT';`);
await q('1 anon grants', `SELECT count(*) AS anon_grants FROM information_schema.role_table_grants WHERE table_name='gc_customer_contacts' AND grantee='anon';`);
await q('2 estimator reads', `BEGIN; ${asRole('estimator')} SELECT count(*) AS est_sees FROM public.gc_customer_contacts; ROLLBACK;`);
