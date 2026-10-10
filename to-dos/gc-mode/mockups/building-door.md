---
name: "Building's door: Building opens to the job's team, its money to the money team, and /gc to the field"
rows: BUILDING_REAL_BUILD.md, decision 4 (who may read and write), The PRs in order, 9 (the door), the owner's calls 1 and 5; mockups/schedule-pr10.md (the shape, and "What Building's door adds"); mockups/schedule-pr9d.md, call 1 (the schedule team's read half); mockups/building-u8.md (the crew's counts and percents); mockups/door-owner-billing.md and O9 (20261010050000, the money team's reads)
branch: the plan on claude/gc-building-door-plan (from origin/spike/gc-mode at ecf57865b); the PRs from origin/main, after the schedule's PR 10 and the live walk
status: plan 2026-10-10 by gc 10 at the lead's ask, written with gc 4 (Building's holder), who co-signs. Nothing cut or claimed. It merges after the schedule's first live walk on prod, like PR 10. Co-signs owed beyond gc 4: the Board (gc 2) for calls 3 and 6, the Portal for call 5, Owner Billing (gc 5) for call 4.
---

# Building's door

## What it is

Building has been a dev's since U3a. Its fourteen tables are `is_dev()` only, and so are its windows on `/gc`.
The door opens them the way decision 4 of `BUILDING_REAL_BUILD.md` says:

- **The records** go to the job's team: the daily log (with its crews and delays), the punch list, submittals (with their
  holds and rounds), RFIs (with their holds) and the weekly report. The team is the schedule's,
  `gc_on_schedule_team(project_id)`: the GC office (dev, the leaders, the assistants, the controller and estimators), the
  job's project manager, and, added here, **the job's superintendent** (`project_superintendents`). They carry no money
  but an RFI answer's cost, which the whole team reads (the owner's call 1, its default).
- **The trades' money** goes to the money team for writing: the draws, their lines, a line's reports and a change sent to
  a trade. The money team (dev, the leaders, the controller) has read them since O9. A superintendent sees no draw.
- **The page opens to the field.** A superintendent cannot open `/gc` today. The door gives a superintendent `/gc`
  with their own building jobs only, and on each, Building's windows and the schedule.

**Two PRs** (call 1): **D1**, the tables, the functions and the office's gates, and **D2**, the field's page. D1 adds the
superintendent to the team's helper, so the policies are ready, but a superintendent sees nothing until D2 lets them
open the page.

## Who the team is

`gc_on_schedule_team(p_project_id)` comes with the schedule's PR 10 (#5231, not on main yet): the office and the job's
project manager. D1 replaces it once with the third arm PR 10's plan wrote for this door:

```sql
OR EXISTS (
  SELECT 1 FROM public.gc_projects g
  JOIN public.project_superintendents s ON s.project_id = g.project_id
  WHERE g.project_id = p_project_id AND s.superintendent_id = auth.uid() AND public.is_superintendent()
)
```

That is `can_access_project_row`'s own superintendent branch, assigned only. `gc_on_any_schedule_team()` takes the
same arm without the job. No schedule policy changes: the schedule's 23 tables open to the superintendent through the
helper.

**The project manager** is `gc_projects.project_manager_user_id`. Nothing writes it yet (PR 10's "Is this the best"
point 2), so the arm is ready and empty.

## D1: the tables

### The ten records' tables: `_dev` to `_team`

Each `<table>_dev` policy from `20261008030000_gc_building_records` goes, and a `<table>_team` policy takes its place, one
for every verb, `USING` and `WITH CHECK` alike, as PR 10's are.

| Carry their job | Reach it through their parent |
|---|---|
| `gc_daily_logs`, `gc_punch_items`, `gc_submittals`, `gc_rfis`, `gc_weekly_reports`: `gc_on_schedule_team(project_id)` | `gc_daily_log_crews`, `gc_daily_log_delays` through `gc_daily_log_project(log_id)`; `gc_submittal_holds`, `gc_submittal_rounds` through `gc_submittal_project(submittal_id)`; `gc_rfi_holds` through `gc_rfi_project(rfi_id)` |

The three lookups are `STABLE SECURITY DEFINER`, return the row's job and nothing more, as PR 10's two are.

### The four money tables: `_dev` to `_money`

`gc_draws`, `gc_draw_lines`, `gc_sow_line_reports` and `gc_change_order_trade_sends`: each `<table>_dev` goes, and a
`<table>_money` policy for every verb on `(SELECT public.gc_money_team())` takes its place. O9's `<table>_money_read`
goes with it, since the new policy reads too. The money team's audience is one place already (`gc_money_team()`), and
the draws carry no job column that a per-job team would need.

### What stays

- **The append-only rows** keep their missing privileges: `gc_weekly_reports` (no `UPDATE`, `DELETE`), `gc_punch_items`
  (no `DELETE`), `gc_sow_line_reports` (no `UPDATE`, `DELETE`). No policy can open them.
- **Training mode and twins**: the restrictive blocks stay. A `users.read_only` member reads and never writes. A twin is an
  estimator, so it reads the records, and the fence refuses its writes.
- **The trades and the customer** have no policy. They reach their slice through their portals' functions, run by the
  service role.
- **anon** has no grant on any of the fourteen.
- **The Board's `gc_sows` and `gc_sow_lines` and the Portal's `gc_back_charges`** keep O9's money read. Their writes
  are their lanes' doors, but for call 5.

## D1: the functions

Every Building press is `SECURITY INVOKER`, checks sign-in, training mode and a twin in words, and lets the policies
decide the rest. Swapping the policies is their gate too, with these exceptions:

1. **Presses that read another lane's table** (call 3).
   - `gc_save_daily_log`, `gc_add_punch_item` and `gc_punch_fixed_ask` read `gc_sows` to find a signed statement of
     work. A member outside the money team reads none, so a superintendent's log with a trade on it would be refused
     *A trade on this log has no signed statement of work.* They read it through a new `STABLE SECURITY DEFINER`
     `gc_package_sow_signed(p_package_id) RETURNS boolean` instead, which says yes or no and nothing of the price.
   - `gc_save_daily_log` keeps the trades' start promises through the Board's `gc_keep_promises`, which writes
     `gc_trade_promises`, an office table. A superintendent outside the office would have the whole save refused. It
     calls a new `SECURITY DEFINER` `gc_keep_log_promises(p_project_id, p_date, p_package_ids)` instead, which keeps only
     the start promises of the trades on that day's log, on that job.
   - gc 4 lists every press that reads `gc_sows` or writes `gc_trade_promises` before the cut, so none is missed.
2. **Functions that name the dev in their body.**
   - `gc_close_job`: *Closing a job is a dev's while Building is built.* becomes `gc_money_team()`, *Only the money team
     closes a job.* Closeout is the money team's window.
   - The Portal's `gc_back_charge`, `gc_keep_back_charge` and `gc_drop_back_charge` (call 5).
   - U8's `gc_crew_on_site`, if it is on main by then: `is_dev()` becomes `gc_on_schedule_team(p_project_id)`, the twin
     still refused. `gc_link_crew_job` stays the office's.
3. **Unchanged**: `gc_rfi_change_order` keeps its money-team check; its write of `gc_rfis` now passes the team policy.
   The trades' `gc_trade_*` functions run as the service role and change nothing.

## D1: the reads the schedule's team gains

- **Submittals and RFIs**: the team policies above (9d's call 1). The schedule's chart, Pull earlier and Days back read
  real holds for every member.
- **A company's papers** (call 6): `person_contract_documents` reads a person's paper for the pay roles. A company's
  paper (`company_id IS NOT NULL`) gains a `FOR SELECT` for `gc_on_any_schedule_team()`, so a controller's, an
  estimator's or a superintendent's chart reads a trade's papers as a dev's does.
- **Our crew** (U8): its percent reads `list_job_stage_progress`, which already admits superintendents and estimators.
  The page reads it for `canUseGcBuilding(role) || canSeeGcMoney(role)`, and `canUseGcBuilding` becomes the team.
  Its counts follow `gc_crew_on_site`'s new gate.

## D1: the client

- **`src/lib/gc/access.ts`**: `GC_BUILDING_TEAM` becomes `GC_SCHEDULE_TEAM` plus `superintendent`, and so does
  `GC_SCHEDULE_TEAM` (PR 10's note: it gains the superintendent with the page's gate). `canUseGcBuilding` reads it.
  `access.test.ts` pins both lists to `gc_on_schedule_team()`'s roles while `doors.ts` lists Building's records as
  `schedule`.
- **`src/pages/GcProjects.tsx`**: the six Building gates stay `canUseGcBuilding`. Draws and Closeout stay
  `canUseGcBuilding && canSeeGcMoney`, so the money team. The schedule's `canPull` becomes `canMove` (9d's call 1:
  every member reads the holds now).
- **`src/lib/gc/doors.ts`**: the ten records read door `schedule`, opens unset. The four money tables read door `money`,
  with no `reads`. `BUILDING_OPENS` and `BUILDING_MONEY_OPENS` go. `doors.test.ts`'s O9 test keeps the Board's and the
  Portal's three, and gains one in door 2's shape: the ten read `schedule`, the four read `money`.
- **The guides**: Building's guides' `roles: dev` become the team's roles, and their *Only devs … for now* sentence
  becomes *The office, estimators and the job's superintendent can open it.* Draws and Closeout guides become the money
  team's.

## D2: the field's page (call 2)

A superintendent opens `/gc` and sees their own jobs being built, and on each:

```
Fair Oaks Shops, Building D                       building · Mon Sep 14 to Tue Dec 8
[ Daily log · 1 missed ] [ Punch list ] [ Submittals ] [ RFIs ] [ Schedule ]
```

No Board, Trade partners, Follow up or Money, no New project, no Change orders, Draws, Closeout, Bill the customer or
Our number.

- **The route**: `layoutRouteAccess.ts` lets a superintendent reach `/gc`, as an estimator's path list does.
- **The reads**: the page's loaders read `gc_projects`, `gc_trade_packages`, `gc_scope_items`, `gc_invites`,
  `gc_companies` and more, all office tables whose rows carry money (a trade's budget, an ask's plugs, a statement of
  work's price). Opening them by policy would show a superintendent the money. So the field reads one function,
  `gc_field_rows()`, `STABLE SECURITY DEFINER`, which returns the same row shapes the loaders read, for the
  superintendent's own building jobs only, with every money column left out (null). The page feeds them to the same
  mapper (`boardStateFromRows`), so no second mapper exists.
- **The windows**: Building's and the schedule's windows read their own tables as before, through the team policies.
- **Field words**: the page's lede for a superintendent, *Your jobs being built.*

## The bed

`supabase/tests/gc_building/` (its script already a line in `scripts/sql-beds.txt`):

- **The estimator's refusals flip.** `20_daily_log`, `40_submittals`, `50_rfis`, `60_draws`, `70_closeout` and
  `80_punch` refuse an estimator *outside Building's dev door*. After D1 an estimator is on the team. Each outsider
  case becomes a subcontractor, with the same refusal, and each gains an estimator case that passes (or, on draws and
  closeout, a refusal in the money team's words).
- **A new `90_door.sql`**, after them, the migration applied a second time first:
  1. An estimator writes a log, adds a punch item and records an RFI on P.
  2. The job's superintendent (a `project_superintendents` row on P) writes a log with a trade on it (the signed check
     through `gc_package_sow_signed`, the promise kept through `gc_keep_log_promises`), adds a punch item, reads P's
     submittals and RFIs, reads P's schedule bars, and reads 0 draws.
  3. A superintendent on Q only reads 0 of P's rows on each of the ten, and its log on P is refused.
  4. The project manager (named on P) reads P's records.
  5. The controller approves and pays a draw on P. An estimator reads 0 draws and its approval is refused.
  6. A training-mode assistant reads P's logs; its log is refused in training words. A twin estimator reads; its write is
     refused by the fence.
  7. Append-only: an `UPDATE` of `gc_weekly_reports`, a `DELETE` of `gc_punch_items` and an `UPDATE` of
     `gc_sow_line_reports` are refused *permission denied*.
  8. A company's paper reads for the superintendent on P; a person's paper does not.
  9. anon gets *permission denied* on `gc_daily_logs`.
- **The schedule's bed** (`gc_schedule/30_team_door.sql`, PR 10's): its case 5, the superintendent reading 0, flips to
  reading P's bars. The schedule lane edits that one case in D1.
- **O9's bed** (`gc_owner_billing/92_money_reads.sql`): the controller's approval is no longer refused. Its §4 becomes
  "the controller approves", and the estimator's refusal stays.

## Verify after the push

As PR 10's, through `to-dos/gc-mode/scripts/verify/`, each step in `BEGIN … ROLLBACK`: the catalog (one `_team` or
`_money` policy a table, no `_dev`, the lookups `prosecdef`), reads per role (a sample estimator, assistant, controller
and superintendent; a primary and a subcontractor read 0), a write rolled back (a sample superintendent's daily log on
"GC test project, delete me" once a superintendent is assigned there), and the page through **View as…** after the
client is on Pages.

## Docs each PR touches

- D1: `docs/migrations/<stamp>_gc_building_door.md` (what it opens, what stays, the bed's matrix, the verify steps, the
  rollback that re-creates the `_dev` policies); `docs/ACCESS_CONTROL.md`'s GC door line, amended where it says
  Building's tables stay dev only; `PROJECT_DOCUMENTATION.md`'s Building windows; `GLOSSARY.md` (*the job's team*);
  the guides; the release note and fragment.
- D2: `docs/ACCESS_CONTROL.md` (the superintendent's `/gc`), `docs/twins/APP_DIRECTORY.md` if the field view counts as a
  page of its own (it does not: it is `/gc`), the guide *see your GC jobs as a superintendent*, the release note and
  fragment.

## The calls

1. **Two PRs, D1 then D2.** D1 is the tables, the functions, the office's gates and the beds. D2 is the field's page.
   D1 alone opens Building to the office team and the project manager. **My pick: two**, so the policies land and are
   verified before the page that shows a superintendent anything.
2. **What a superintendent sees on `/gc`**: their own building jobs, Building's windows and the schedule, and nothing of
   the Board or the money. The reads through `gc_field_rows()`, not wider policies on the New project and Board tables,
   whose rows carry money. **My pick: the function.** The owner's word on what a superintendent sees is owed before D2.
3. **The cross-lane reads in Building's presses**: `gc_package_sow_signed` and `gc_keep_log_promises`, both `SECURITY
   DEFINER`, so `gc_sows` stays the Board's and `gc_trade_promises` the office's. **My pick: both.** The Board co-signs.
4. **The weekly report's email to the customer** (gc 5's question): `gc-customer-email`'s weekly kind reads the report
   as the caller, so after D1 a superintendent could email the customer. **My pick:** the weekly kind also needs
   `gc_office_team()` or the job's project manager. A superintendent writes the report; the office sends it. Owner Billing
   (gc 5) co-signs, and the owner may say otherwise.
5. **Back-charges in Draws**: the Portal's `gc_back_charge`, `gc_keep_back_charge` and `gc_drop_back_charge` refuse
   anyone but a dev in their body, and `gc_back_charges` writes are a dev's. Draws opens to the money team, so a
   controller's charge would fail. **My pick:** D1 moves those three to `gc_money_team()` with the training and twin
   checks the Building presses have, and `gc_back_charges` writes to the money team. The Portal co-signs.
6. **A company's papers for the schedule's team** (9d's call 1): a `FOR SELECT` on `person_contract_documents` for
   company rows only, for `gc_on_any_schedule_team()`. A person's paper stays the pay roles'. **My pick: yes.** The Board
   co-signs, since B6-b keys those rows.
7. **An RFI answer's cost**: the whole team, superintendents included (Building's call 1, its default). Unchanged.
8. **The architect's email from a superintendent**: `gc-architect-email` reads the submittal or RFI as the caller, so after
   D1 the team sends to the architect. **Default: yes**, since an RFI is the superintendent's.

## Is this the best we can do?

- **One audience, read once a statement.** Every records policy calls `gc_on_schedule_team` per row, as PR 10's do, and
  the child tables add a lookup. A log with ten crews makes ten calls. That is milliseconds today. A policy of
  `(SELECT gc_office_team()) OR gc_on_schedule_team(project_id)` would skip the per-row work for the office, at the cost
  of naming the audience twice. Not taken, as PR 10 did not.
- **The field's read as its own door.** `gc_field_rows()` is a second read path beside the loaders. Column privileges
  (revoking the money columns from a field role) would let the policies do it, but Postgres grants columns to roles,
  not to rows' readers, and every office reader would need the grant back. The function is the smaller thing.
- **The project manager has no picker.** The arm reads a column nothing writes. New project's form or the Board's Get
  started is its place. Until then the door opens to the office and the superintendents.

## Status

Plan 2026-10-10 by gc 10 with gc 4. Not cut, not claimed. It waits on gc 4's co-sign, the lead's read of the calls, the
co-signs named above, and the owner's word on call 2. It cuts after the schedule's PR 10 is on main and the first live
walk is done.
