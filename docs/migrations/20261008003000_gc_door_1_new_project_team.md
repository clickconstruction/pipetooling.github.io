# 20261008003000_gc_door_1_new_project_team

**Version:** v2.4832 · **Date:** 2026-10-07 · **Plan:** `to-dos/gc-mode/mockups/door-1-new-project.md` on `spike/gc-mode` (GC mode, door 1).

## What it adds

- `gc_office_team() RETURNS boolean`, `STABLE SECURITY DEFINER`: who is on GC mode's office team, named once. Today `is_office_or_estimator()`: dev, the leaders, the assistants, the controller and estimators. `EXECUTE` to `authenticated` and `service_role` only. The client's copy is `canOpenGcProjects` (`src/lib/gc/access.ts`); the audience lives in those two places.
- The twelve New project tables (`gc_projects`, `gc_trade_packages`, `gc_scope_items`, `gc_scope_exclusions`, the four scope book tables, `gc_plan_sets`, `gc_plan_set_items`, `gc_plan_questions`, `gc_plan_set_sends`) drop their `<table>_dev` policy (`is_dev()`) for one `<table>_team` policy, `FOR ALL TO authenticated USING ((SELECT gc_office_team())) WITH CHECK (…)`, and `anon` loses its grants on them.
- `projects`: a second permissive SELECT policy, *GC team sees GC projects*, `gc_office_team()` and a `gc_projects` row for it. The office already read every project; an estimator read none, because a GC project's `master_user_id` is null and `can_access_project_row` answers false for that.
- `gc_create_project` re-created as `20261007030000` made it with three changes:
  - `SECURITY DEFINER`, because it also writes `customers` and `projects`, whose own rules let only a dev or a leader name someone new (the `customers_master_role_check` trigger refuses the caller's own id), and no estimator write the `projects` row;
  - its own gate, in words: *GC projects are for the office and estimators.*, *A training account cannot make a project.*, *A digital twin cannot make a GC project.* (all `42501`), since the owner skips the read-only restrictive policies and the twin fence (the read-only statement triggers still fire);
  - a customer, architect or property owner named for the first time is filed under `company_owner_user_id()`, as every new customer is since one company (v2.2967), with a refusal in words when Settings names no company owner.

`gc_issue_plan_set`, `gc_record_question`, `gc_answer_question` and `gc_questions_close_on` are `SECURITY INVOKER` and write only the twelve tables, so the new policies are their gate; they are not touched. The schedule's tables (`gc_schedule_*`) stay dev only until the schedule's PR 10.

## Push it in the evening batch

`CREATE POLICY` on `projects` takes that table's exclusive lock for an instant, and `projects` is read all day. A long read on it makes the 3-second `lock_timeout` fail the push; push it with the evening batch and retry if it does. The twelve GC tables are quiet.

## Verify after the push

1. **The catalog, read only.** Each of the twelve tables has exactly one policy, `<table>_team`, `FOR ALL TO authenticated`, both expressions `(SELECT gc_office_team() AS gc_office_team)`, and no `<table>_dev`. `has_table_privilege('anon', …)` is false for all twelve. `projects` has *GC team sees GC projects* and its other policies unchanged (ten on prod). `gc_create_project`: `prosecdef` true, `proconfig` `{search_path=public}`, no `PUBLIC` or `anon` in `proacl`, one `jsonb` argument. The other four RPCs: `prosecdef` still false. `gc_office_team()` executable by `authenticated`, not by `anon`.
2. **An estimator and an assistant make a project, rolled back.** `BEGIN; SET LOCAL ROLE authenticated;` with `request.jwt.claims` naming an active estimator; `gc_create_project` with a new customer and a new architect (*Door 1 check, delete me*), one trade and one sheet. It returns an id; both new customers carry `company_owner_user_id()` as master; the estimator reads the project back from `projects`, `gc_projects` and `gc_plan_sets`. `ROLLBACK`. The same as an assistant. A rolled-back call uses one `project_number`; the gap is harmless.
3. **Who is refused, rolled back.** A training account: *A training account cannot make a project.*, and its insert into `gc_scope_sets` is refused by the read-only blocks. A digital twin: *A digital twin cannot make a GC project.*, and its insert into `gc_scope_sets` is refused by the fence. A primary and a superintendent: `gc_projects` reads no rows, and `gc_create_project` says *GC projects are for the office and estimators.*
4. **The page, as an estimator.** Gear → **View as…** → the sample estimator. Bids shows the **Trades | GC** switch; **GC** opens `/gc` with the test project, its two sets, its trades and the recorded question; **The plans**, **Questions about the plans** and **Open the scope book** open. Save nothing: a sample's writes are real rows. As the sample primary: no switch, and `/gc` lands on the Dashboard.
5. **The functions, after they are deployed.** As the sample estimator, **Check again** on the test project's set answers (*only some people can open it*). A bare POST to `gc-plan-question-email` says *Sign in first.* The email itself waits on step 8b and the owner's yes.

## Rollback

A one-off migration: drop the twelve `_team` policies and re-create the `_dev` ones (`public.is_dev()`, as `20261006233000` and `20261006234000` wrote them); drop *GC team sees GC projects*; restore `gc_create_project` from `20261007030000`. `gc_office_team()` can stay, unused.

## Applied

With `supabase db push` after the PR merged (#4852, v2.4832), in the evening batch of 2026-10-07 by the lead session; migration drift 782 of 782. `gc-plan-question-email` and `gc-drive-access` redeployed the same evening. Types: #4876.

## Status

Verified 2026-10-07, the evening of the push.

1. **The catalog** (the lead, through the management API's query endpoint, read only): each of the twelve tables reads one `_team` policy and no `_dev`, both expressions `( SELECT gc_office_team() AS gc_office_team)`; `anon` has no SELECT on them. `projects` has *GC team sees GC projects* beside its ten others. `gc_create_project` reads `prosecdef` true and is not executable by `anon`; the other four RPCs read `prosecdef` false. `gc_office_team()` is executable by `authenticated`, not by `anon`. **Passed.**
2. **An estimator and an assistant make a project, rolled back:** **not run.** The app has no rolled-back path, so from the app it would be a real project on prod. It waits on call 13 (the test rows) and the first real project. Step 4 showed the read half for the sample estimator.
3. **Who is refused** (the lead, rolled back): a training-mode user calling `gc_create_project` got *A training account cannot make a project.* **Passed.** The twin's and the primary's refusals were not run separately: the twin is covered by the gate's own line and the fence, and the primary by step 4.
4. **The page** (Helper 6, the app on main at 9983e258f, a dev imitating through View as):
   - *Sample estimator*: Bids shows the **Trades | GC** switch, with Trades pressed. **GC** opens `/gc`, which lists *GC test project, delete me* with its 2 sets (newest *Permit set, delete me*), 7 sheets, 3 sections, its trades and *Questions about the plans · 1 open*. The project's name reads from its `projects` row, which is the new policy at work. **The plans**, **Questions about the plans** and **Open the scope book** each open on the project's data and close with Esc; nothing was saved.
   - *Sample primary*: Bids shows no switch, and `/gc` lands on the Dashboard.

   **Passed.**
5. **The functions** (Helper 6, after the redeploy):
   - As the sample estimator, **Check again** on the newest set called `gc-drive-access`, which answered 200 with `{"success":true,"access":"restricted","seen":true,"checked_on":"2026-10-07","recorded":true}`. The card still reads *Only some people can open it*, as it should.
   - A bare `POST` to `gc-plan-question-email` with no token answered `401 {"error":"Sign in first."}`.
   - The question's email itself waits on step 8b and the owner's yes.

   **Passed.**
