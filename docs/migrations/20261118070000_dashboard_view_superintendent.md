# 20261118070000_dashboard_view_superintendent.sql (2026-11-18, the Dashboard view opens to a superintendent, punch list #384 PR 1)

Job Mode, short (v2.7749): the per-person Short setting from the leader's short Dashboard is opened to a superintendent, so the office can set one superintendent to Short and nobody else's page changes. One function is restated, from its definition in [`20261117030000_dashboard_view.sql`](20261117030000_dashboard_view.md). Nothing else is touched.

- **`set_dashboard_view(p_user_id, p_view)`** (SECURITY DEFINER, `search_path` public, `CREATE OR REPLACE`), two changes:
  - **A superintendent's account takes a view.** The target's role is now `master_technician`, `dev` or `superintendent`. Any other role's account is refused: *A Dashboard view is for a leader's or a superintendent's account.*
  - **A person sets his own row.** The caller is the office (`is_master_or_dev()` or `is_assistant()`, as before) or the person himself (`p_user_id = auth.uid()`). Anyone else, and nobody signed in, is refused: *Only the office sets another person's Dashboard view.* A missing `p_user_id` is never the caller's own row.
- Unchanged: a training account or a twin is refused in words on any row, its own included. `p_view` must be `short` or `full`. An unknown id is named. EXECUTE for `authenticated`, revoked from `PUBLIC` and `anon`.
- The column `users.dashboard_view`, its check and its reads are as they were. No row is written here, so every account reads as it read before.

The client's rule is `canSetDashboardView` and `DASHBOARD_VIEW_ROLES` in `src/lib/dashboard/shortDashboard.ts`. The two hold the same three roles, so a change to one is a change to both.

No table is made, so no fence call.

**Bed**: `scripts/pgtest-dashboard-view.sh` (`npm run test:pg:dashboard-view`, `supabase/tests/dashboard_view/`) applies the whole schema, re-applies this file, and runs the press as the assistant, the leader, a superintendent, an estimator, a sub, a training account, a twin and nobody. It checks each refusal's words and that a refused press leaves the row as it was.

Apply order: the client in the same PR calls nothing new. Until the push, the office's press on a superintendent's desk and a superintendent's own press in Settings are refused in the old words, and nothing else differs. Push after the merge.

**Applied** to prod on 2026-11-18, right after #8677 merged at 09:11Z: `bash scripts/db-push.sh` from a checkout at `origin/main` pushed this one file and nothing else. `npm run check:migration-drift` is level at 1,365, and the type generator's output did not change, since the function's signature is the same. Walked the same hour on the sample superintendent's account: the dev pressed **Short** on his People desk and the row read `short`, then he pressed **Full** for himself in Settings and the row read `full`. The SQL bed's first run was CI's, where it passed.
