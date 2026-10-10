---
name: "Building's door: Building opens to the job's team, its money to the money team, and /gc to the field"
rows: BUILDING_REAL_BUILD.md, decision 4 (who may read and write), The PRs in order, 9 (the door), the owner's calls 1 and 5; mockups/schedule-pr10.md (the shape, and "What Building's door adds"); mockups/schedule-pr9d.md, call 1 (the schedule team's read half); mockups/building-u8.md (the crew's counts and percents); mockups/door-owner-billing.md and O9 (20261010050000, the money team's reads)
branch: the plan on claude/gc-building-door-plan (from origin/spike/gc-mode at ecf57865b); the PRs from origin/main, after the schedule's PR 10 and the live walk
status: plan 2026-10-10 by gc 10 at the lead's ask, written with gc 4 (Building's holder), who co-signs. The lead approved its shape the same day (D1 then D2; calls 3, 4, 7 and 8 at their picks). Amendment 1 the same day: the Board's (gc 2) co-sign on call 3 with its gates, and call 6 reshaped to a function; the Portal's (gc 3) co-sign on call 5 with its notes. Nothing cut or claimed. It merges after the schedule's first live walk on prod, like PR 10. Amendment 2 the same day: gc 4's co-sign with its scan (four presses read gc_sows; three keep promises; the presses and the schedule's writes read the office's job tables), the job's reads as definer functions (call 9), one promise keeper for Building's three kinds, gc_link_crew_job's one-crew-a-job refusal (call 11, gc 4's amendment 3), and call 4's client half. The lead approved calls 9 and 11 the same day. Amendment 3 the same day: call 9's columns, from gc 4's scan of Building's presses and gc 10's of the schedule's writes; PR 10's Status and #5231's body record the project manager gap. The Board co-signed call 9's trades (gc 2) with three conditions, in amendment 3, and New project's three column lists for it while gc 6 is down (gc 2, the lead's ask). Amendment 4 the same day: call 12, the trades' percents and the change orders for the job's team, from the schedule's PR 16 seams (gc 4's `mockups/schedule-pr16.md`, co-signed by gc 10). The lead approved call 12 the same day. Amendment 5 the same day: Owner Billing's (gc 5) co-sign on the view's widening, with its condition, no drafts outside the office. Amendment 6, 2026-10-10: the owner's word on call 2, through the lead: a superintendent who opens /gc sees Building only, the jobs being built with the schedule, the punch list, submittals, questions and the daily log, and no bidding, no prices, no bills. D2 already drew that. Every call is answered. It cuts after PR 10 and the live walk.
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

### The money tables: `_dev` to `_money`

`gc_draws`, `gc_draw_lines`, `gc_sow_line_reports` and `gc_change_order_trade_sends`: each `<table>_dev` goes, and a
`<table>_money` policy for every verb on `(SELECT public.gc_money_team())` takes its place. O9's `<table>_money_read`
goes with it, since the new policy reads too. The money team's audience is one place already (`gc_money_team()`), and
the draws carry no job column that a per-job team would need.

**The Portal's `gc_back_charges`** goes the same way (call 5, the Portal's notes): only its two permissive policies go,
`gc_back_charges_dev` and `gc_back_charges_money_read`, and `gc_back_charges_money` (`FOR ALL`, `gc_money_team()`)
takes their place. Its restrictive training and twin fences stay; the migration re-runs the three `apply_*` calls. The
money team then has the plain writes a dev has today on P4a's granted columns (insert on the eight, update on `status`
and `settled_*`, and U6a's `taken_*`), and the table's CHECKs still hold the states: the migration doc says so in a
sentence. The trade answers only through `gc_trade_answer_back_charge`. `gc_trade_change_requests` is untouched.

### What stays

- **The append-only rows** keep their missing privileges: `gc_weekly_reports` (no `UPDATE`, `DELETE`), `gc_punch_items`
  (no `DELETE`), `gc_sow_line_reports` (no `UPDATE`, `DELETE`). No policy can open them.
- **Training mode and twins**: the restrictive blocks stay. A `users.read_only` member reads and never writes. A twin is an
  estimator, so it reads the records, and the fence refuses its writes.
- **The trades and the customer** have no policy. They reach their slice through their portals' functions, run by the
  service role.
- **anon** has no grant on any of the fourteen.
- **The Board's `gc_sows` and `gc_sow_lines`** keep O9's money read. Their writes are the Board's award door.

## D1: the functions

Every Building press is `SECURITY INVOKER`, checks sign-in, training mode and a twin in words, and lets the policies
decide the rest. Swapping the policies is their gate too, with these exceptions:

1. **Presses that read another lane's table** (call 3).
   - `gc_save_daily_log`, `gc_add_punch_item`, `gc_punch_fixed_ask` and `gc_punch_fixed_in` read `gc_sows` to find a
     signed statement of work (gc 4's scan). A member outside the money team reads none, so a superintendent's log with a trade on it would be refused
     *A trade on this log has no signed statement of work.* They read it through a new `STABLE SECURITY DEFINER`
     `gc_package_sow_signed(p_package_id uuid) RETURNS boolean` instead, which says yes or no and nothing of the price.
     It answers false for anyone outside `gc_on_any_schedule_team()` or `gc_office_team()`, so a subcontractor or a crew
     member cannot ask about a package (the Board's condition). `REVOKE ALL FROM PUBLIC, anon`, granted to
     `authenticated`.
   - Three presses keep a trade's promise through the Board's `gc_keep_promises`, which writes `gc_trade_promises`, an
     office table (gc 4's scan): `gc_save_daily_log` keeps *start*, `gc_punch_fixed_ask` keeps *punch* (from the office
     through `gc_punch_fixed_in`), and `gc_submittal_came_in` keeps *submittals*. A member outside the office would have
     the whole press refused. They call one new `SECURITY DEFINER` `gc_keep_building_promise(p_kind text, p_record_id
     uuid)` instead, for Building's three kinds only (the Board's conditions):
     - it never takes a trade from its caller: it reads the job and the trades from the record itself, the saved log's
       crews for *start*, the punch item's trade for *punch*, the submittal's trade for *submittals*;
     - it keeps only that kind's promises of those trades on that job;
     - as a definer the restrictive blocks do not stop it, so it refuses a training account and a twin in words itself,
       and refuses a caller not on the record's job's team (`gc_on_schedule_team`), before any write;
     - `REVOKE ALL FROM PUBLIC, anon`, granted to `authenticated`.
   - **The job's own rows** (call 9, gc 4's change A). The presses also read the office's job tables under their
     policies: `gc_projects` (the log, the punch item, the punch fixed ask, the RFI), `gc_trade_packages` (those four,
     adding a submittal and a submittal that came in), `gc_scope_items` (a submittal, an RFI) and the Board's
     `gc_invites` (an RFI, a submittal that came in). The schedule's own writes read them nine times in
     `20261008040000_gc_schedule_writes` (the first draft takes the whole `gc_projects` row; the inspection, activity and
     milestone presses check the job is being built and the trade is on it). A superintendent, or a project manager
     outside the office, reads none, so each press would refuse *not being built* or *no trade*. PR 10's project manager
     arm already meets this on every write; nothing sets a project manager yet, so it has not shown. A row policy on those
     tables would show the team a trade's budget, an ask's plugs and our terms, so D1 adds money-free reads for the job's
     team instead, `STABLE SECURITY DEFINER`, each answering only `gc_on_schedule_team` of its job, `REVOKE ALL FROM
     PUBLIC, anon`, granted to `authenticated`:
     - `gc_team_project(p_project_id)`: `project_id`, `stage`, `started_on`, `lost_on`;
     - `gc_team_trades(p_project_id)`: `id`, `project_id`, `position`, `ours`, `awarded_invite_id`, and the awarded
       `company_id` (from `gc_invites`, which the presses read only for that). The Board's conditions (gc 2): a `LEFT
       JOIN` of `gc_invites` on `i.id = k.awarded_invite_id` alone, never on the trade, so no other company asked or
       quoted on it ever shows, and a trade not awarded returns `company_id` null; nothing of the ask but `company_id`;
       `SET search_path = public`, and an empty set, not an error, for a caller off the job's team. The six columns are
       the whole contract, and the bed pins them;
     - `gc_team_scope_items(p_project_id)`: `id`, `package_id`.

     **The columns** are the union of what the presses read (gc 4's scan of each press's latest body on main at
     2d6dcc23e: the log reads the job's stage and start, the trades' `ours`; the punch list the stage; the punch fixed
     ask and a submittal that came in the awarded invite; an RFI the stage, `lost_on`, the awarded company and a scope
     line's trade; a submittal a scope line's trade) and what the schedule's writes read (gc 10's scan of
     `20261008040000`: the first start's keep reads `stage` and `started_on`, though it takes the whole row; the first
     draft `stage` and `lost_on`, a line's trade and a trade's job; an inspection, their dates and a wait the stage,
     `lost_on`, a trade's job and its `position`). Every function returns only these, never a whole row: `budget`,
     `carried_invite_id`, `carry_budget`, `own_bid_id`, the quotes, O1's terms and our number's inputs stay out. The
     presses that are the money team's alone (`gc_accept_work`, `gc_close_job`, U6c's and the draws') keep reading the
     tables under the office's policies. The schedule's `gc_schedule_keep_start` stops taking the whole row.
     **D2 adds** (call 2, gc 4): `trade` and `job_ledger_id` on the trades (the page's names, and U8b's crew percent and
     clocked-in note for a superintendent), `label` and `position` on the scope lines (the stage lines and the chart),
     and what the page's card shows of the job, settled with the owner's word on call 2.
     Building's presses and the schedule's writes read these where they read the tables, the `gc_sows` check through
     `gc_package_sow_signed`. D2's `gc_field_rows()` is the same three for the superintendent's jobs, so the page and the
     presses read one shape.
2. **Functions that name the dev in their body.**
   - `gc_close_job`: *Closing a job is a dev's while Building is built.* becomes `gc_money_team()`, *Only the money team
     closes a job.* Closeout is the money team's window.
   - The Portal's `gc_back_charge`, `gc_keep_back_charge` and `gc_drop_back_charge` (call 5): `is_dev()` becomes
     `gc_money_team()`, with the sign-in, training and twin checks Building's presses carry, and the key `devOnly` becomes
     `moneyOnly` with its words (*Only the money team charges a trade.*, keeps a charge, drops a charge). Nothing on the
     client maps the key; only the DETAIL shows.
   - U8's `gc_crew_on_site`, if it is on main by then: `is_dev()` becomes `gc_on_schedule_team(p_project_id)`, the twin
     still refused.
   - U8's `gc_link_crew_job`: *Only a dev links our crew's Pipeline job while Building is built.* becomes
     `gc_office_team()`, *Only the office links our crew's Pipeline job.* Its guard trigger stays (call 11).
3. **Unchanged**: `gc_rfi_change_order` keeps its money-team check; its write of `gc_rfis` now passes the team policy.
   The trades' `gc_trade_*` functions run as the service role and change nothing.

## D1: the reads the schedule's team gains

- **Submittals and RFIs**: the team policies above (9d's call 1). The schedule's chart, Pull earlier and Days back read
  real holds for every member.
- **A company's papers** (call 6, the Board's shape): no policy on `person_contract_documents`, since a row policy would
  give the team every column of a company's paper, a W-9's `form_hints` (its tax number's last four), the answers' PDF
  path and the signer's IP and agent among them. Instead `gc_company_paper_states(p_company_ids uuid[] DEFAULT NULL)
  RETURNS TABLE (id uuid, company_id uuid, doc_type text, status text, sent_at timestamptz, signed_at date, expires_at
  date)`, `STABLE SECURITY DEFINER`: company rows only (`company_id IS NOT NULL`), `doc_type IN ('agreement', 'w9',
  'coi')` (the three `companyPapers` reads), for `gc_on_any_schedule_team()` or `gc_office_team()`, empty for anyone
  else; `REVOKE ALL FROM PUBLIC, anon`, granted to `authenticated`. The row is `CompanyPaperRow` already. The Board's
  loader (`loadGcBoardRows`) switches its `person_contract_documents` read to it in a small Board PR after D1's types,
  so a controller's, an estimator's or a superintendent's chart reads a trade's papers as a dev's does.
- **Our crew** (U8): its percent reads `list_job_stage_progress`, which already admits superintendents and estimators.
  The page reads it for `canUseGcBuilding(role) || canSeeGcMoney(role)`, and `canUseGcBuilding` becomes the team.
  Its counts follow `gc_crew_on_site`'s new gate.
- **The trades' percents** (call 12): after the door the draw tables are the money team's, so the office and the field
  read 0 on a hired trade's bar (`lineOf` reads `pctReported` and an open send-back's `weSee`). D1 adds
  `gc_team_line_percents(p_project_id)`, in call 9's family (`STABLE SECURITY DEFINER`, `SET search_path = public`,
  empty for a caller off the job's team, `REVOKE ALL FROM PUBLIC, anon`, granted to `authenticated`): for each line of
  the job's signed statements of work, its kernel id (`gc_sow_line_of`), its newest reported percent and our open
  send-back's `we_see`, and nothing else, no amount and no draw. The schedule's holds' io (PR 16's 16c) lays it for the
  team, and `withDraws` stays the money team's.
- **The change orders** (call 12): the schedule's PR 16 adds `gc_change_orders_office`, a change order's non-money half,
  gated on `gc_office_team()`, since `gc_on_schedule_team` is not on main when it lands. D1 widens the view's `WHERE`, on
  Owner Billing's condition (gc 5): a job's superintendent and project manager read only the change orders the
  customer has seen, never a draft, the money team's working copy, whose words can still name a figure:

  ```sql
  WHERE (SELECT public.gc_office_team())
     OR (public.gc_on_schedule_team(c.project_id) AND c.status <> 'draft')
  ```

  So a superintendent's chart reads the sent orders' tails (G-76) and the signed ones' late-finish line (G-98) as the
  office's does, and the office keeps every status, drafts included. The view's twelve columns, its security barrier
  and its read-only grants stay as 16b-i wrote them, and `gc_change_orders` stays the money team's.

## D1: the client

- **`src/lib/gc/access.ts`**: `GC_BUILDING_TEAM` becomes `GC_SCHEDULE_TEAM` plus `superintendent`, and so does
  `GC_SCHEDULE_TEAM` (PR 10's note: it gains the superintendent with the page's gate). `canUseGcBuilding` reads it.
  `access.test.ts` pins both lists to `gc_on_schedule_team()`'s roles while `doors.ts` lists Building's records as
  `schedule`.
- **`src/pages/GcProjects.tsx`**: the six Building gates stay `canUseGcBuilding`. Draws and Closeout stay
  `canUseGcBuilding && canSeeGcMoney`, so the money team. The schedule's `canPull` becomes `canMove` (9d's call 1:
  every member reads the holds now). The schedule's `reads.draws` (PR 16) becomes `canSeeGcMoney`, since the team
  reads its percents through `gc_team_line_percents` and only the money team reads draws.
- **`src/lib/gc/doors.ts`**: the ten records read door `schedule`, opens unset. The four money tables and `gc_back_charges`
  read door `money`, with no `reads` (`gc_back_charges` with lane Portal, opened by Building's door). `BUILDING_OPENS` and `BUILDING_MONEY_OPENS` go. `doors.test.ts`'s O9 test keeps the Board's and the
  Portal's three, and gains one in door 2's shape: the ten read `schedule`, the four read `money`.
- **The weekly report's sends** (call 4's client half): in the weekly report's window, **From Click Construction** and
  **Email me a test** show to the office (`canOpenGcProjects`; a project manager outside the office is not a role the
  client knows), and **From me**, the `mailto` from the superintendent's own mail, stays the team's.
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
Our number. That is the owner's word (2026-10-10): Building only, no bidding, no prices, no bills. **Questions** on the
card is the RFIs window, under its button's name, *RFIs*.

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
  10. **The helpers** (the Board's cases): a superintendent's log with a signed trade saves and keeps that trade's start
      promise; a trade not on that day's log keeps nothing; a punch fixed ask keeps *punch* and a submittal that came in
      keeps *submittals* for its own trade only; a training account and a twin are refused by
      `gc_keep_building_promise` in words; a subcontractor's `gc_package_sow_signed` answers false; anon can call neither.
  11. **A company's papers**: a superintendent on P calls `gc_company_paper_states` and gets the seven columns of the
      company's agreement, W-9 and certificate rows, nothing like `form_hints`, and never a person's paper; a
      subcontractor gets none.
- **The schedule's bed** (`gc_schedule/30_team_door.sql`, PR 10's): its case 5, the superintendent reading 0, flips to
  reading P's bars. The schedule lane edits that one case in D1.
- **U8's bed** (`gc_building/90_crew.sql`): *linked again, and B's too* (B3 on job 901) becomes the refusal case;
  *an estimator, while Building is built* (the link) and *an estimator* (the counts) now pass; a subcontractor is the
  outsider; a superintendent on the job reads the counts, and one not on it is refused.
- **The team's reads**: in `90_door.sql`, a superintendent on P reads `gc_team_project(P)`'s four columns and nothing
  from `gc_team_project(Q)`; the superintendent draws P's first schedule, adds an activity and records an inspection,
  which read the job through them. `gc_team_trades` (the Board's cases): the superintendent on P reads P's trades and
  none of Q's; an awarded trade returns its company and a trade not awarded returns null; a second company's ask on the
  same trade never shows; the result has exactly the six columns; a subcontractor gets an empty set (an estimator is on
  the team, so it is not the outsider); anon cannot call it.
- **Call 12**: a superintendent on P reads P's line percents (a line reported at 60% reads 60, a line sent back reads
  our `we_see`) with no amount, and none of Q's; a subcontractor gets an empty set. Through `gc_change_orders_office`
  (gc 5's cases): the superintendent on P reads P's sent, signed and declined orders and none of its drafts, never
  `cost`, `price` or `pct_done`; a superintendent on Q reads none of P's; the office still reads P's drafts. Two
  mutants must fail the bed: the `status <> 'draft'` clause dropped, and `c.project_id` swapped for a constant.
- **The back-charges' bed** (`gc_back_charges/20_scenario.sql`): its four `devOnly` cases flip to a controller and a
  master who charge, keep and drop, an estimator or assistant refused in the money team's words, and training and a twin
  refused.
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
  rollback that re-creates the `_dev` policies); `docs/ACCESS_CONTROL.md`'s **Building:** bullet (the GC
  first-door paragraph is one bullet a lane since #5302; D1 adds to its own bullet only), amended where it says
  Building's tables stay dev only, and the **Schedule:** bullet's one line that the superintendent joins the team, the
  **Owner Billing:** bullet's sentence about the view amended where it stands (gc 5: the job's team reads the orders the
  customer has seen, the office every status), and the back-charges bullet becoming *written and read by the money team since
  Building's door (`gc_back_charges_money`); the trade answers only through `gc_trade_answer_back_charge`*; `PROJECT_DOCUMENTATION.md`'s Building windows; `GLOSSARY.md` (*the job's team*);
  the guides; the release note and fragment.
- D2: `docs/ACCESS_CONTROL.md`'s **Building:** bullet (the superintendent's `/gc`), `docs/twins/APP_DIRECTORY.md` if the field view counts as a
  page of its own (it does not: it is `/gc`), the guide *see your GC jobs as a superintendent*, the release note and
  fragment.

## The calls

1. **Two PRs, D1 then D2.** D1 is the tables, the functions, the office's gates and the beds. D2 is the field's page.
   D1 alone opens Building to the office team and the project manager. **My pick: two**, so the policies land and are
   verified before the page that shows a superintendent anything.
2. **What a superintendent sees on `/gc`**: their own building jobs, Building's windows and the schedule, and nothing of
   the Board or the money. The reads through `gc_field_rows()`, not wider policies on the New project and Board tables,
   whose rows carry money. **My pick: the function.** **The owner's word (2026-10-10, through the lead):** a
   superintendent who opens `/gc` sees Building only, the jobs being built with the schedule, the punch list,
   submittals, questions and the daily log, and no bidding, no prices, no bills. D2 is drawn that way.
3. **The cross-lane reads in Building's presses**: `gc_package_sow_signed` and `gc_keep_building_promise`, both `SECURITY
   DEFINER`, so `gc_sows` stays the Board's and `gc_trade_promises` the office's. **The lead's pick: both. The Board
   co-signs (gc 2, amendment 1)**, with its gates: each answers only the team, the keeper reads its trades from the
   saved log and refuses training and twins itself.
4. **The weekly report's email to the customer** (gc 5's question): `gc-customer-email`'s weekly kind reads the report
   as the caller, so after D1 a superintendent could email the customer. **My pick:** the weekly kind also needs
   `gc_office_team()` or the job's project manager. A superintendent writes the report; the office sends it. Owner Billing
   (gc 5) co-signs, and the owner may say otherwise.
5. **Back-charges in Draws** (**the Portal co-signs, gc 3, amendment 1**, without waiting for its own door, whose
   business is the trades and their links): the Portal's `gc_back_charge`, `gc_keep_back_charge` and `gc_drop_back_charge` refuse
   anyone but a dev in their body, and `gc_back_charges` writes are a dev's. Draws opens to the money team, so a
   controller's charge would fail. **My pick:** D1 moves those three to `gc_money_team()` with the training and twin
   checks the Building presses have, and `gc_back_charges` writes to the money team. The Portal co-signs.
6. **A company's papers for the schedule's team** (9d's call 1): **the Board's shape (gc 2, amendment 1)**, a function
   with the seven columns `companyPapers` reads, not a row policy that would show a W-9's tax hints and the signer's
   details. A person's paper stays the pay roles'. The Board's loader switches to it after D1's types.
7. **An RFI answer's cost**: the whole team, superintendents included (Building's call 1, its default). Unchanged.
8. **The architect's email from a superintendent**: `gc-architect-email` reads the submittal or RFI as the caller, so after
   D1 the team sends to the architect. **Default: yes**, since an RFI is the superintendent's.

9. **The job's own rows for the team** (gc 4's change A): `gc_team_project`, `gc_team_trades` and
   `gc_team_scope_items`, money-free and team-gated, read by Building's presses, the schedule's writes and D2's page,
   not row policies on the office's tables. **My pick: the three functions.** It fixes PR 10's project manager arm on
   every schedule write too, so the Schedule lane (gc 10 holding) takes the schedule's half in D1, and New project's and
   the Board's lanes co-sign the shape of their rows.
10. **One promise keeper for Building's three kinds** (gc 4): `gc_keep_building_promise(p_kind, p_record_id)`, not one a
    press. **Taken.**
11. **One crew a Pipeline job** (gc 4's amendment 3, `claude/gc-building-u8-amend-3`): `gc_link_crew_job` refuses a job
    another trade our crew does already holds, on any GC job: *That Pipeline job is already Electrical's.* on the same
    job, *That Pipeline job is already Plumbing's on Stone Oak.* on another. A partial unique index
    `gc_trade_packages_one_crew_per_job ON (job_ledger_id) WHERE ours AND job_ledger_id IS NOT NULL` holds it against a
    race, and the migration first refuses in words if two trades already share a job. In the door, not U8a (#5285 stays
    as it is). **Taken, as gc 4 wrote it.**
12. **The trades' percents and the change orders for the job's team** (the schedule's PR 16 seams, gc 4):
    `gc_team_line_percents` and the view's `WHERE` widened to `gc_on_schedule_team`. **The lead's pick: both in D1**, so
    the chart reads the same for every member on the day the door opens. **Owner Billing co-signs** the view's change
    (gc 5, amendment 5), on its condition: the job's team outside the office reads no draft.

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
