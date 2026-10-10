import { q, asRole } from './verify-lib.mjs';
await q('1 function settings', `SELECT prosecdef, provolatile, proconfig::text, pg_get_function_result(oid) AS result FROM pg_proc WHERE oid='public.gc_company_paper_states(uuid[])'::regprocedure;`);
await q('1 grants', `SELECT has_function_privilege('anon','public.gc_company_paper_states(uuid[])','EXECUTE') AS anon, has_function_privilege('authenticated','public.gc_company_paper_states(uuid[])','EXECUTE') AS authed;`);
await q('2 controller count', `BEGIN; ${asRole('controller')} SELECT count(*) AS controller_sees FROM public.gc_company_paper_states(); ROLLBACK;`);
await q('2 expected count', `SELECT count(*) AS company_papers FROM public.person_contract_documents WHERE company_id IS NOT NULL AND doc_type IN ('agreement','w9','coi');`);
await q('3 subcontractor count', `BEGIN; ${asRole('subcontractor')} SELECT count(*) AS sub_sees FROM public.gc_company_paper_states(); ROLLBACK;`);
await q('3b estimator count', `BEGIN; ${asRole('estimator')} SELECT count(*) AS est_sees FROM public.gc_company_paper_states(); ROLLBACK;`);
