# GC mode: the build map (every lane, every helper)

Written 2026-10-06 by the lead at the owner's ask ("what is our build plan, help me map it out so
we can build all of it across all of these helpers"). This is the one page that says what is left
of the real build, in what order, who builds it, and what waits on what. The detail stays in each
lane's plan: `NEW_PROJECT_REAL_BUILD.md` (done but for one step), `SCHEDULE_REAL_BUILD.md` (sixteen
PRs, nothing built), and the four plans the helpers write first (section 3). `HANDOFF.md` section
4 is the order this map follows; `README.md` → *Where it plugs into the app that exists* is the
list of what is reused, never rebuilt.

## 1. Where it stands on main (paused 2026-10-07)

| Lane | On main | In flight |
|---|---|---|
| New project | Kernels (PR 1, 1b), the tables (PR 2, 3), `gc_create_project` and the window (4a, 4b), the scope book page (4b-second), Drive (step 5, v2.4754 #4776), `gc_issue_plan_set` (6a), and 6b, 9, 8a and 8b (v2.4773 #4789, v2.4774 #4791, v2.4779 #4794, v2.4799 #4815). Both edge functions are deployed. | Step 7 waits on the company record. 8b's prod check is half run (`HANDOFF.md` → *Pick up the real build*). |
| Schedule | PRs 1a, 1b-i and 1b-ii: every kernel lifted word for word (v2.4772 #4788, v2.4777 #4792, v2.4781 #4796); the spike reads them from main. PR 2, the nine tables (v2.4798 #4814), and PR 3, the eleven for moves and the records (v2.4809 #4827), both applied and verified. | PR 4 (#4835, v2.4816) is open and was held at the pause. The types PR #4833 is in the queue. Next is PR 5, the RPCs. |
| Board | Nothing (the prototype only). | |
| Portal | Nothing. | |
| Building | Nothing. | |
| Owner Billing | Nothing. | |
| Quo | Nothing; the design is taken (`HANDOFF.md` section 5), call 4 is open. | |

The prototype on `spike/gc-mode` is complete (`PUNCHLIST.md` closed, `GANTT_FEATURES.md` 90 of 97
*Have*, the rest real-build-only). It is the spec: every lane's real build reads its kernels and
its golden test as the truth of what the screens say.

## 2. The lanes and what waits on what

```
New project ──────────────┐
  (7: the set email) ◄────┤
Schedule 1–12 ────────────┤            Schedule 13–15 (tell the trades, the trade's chart,
                          │            the customer's letter) ◄── company record + portal
Board ── company record ──┼──► Portal (one link per company, the ~20 trade writes, Resend)
  (PR B1, the gate)       │       └──► Compare, carry, award, SOW, Get started (Board B4–B6)
                          │
Building ─────────────────┤──► Building's draws ◄── Portal (the trade's pay application)
Owner Billing ────────────┘──► our bill ◄── Building's draws (what the trades billed)
Schedule 16 (the readers) ◄── each other lane's table as it lands
```

**The company record is the gate.** A trade partner keyed to a company (not a person), with its
people, coverage, reach, bench and language, is what New project's step 7, the whole Portal, the
schedule's PRs 13 to 15 and the Board's invitations all read. It is the first PR of the Board lane
and the first thing any helper builds after its plan.

Everything else runs in parallel: the schedule's PRs 1 to 12, Building's tables and screens, Owner
Billing's tables and screens, and New project's tail touch different tables and different files.
They meet only in the migration stamps and the version numbers, which `npm run claim` hands out.

## 3. Who builds what

The pattern that worked for New project and the schedule: **a plan first** (tables, the decisions
with a default each, what is reused, the kernels that move, the RPCs, the PRs in order with a
*Check* each, the docs each PR touches), reviewed by the lead and the owner's word on the
decisions, then PRs one at a time, each behind the dev gate with its release note, fragment and
guide. The helper's five steps and the rules are in `HELPERS.md`; the lane's plan is written on the
spike, the code goes on `main`.

| Who | Lane | First | Then |
|---|---|---|---|
| Lead | New project; merges; every `db push`, types PR and function deploy; the helpers' reviews. | Land 5, 6b, 9, 8a, 8b; the prod checks. | Step 7 once the company record is in; the *Later* items as their tables land. |
| Helper 1 | Schedule (`SCHEDULE_REAL_BUILD.md`). | PR 1a, 1b (lift the kernels). | PRs 2 to 5 (the tables and RPCs, one migration each), 6 to 9 (the tab, moves, the rest of the writes), 10 (the team), 11, 12. Then 13 to 15 once the Portal is real, and 16 beside each lane. |
| Helper 2 | Board: the company record, invitations, the board and one project read only, then compare, carry, award, SOW, Get started. | `BOARD_REAL_BUILD.md`. | B1 the company record (`companies`, people, coverage, reach, language, bench) and its RPCs; B2 the Board's kernels lifted (`gcBids`, `gcFollowUp`, `gcProjectPeople`, `gcCompanyPeople`, `gcStart`, `gcAskCompanies`, `gcBench`, `gcVetting`); B3 the board and a project on real data at `/gc`; B4 invitations through the company; B5 compare, carry, our number; B6 award, the master agreement, the statement of work on `step_commitments`, Get started. From the schedule's lift (`mockups/schedule-pr1b.md`), 34 of its functions wait on B2's Start, papers, promises and people: the other 8 of `gcNotReady`, `startNeeds` and `startReminders` (with the Portal lane's words), and all of `gcCallList` and `gcCounts` (then the schedule's PRs 14 and 16). |
| Helper 3 | Portal: the company portal on the sub portal's pattern. | `PORTAL_REAL_BUILD.md`. | P1 the link per company and the portal's read (`portalHome`, `portalAsks`, `portalPay`, `portalWeeks`, `portalMessages`) through one edge function; P2 the trade writes, in the prototype's order (quote, promise, question, sign, people, language first); P3 the emails through Resend from `portalMessages` and `mailRecipients`, EN and ES (`PORTAL_SPANISH.md`); P4 back-charges and change requests; P5 the rest of the writes (draw, pay application, waiver, look-ahead, punch, submittal, insurance, vetting). From the schedule's lift (`mockups/schedule-pr1b.md`), 7 of its functions wait on the portal's words and reads: `crewCountProblem`, `lateNoticeProblem`, `portalCrewAsks`, `datesMessage`, `datesNotices`, `startNeeds` and `startReminders`; P extends `src/lib/gc/portalI18n.ts`, which the schedule's 1b starts with the Spanish date words. |
| Helper 4 | Building: daily logs, submittals, punch items, inspections, RFIs, the trades' pay applications, weekly reports; files and photos in Drive. | `BUILDING_REAL_BUILD.md`. | U1 the tables; U2 the kernels lifted (`gcBuilding*.ts`, `gcPriceStanding`, `gcFollowUpSheet`, `gcBuildingWeekly`); U3 the daily log and the punch list on real data; U4 submittals and inspections; U5 RFIs (yes to all four, 2026-10-05) and the change order they start; U6 the trades' draws and pay applications (needs P5); U7 the Friday report; U8 our own crew from its Pipeline job and clock-ins (schedule PR 16, G-51). From the schedule's lift (`mockups/schedule-pr1b.md`), all 6 of `gcBuildingPromises` wait for U2, the RFIs and submittals join the schedule's holds in its PR 9 once U2 lands, and U2 extends `building.ts`, `buildingLog.ts` and `followUpSheet.ts`, which the schedule's 1a and 1b start. |
| Helper 5 | Owner Billing: our pay applications, the AIA 702 and 703, retainage, the certificate, payments, promises and reminders, interest, the customer's acceptance, change orders. | `OWNER_BILLING_REAL_BUILD.md`. | O1 the tables and the project's signed worth, retainage step, late interest and late finish; O2 the kernels lifted (`gcOwnerBilling*.ts`, `gcChangeOrderDays`, `gcLateFinish`, `gcBillingForecast`, `gcCashForecast`); O3 change orders on real data; O4 our bill: `fillAiaG702G703Workbook` learns every 703 line, the notary block and *TO CUSTOMER*, and a sent bill becomes a bill on the customer portal's statement; O5 payments through the existing recording, promises and reminders on the Pipeline's promise events; O6 interest and the forecast; O7 the customer's acceptance and the Monday email. From the schedule's lift (`mockups/schedule-pr1b.md`), `whatIfDiff`, `lateFinish` and `customerScheduleLetter` wait for O2's billing forecast and late finish, and O2 extends `ownerBilling.ts`, which the schedule's 1a starts. |

Helpers 2 to 5 are not open tonight; only Helper 1 is. When the owner opens them, the lead sends
each its row of this table and `HELPERS.md`.

## 4. The order of the whole thing

1. **Now.** The lead lands New project's stack. Helper 1 lifts the schedule's kernels (1a, 1b).
2. **Plans (a day).** Helpers 2 to 5 each write their lane's plan on the spike, end it with "is
   this the best we can do?" and three ways it could be better, and message the lead. The lead
   reviews and takes the decisions to the owner in one list. Helper 1 keeps going (PRs 2 to 5).
3. **Foundations (the owner's yes).** Helper 2 builds B1, the company record. Helpers 4 and 5
   build their tables (U1, O1). Helper 3 writes P1 against B1's shape and builds it the day B1
   lands. Helper 1 is on 6 to 9.
4. **Screens.** B2 and B3, U2 to U5, O2 to O4, P2 and P3, schedule 10 to 12. New project's step 7
   lands here, once B1 and P3 are in.
5. **The trades' side and the money.** P4, P5, U6, O5 to O7, B4 to B6, schedule 13 to 15.
6. **The readers.** Schedule 16, each beside its lane; New project's *Later* items; the Spanish
   read by a native speaker (call 9); Quo, if the owner says so (call 4).

A lane never waits for the lane before it except where section 2 draws an arrow. Each PR merges
alone through the queue; the lead pushes its migration from a clean checkout of main and opens the
types PR before the next PR on that lane goes up, so a lane with a migration ships about one PR a
sitting and a lane without can ship several.

## 5. Rules every helper follows on main

- `CLAUDE.md` and `AGENTS.md` are the law: `SET lock_timeout = '3s';` first in every migration;
  a CREATE TABLE migration ends with the three block calls; the stamp is numbered after
  `origin/main`'s newest and registered with `npm run claim -- --migration <file>`; the version
  with `npm run claim -- --branch <b>`; one `src/content/releaseNotes/v2.NNNN.ts` and one
  `docs/recent-features/v2.NNNN.md` per PR; `docs/migrations/<stamp>_<slug>.md` per migration;
  a section and a TOC line in `docs/EDGE_FUNCTIONS.md` per function; a help guide in plain words
  per screen; `docs/twins/APP_DIRECTORY.md` per page; theme tokens, the status-bar codemod on
  every new window, the dev-mcp catalog rebuilt when `database.ts` or a function changes.
- **Helpers never apply DDL and never deploy.** They open the PR with `gh pr merge --auto`; the
  lead pushes the migration, regenerates the types and deploys the function. New RPC names error
  in `npm run typecheck` until the types PR lands; that is expected, and the next PR on the stack
  waits for it.
- **A kernel moves, it does not fork.** Lift a kernel from `src/lib/gcMode/` to `src/lib/gc/`
  function by function, word for word (the schedule's PR 1a found that moving files whole drags
  every lane along: 71 modules), each helper under its own lane's file so that lane's lift extends
  it; the prototype deletes what moved and re-exports it (PR 1's pattern). A test that reads only
  the kernel moves with it unchanged; a test that plays the prototype's reducer stays on the spike
  until its presses land, and main gets direct tests for what moved. The golden test on the spike
  keeps passing without `-u`. The equality script from PR 1a shows each moved declaration equals
  the spike's.
- **Reuse, never a second system.** The table in `README.md` → *Where it plugs into the app that
  exists* names the customer record, the sub portal, `step_commitments`, the master agreement, the
  supply-house compare, the promise events, the waiver train, the Bid Board's map, the AIA
  workbook, the Pipeline's percent reports and Resend. A plan that builds one of them again is sent
  back.
- **Dev gate until the owner opens it.** Every screen lands on `/gc` behind the dev door with
  dev-only RLS; the PR that opens a lane to its roles is its own PR with the `ACCESS_CONTROL.md`
  change (the schedule's PR 10 is the pattern).
- **Test rows on prod** are named "… test …, delete me" and listed in the lane's status so the
  owner can sweep them.

## 6. The owner's calls still open

From `HANDOFF.md` section 1: Quo (call 4); the roughly thirty unconfirmed defaults (call 5) and the
lanes' timings (6, 7, 8), each a constant and changed freely; the Spanish read (9); the two portal
ideas not picked (10); the schedule's ten decisions (11), taken as defaults while Helper 1 drives.
The real build adds two: the GC entity's name (call 12) and the test rows on prod (call 13). Each lane's plan adds its own short list, and the lead brings them in one message.

## Status

Written 2026-10-06. Paused 2026-10-07 at the owner's word, with New project built but step 7 and
the schedule through its PR 3 (section 1). The other four lanes wait on their helpers being opened
and their plans written. `HANDOFF.md` → *Pick up the real build* is where to start again.
