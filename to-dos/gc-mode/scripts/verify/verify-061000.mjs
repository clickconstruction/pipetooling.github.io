import { q, asRole, P } from './verify-lib.mjs'
const BID = 'c4117b0d-0c64-4935-933f-01bd96bfef60'
await q('1 the function and its grants (expect anon false, signed-in true)', `SELECT has_function_privilege('anon', 'public.gc_start_project(uuid, jsonb)', 'EXECUTE') AS anon_runs, has_function_privilege('authenticated', 'public.gc_start_project(uuid, jsonb)', 'EXECUTE') AS signed_in_runs;`)
await q('2 as a dev, the building test project already started (expect the refusal; rolled back)', `BEGIN; ${asRole('dev')} SELECT public.gc_start_project('${P}'); ROLLBACK;`)
await q('3a the bidding test project stage before (read)', `SELECT stage, started_anyway_by FROM public.gc_projects WHERE project_id = '${BID}';`)
await q('3b as a dev, won here then started today (expect true; building, null; rolled back)', `BEGIN; ${asRole('dev')} SELECT CASE WHEN (SELECT stage FROM public.gc_projects WHERE project_id = '${BID}') = 'buyout' THEN NULL ELSE public.gc_mark_won('${BID}') END AS won; SELECT public.gc_start_project('${BID}') = public.app_today() AS started_today; SELECT stage, started_anyway_by FROM public.gc_projects WHERE project_id = '${BID}'; ROLLBACK;`)
await q('3c the bidding test project stage after the rollback (expect unchanged)', `SELECT stage FROM public.gc_projects WHERE project_id = '${BID}';`)
