# 20261009050000_gc_owner_billing_money_team.sql (2026-10-09, v2.4943)

GC mode, the Owner Billing door. The plan is `to-dos/gc-mode/mockups/door-owner-billing.md` on branch `spike/gc-mode`, approved 2026-10-08 at its four defaults, and the SQL is the mockup's byte for byte. Helper 6 agreed the guard on door 1's `gc_projects`. It lands after door 2 (v2.4937).

It opens change orders, **Money**, and Bill the customer when it lands, to the money team: `gc_money_team()` (dev, the leaders and the controller), the audience the Board's B5-a named once. Nothing of it opens to assistants or estimators (Owner Billing's decision 2). It creates no table, and it is idempotent.

## What it does

1. **O1's seven tables swap `_dev` for `_money`:** `gc_owner_contract_lines`, `gc_change_orders`, `gc_owner_pay_apps`, `gc_owner_pay_app_lines`, `gc_owner_pay_reminders`, `gc_owner_interest_bills` and `gc_owner_acceptances`.
   - Each gets one `<table>_money` policy, every verb, on `(SELECT public.gc_money_team())`.
   - Every Owner Billing function is `SECURITY INVOKER` (`gc_sign_owner_contract`, `gc_draft_change_order`, `gc_draft_time_extension`, `gc_send_change_order`, `gc_answer_change_order`), so the policies are their gate.
   - `anon` has no grant (O1). A sent pay application, its lines, reminders and interest bills keep no UPDATE or DELETE privilege beyond O1's two doors.
2. **`gc_projects_owner_terms_guard`** (BEFORE UPDATE on `gc_projects`) refuses, in words, a change to our terms with the customer by anyone outside the money team.
   - The terms are O1's nine columns: the signed day, the retainage and its step's three, late interest, the late finish, the days to pay and the billing job.
   - The rest of the row stays door 1's, for the office team.
   - The service role passes (`auth.uid()` is null), which `gc-drive-access` needs when it writes `drive_folder_url`.
   - It never names `general_conditions`, `contingency_pct` or `fee_pct`. B6-a drops them, and a trigger naming a dropped column would fail every update on the row.

## Checked before the push: the role matrix

This ran on a local Postgres 15, with Helper 2's B5-a harness (`b5matrix.mjs`) turned for the money team:
- the real training-mode and twin blocks, loaded from their own migrations;
- the GC chain: New project's tables, the schedule's, O1, B1, O3 and B5-a;
- door 1's team policy on `gc_projects` and `gc_trade_packages`;
- this migration applied twice;
- one user per role, each as `authenticated`, each row in a transaction rolled back.

Its own checks said:
- each of the seven tables carries its `_money` policy and no `_dev`;
- the five functions read invoker;
- the guard trigger is there, enabled.

| Who | Reads change orders | gc_draft_change_order | Reads pay applications | gc_sign_owner_contract | Updates owner_retainage_pct | Updates size_note (door 1) |
|---|---|---|---|---|---|---|
| dev | 1 rows | wrote | 1 rows | wrote | wrote | wrote |
| master_technician | 1 rows | wrote | 1 rows | wrote | wrote | wrote |
| controller | 1 rows | wrote | 1 rows | wrote | wrote | wrote |
| assistant | 0 rows | refused by the policy | 0 rows | refused by the policy | refused: Our terms with the customer are for the owner, the leaders and the controller to change. | wrote |
| estimator | 0 rows | refused by the policy | 0 rows | refused by the policy | refused: Our terms with the customer are for the owner, the leaders and the controller to change. | wrote |
| superintendent | 0 rows | refused: That GC project is not there. | 0 rows | refused: That GC project is not there. | no row | no row |
| primary | 0 rows | refused: That GC project is not there. | 0 rows | refused: That GC project is not there. | no row | no row |
| subcontractor | 0 rows | refused: That GC project is not there. | 0 rows | refused: That GC project is not there. | no row | no row |
| helpers | 0 rows | refused: That GC project is not there. | 0 rows | refused: That GC project is not there. | no row | no row |
| controller (training mode) | 1 rows | refused: That GC project is not there. | 1 rows | refused: That GC project is not there. | refused: Read-only (training) mode: changes are blocked. | refused: Read-only (training) mode: changes are blocked. |
| estimator (training mode) | 0 rows | refused: That GC project is not there. | 0 rows | refused: That GC project is not there. | refused: Read-only (training) mode: changes are blocked. | refused: Read-only (training) mode: changes are blocked. |
| estimator (digital twin) | 0 rows | refused: That GC project is not there. | 0 rows | refused: That GC project is not there. | no row | no row |

What the columns show:
- **`gc_draft_change_order` and `gc_sign_owner_contract`**, for a role outside the office team, say *That GC project is not there.*: the function cannot see the project under door 1's policy. A training account is refused the same way, because its training-mode block keeps it from locking the row. Either way the refusal is the function's own.
- **`owner_retainage_pct`** is refused in the guard's words for the assistant and the estimator. They still write door 1's `size_note`, so the guard compares column by column.

## Verify after the push

1. **The catalog.**
   - Each of the seven tables has one `<table>_money` policy reading `( SELECT gc_money_team() AS gc_money_team)`, and no `_dev`.
   - The five functions read `prosecdef` false.
   - `gc_projects_owner_terms_guard` is on `gc_projects`, enabled.
2. **Reads per role, rolled back** (the claim set before `SET LOCAL ROLE`): `gc_change_orders` on the test project reads 1 row as a controller and 0 as an estimator.
3. **Writes per role, rolled back:**
   - a controller's `gc_draft_change_order` on the test project returns an id;
   - an estimator's is refused;
   - an estimator's `UPDATE gc_projects SET owner_retainage_pct = 5 WHERE project_id = '<test project>'` is refused in the guard's words, and their `size_note` update goes through. (`gc_projects` is keyed by `project_id`, not `id`.)
4. **The page**, a dev through **View as…**:
   - *Sample controller:* `/gc` shows **Money**, and the test project's card shows **Change orders · 1**.
   - *Sample estimator:* neither, and `/gc?changes=<test project>` opens nothing.

## Rollback

A one-off migration that re-creates the seven `_dev` policies as `20261008010000` wrote them, drops the seven `_money` ones, and drops the guard trigger and its function. The client's gates then read the money team over dev-only tables, so they show empty until the client goes back too.

## Status

Written 2026-10-09 for the Owner Billing door (v2.4943, clickconstruction/pipetooling.github.io#4986).

Applied to prod about 15:10 UTC 2026-10-09 by the lead, with `supabase db push` from a clean checkout of main (`npm run check:migration-drift`: 798 local, 798 remote). Regenerating the types and the dev-mcp catalog changed nothing, so there is no types PR. Every write ran in a transaction that rolled back. What the verify steps said:

- **Step 1.** The seven tables each carry one `<table>_money` policy with one qual and no `_dev`, and `anon` has no privilege on them. The five functions read invoker. The guard is enabled.
- **Step 2.** On the test project, a controller and a leader each read 1 change order, and an estimator read 0.
- **Step 3.**
  - A controller's `gc_draft_change_order` returned an id.
  - An estimator's was refused by the policy.
  - An estimator's `owner_retainage_pct` update was refused in the guard's words, and their `size_note` update wrote.
  - A controller's `owner_retainage_pct` update wrote.
- **Step 4**, through **View as** on main's build:
  - *Sample controller:* sees **Money**, whose lens draws bill day Oct 25 at $36 from the signed change order, and **Change orders · 1** on the test project.
  - *Sample estimator:* sees three pills, no **Change orders**, and `/gc?changes=<test project>` opens nothing.

