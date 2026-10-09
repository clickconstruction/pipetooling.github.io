import { q, ASK, asRole } from './verify-lib.mjs'
const dev = asRole('dev'); const askPkg = `SELECT package_id FROM public.gc_invites WHERE id='${ASK}'`
await q('3 the flow, awarded inside the transaction, rolled back', `BEGIN; ${dev}
SELECT public.gc_award('${ASK}') AS sow;
CREATE TEMP TABLE s AS SELECT public.gc_add_submittal(jsonb_build_object('packageId', (${askPkg})::text, 'title', 'Verify, delete me', 'kind', 'product data', 'specSection', '03 30 00', 'lineIds', jsonb_build_array((SELECT id FROM public.gc_scope_items WHERE package_id = (${askPkg}) LIMIT 1)::text))) AS id;
CREATE TEMP TABLE r AS SELECT (SELECT number FROM public.gc_submittals WHERE id = (SELECT id FROM s)) AS number, (SELECT count(*) FROM public.gc_submittal_holds h WHERE h.submittal_id = (SELECT id FROM s)) AS holds, public.gc_submittal_move((SELECT id FROM s)) AS move0;
SELECT public.gc_submittal_came_in(jsonb_build_object('submittalId', (SELECT id FROM s)::text, 'file', 'verify.pdf', 'driveUrl', 'https://drive.google.com/x', 'note', '')) AS round1;
ALTER TABLE r ADD COLUMN move1 text; UPDATE r SET move1 = public.gc_submittal_move((SELECT id FROM s));
SELECT public.gc_send_submittal_to_architect((SELECT id FROM s)) AS sent;
ALTER TABLE r ADD COLUMN move2 text; UPDATE r SET move2 = public.gc_submittal_move((SELECT id FROM s));
SELECT public.gc_answer_submittal((SELECT id FROM s), 'revise', 'Verify, delete me') AS answered;
ALTER TABLE r ADD COLUMN move3 text; UPDATE r SET move3 = public.gc_submittal_move((SELECT id FROM s));
SELECT r.*, (SELECT count(*) FROM public.gc_submittal_rounds x WHERE x.submittal_id = (SELECT id FROM s)) AS rounds FROM r;
ROLLBACK;`)
await q('after: nothing kept', `SELECT (SELECT count(*) FROM public.gc_submittals) AS submittals, (SELECT count(*) FROM public.gc_sows) AS sows;`)
