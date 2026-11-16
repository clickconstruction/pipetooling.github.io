# 20261116070000_scores_reads_as_service_role.sql (2026-11-15, v2.7365)

Team scorecard, PR 4 (punch list #360): two reads the team scores make, answered to the service role.

The Scores tab's reads move to the edge function `team-scores`, which makes them as the service role. Two functions those reads call decide what to return from `auth.uid()`, and the service role has none:

- **`list_people_pay_flags()`** returned no rows, so a closed job's team labor would have read every salaried person as hourly (`utils/teamLabor.ts` builds its wage map from these rows).
- **`get_invoice_amounts_for_jobs(p_job_ids)`** returned no job, so a job's supply-house total would have read $0.

Each gains the branch `list_tally_parts_with_po()` already has for the Bridge's weekly sheet: `auth.role() = 'service_role' AND auth.uid() IS NULL`. Nothing else in either body changes. Both are `CREATE OR REPLACE` over the definitions on prod on 2026-11-15, read back with `pg_get_functiondef` before the file was written, so no clause another migration added is dropped. The service role already reads both tables past RLS, so this opens nothing, and a signed-in caller is answered as before.

**Apply order**: push right after the merge and **before** `supabase functions deploy team-scores`. Until the function is deployed the Scores tab reads in the browser as it did, so the push changes nothing anyone sees. No table, no types change.

**Applied** to prod by 2026-11-16: `npm run check:migration-drift` read 1326 local files against 1326 applied, this version among them (run in the docs pass after #8111); `database.ts` on `main` carries `get_invoice_amounts_for_jobs`, `list_people_pay_flags`.
