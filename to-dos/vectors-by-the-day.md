---
name: "Vectors by the day: was each person's day worth it"
number: 69
group: gated
status: not started · mock-up drawn 2026-09-30 · the owner's read of the mock-up pending
summary: >
  A grid under the Bridge's Vectors panel: one cell per field person per day, green when the
  day's hours earned more than they cost, red when they cost more, with a week column after
  every Saturday and the month at the end; Weeks and Months zooms fold the same rows. A cell
  opens the day's split with the job's rate beside the wage and says why it is red.
next: The owner reads the mock-up and takes the two calls (recorded time on the grid; salaried days priced or grey), then PR 1.
size: S + S + S + XS
blocker: Two owner calls; and #15's retirement of People → Review decides where the drilldown lands.
ver: from v2.3344
opinion: build — the owner asked for exactly this reading, the kernel already has every input, and the Why column keeps a red day from being read as a slow person.
---

# Vectors by the day

## The ask, in the owner's words

"Specifically people's profitability, I would like to find a view that shows people every day and if their contributions to jobs were profitable or unprofitable every day and every week and every month." (2026-09-30)

## The decision

Not a third view on People → Review (#15 is retiring it into the Bridge), not a per-person calendar one name at a time (loses the comparison), not a score or a rank (days are noisy, and no financial number reaches a teammate). One grid under Vectors, dev-only, with three zooms — the mock-up is [`vectors-by-the-day-before-after.html`](./vectors-by-the-day-before-after.html), and its *Is this the best we can do?* section records what was kept, dropped and left to the owner:

- **Kept**: it lives under Vectors on the Bridge; a red day is a job's verdict, so the cell's click puts the job's earned rate beside the wage and the row's **Why** column counts red days by job; office and bid days stay on the grid, grey, with their hours; one grid with week subtotals and a month total rather than three tabs.
- **Dropped**: a daily score, rank or streak; separate day / week / month pages.
- **Owner's calls**: read recorded time (pending hours dashed) instead of Vectors' approved-only — otherwise this week is blank and last week thin; salaried people priced through the workday template as Review does, or left grey with the hours.

## Where it plugs in

- Exists: `src/lib/bridge/vectors.ts` (`buildVectors` — one pay week from `VectorSession` rows, `ratePerHourByJob`, wages), `src/lib/bridge/earnedRevenue.ts` (the rate and `assumedHalfJobs`), `src/lib/bridge/loadBridgeVectors.ts` (the 8-week window's sessions, wages, people), `src/components/bridge/BridgeVectorsPanel.tsx` (the week table; the name is the door to People → Review's per-person panel), People → Review's day rows (the drilldown until #15 lands).
- New: `src/lib/bridge/vectorDays.ts` — `buildVectorDays` (one cell per person × day: hours, earned, labor, contribution, pending, guessed, jobs with rate and wage) and `foldVectorDays('week' | 'month')`; the loader's window widened to the zoom; the zoom row, the grid, the cell popover and the Why column in the panel.

## The plan

1. **Kernel + Days zoom** — `vectorDays.ts` with tests (a priced job, a no-price job, an assumed-half job, a pending day, an office day, a salaried day); the month grid under Vectors; the month stepper. Guide `the-bridge.md` gains the section.
2. **Weeks and Months** — the fold, the two zooms, the wider loader window (a year of sessions for Months; the rates already use lifetime hours).
3. **The click and the Why** — the day's split popover with the verdict sentence and the three doors (the job, set % complete, the day on People → Review); the Why column; the ↻ mark on a day whose sign flipped in the last 7 days.
4. **Recorded time** — if the owner says yes: the toggle, dashed cells; Vectors' own pay-week table stays approved-only so payroll and the grid never disagree on what was paid.

## How to verify

Dev-login on a local preview, `/bridge`, September 2026: every person's month cell must equal the sum of their week cells, and the Field crew row's month must equal the Bridge's own field contribution for the same days. Pick one red cell and open the job: its contract ÷ expected hours must be the rate the popover shows. The past-moves check: set a % on an assumed-half job and watch every cell on that job re-price.
