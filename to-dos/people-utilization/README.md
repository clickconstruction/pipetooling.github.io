---
name: People → Utilization and the drawn week
number: 284
group: ready
status: PR 1 #7311, the types PR #7331 and PR 2 #7332 merged · PR 3 #7333 armed · walked on the dev server as a dev, an assistant and a helper, two defects fixed on PR 2 · left: the same walk on prod after #7333 deploys
summary: >
  A People view that reads the hours each person said they can work against the hours the clock
  recorded, by pay week, so the office knows when to add people and when to use the people it has
  more; and the person's side on My Time, where they draw the week they can work, Sunday to
  Saturday, and read their last eight weeks against it. Everything is built and tested; what is
  left is landing it in order.
next: Repeat the walk below after #7333 deploys and record it here; delete this folder once the owner has seen it.
size: S as what is left (the code is done; three PRs to land in order)
blocker: The merge queue, one PR at a time; #7332 and #7333 wait for the PR ahead.
opinion: build — the owner said ship; the branches are ready and the write-up is theirs
---

# People → Utilization and the drawn week (#284)

**Pick this up cold.** Nothing here needs re-deriving. The code is on three branches on origin, committed in the order they land, with their versions already claimed on GitHub (`refs/claims/*`). Your job is to land them in order and verify live. Read the two kernels' header comments for the rules before changing anything; do not redesign the model without the owner.

## The ask, in the owner's words

> In the People tab, add a new tab that can act as a utilization page to help fill the need of me as a dev not knowing when we should add people to the team or use people more. Some page that allows all office staff to see the hours people claim they are able to work and what they are being utilized at and if it is over 8 hrs. We'll need to add to the dashboard tools to enable a user on their dashboard to specify their hours and see their utilization for the last weeks they've worked.

And after the first round:

> A user being able to specify what times during the week, Sunday to Saturday. Someone might always want to get off at 3 PM on Friday, so them being able to draw it out makes the most sense.

## The decision

- **One drawing per person**, Sunday to Saturday in half-hour cells from 5 AM to 8 PM, painted by pressing and sweeping; a plain weekly number stays as a fallback. Drawn on My Time by the person, or on the board by the office. Append-only answers from a Sunday on; the newest answer in force on a week's Sunday wins, and **the first answer reads the weeks before it**.
- **One board for the office**: People → People → **Utilization**, gated like Hours (the clock's readers: dev, controller, assistant, pay-approved leader). The field crew and the office as two lists; eight pay weeks as bars per person; last week against their hours; days over 8 h; **hours outside the drawn week**; a verdict by streak. The lines at the top say the week in words.
- **The rules**, all constants in `src/lib/people/utilization.ts`: pay week Sunday to Saturday; worked time is recorded time as costing reads it; no answer reads as 40 h marked *assumed*; long day over 8 h; bands over > 100, full ≥ 85, steady ≥ 60, light < 60; over three full weeks running → *add people*; light four weeks running (a zero roster week counts) → *use them more*, field only; salaried people stay on the schedule's hours unless pay lets them record hours and a punch is in the window; a person archived inside the window keeps their weeks as *Left the roster*.
- **Rejected**: a "by person" view under Jobs → Capacity (right data, wrong room); a section inside People → Hours (the pay desk, narrower gate); a new Dashboard card (My Time is already the person's clock; only Job Mode gets a card because it shows no My Time).
- **Open for the owner, drafted as**: long day 8 h (not 10); who may set another's hours = the clock's readers; subs on the board = yes; a person sees their own percent = yes.

## The mock-up

The owner's write-up, with before and after screens from the spike, the model, the critique and the plan: *Utilization Board* — https://claude.ai/artifact/FxgAtkkA36eZnfoKLVmtxH (private to the owner; it shows real clock data, so it stays off the repo). The prototype itself is the code on the branches below; run `claude/utilization-3-my-time` against prod data to see it whole.

## Where it plugs in

Exists on `main`: `clock_sessions` (recorded time), `roster_people`, `list_people_pay_flags`, `user_time_off`, `payWeekAnchor.ts` (Sunday–Saturday), `appTzWallTimeMs` (the company clock), the People tab groups (`peopleTabGroups.ts`), `DashboardMyTimeSection.tsx`, the Job Mode return in `Dashboard.tsx`. Prior art: Jobs → Job Summary → Capacity (v2.2828), company-wide only; it stays as it is.

New, on the branches: table `person_available_hours`; kernels `src/lib/people/utilization.ts` and `weekAvailability.ts`; `availabilityIo.ts` (the supabase door, plus a local one for smokes); `fetchUtilizationBoard.ts`; components `PeopleUtilizationTab.tsx`, `AvailableHoursModal.tsx`, `WeekAvailabilityPainter.tsx`, `UtilizationWeekBars.tsx`, `dashboard/DashboardMyHoursBlock.tsx`; guides `see-who-is-over-their-hours` and `draw-the-hours-you-can-work`; the doc lines in `APP_DIRECTORY.md`, `GLOSSARY.md`, `PROJECT_DOCUMENTATION.md`, `ACCESS_CONTROL.md`, `PEOPLE_TABS_ARCHITECTURE.md`.

## The train (branches on origin, in landing order)

1. **PR 1 — #7311, `claude/utilization-1-available-hours-table`, v2.6707.** The migration `20261108175919_person_available_hours.sql` alone, with its `docs/migrations/` fragment, release note and `docs/recent-features/` fragment. Merged and pushed 2026-11-08; the types regen is **#7331** (armed; `supabase gen types typescript --project-id … --schema graphql_public --schema public`, since `--linked` needs IPv6 here).
2. **PR 2 — #7332, `claude/utilization-2-board`, v2.6708** (rebased onto #7331's branch; re-rebased onto main and armed when #7331 lands). Kernels, the tab, the window with the painter, the supabase door, the guide, the docs. It reads the new table, so `check:calls-ahead` wants the push first; typecheck wants the types PR merged. **Rebase onto main after the types PR lands**, push, `gh pr create --fill`, `gh pr merge --auto` (never `--squash`; the queue owns the strategy). Expect a trivial conflict at most in `src/pages/People.tsx` (two added lines) and `peopleTabGroups.ts`.
3. **PR 3 — #7333, `claude/utilization-3-my-time`, v2.6709** (stacked on PR 2's branch as its base; rebased onto main and armed when #7332 lands). My Time's Your hours block, the Job Mode card, the smoke, the guide. **After PR 2 merges**, rebase onto main, push, PR, auto-merge.

Each branch's release note and fragment are in its commit. The versions are claimed; claim nothing new for them. In the desktop app, press Auto-fix on each PR you open.

## How to verify (after PR 3 deploys)

- As a dev: `/people?tab=utilization` shows the lines, five tiles and both lists; **Weeks** on a row opens the per-week rows; **Set hours** on a helper → draw → Save → the row's Can work reads the words and **Outside the drawn hours** fills for the weeks the answer covers (the first answer reads back over the window).
- As an assistant: the tab shows; the 26-week chip is closed when `assistant_hours_window_weeks_v1` is shorter.
- As a helper or a sub: no tab; My Time shows *How many hours a week can you work?* with Set hours; the painter paints by pressing and sweeping (real pointer strokes work in the pane); Save reads the week back and draws the bars. In Job Mode the same block is a card under Your record.
- A salaried account reads the schedule's hours with no press.
- Gotchas met in the spike: the dev login's dashboard uses `robert@douglasmining.com`, who has no sessions, so the bars are empty for that account; test the board's people instead. A person archived in the office while you look drops out unless their archive day is inside the window (the kernel keeps them, marked *Left the roster*).

## Follow-ups, as their own cards later

A Needs You nudge for people who have not drawn their week and for a three-week over streak; Capacity (Jobs → Job Summary) reading the summed drawings instead of roster × 8; Who's where linking both ways; Dispatch reading the drawn week when it places blocks.

## Where it stands

2026-11-08: designed and built in one spike session on the owner's machine (worktree `inspiring-jepsen-35e2f2`); the owner said ship; PR 1 opened and armed; PRs 2 and 3 committed and pushed as branches; this card written for another machine to land the rest. The spike's own branch `claude/people-utilization-tracking-745ad5` holds the WIP commit 8940638e4 and can be deleted once PR 3 is on main.

2026-11-08, afternoon: #7311 merged and its migration is in prod's ledger; the types regen opened as #7331 and armed; #7332 (PR 2) and #7333 (PR 3) opened from the rebased branches, tests and the CI check scripts clean on both, armed in order as each PR ahead lands. The live walk waits for #7333 to deploy.

2026-11-08, evening: the walk from § How to verify ran on the dev server from the stacked branches (#7333 over #7332 over #7331) against prod data. **As the dev**: the lines, the five tiles and both lists; **Weeks** opened the per-week rows (a 32 h week reads its 8 h off); **Set hours** opened *Hours Tristen can work*, a real pointer sweep took Friday to 7a–1p and the words, the total and the Save button read 38 h — cancelled, so nothing was written on a real person. **As the Sample assistant**: the tab shows with the 3-week window and every longer chip closed; two defects found and fixed on #7332: the kernel counted its default eight weeks over three weeks of sessions, so the five weeks the assistant's fence hides read as nothing recorded and a steady helper read *Light four weeks running* (`fetchUtilizationBoard.test.ts` pins the count now), and the *8 weeks* chip read pressed over a 3-week board (the cap gets its own chip). **As the Sample helper**: `/people` sends them to the dashboard, so no tab; the Job Mode card and the My Time row both show *How many hours a week can you work?*; the painter painted by pressing and sweeping, **Save 38 h a week** wrote the sample's row and the block read the week back in words with the bars. Not exercised: a salaried account (no salaried sample on the roster); a sub.
