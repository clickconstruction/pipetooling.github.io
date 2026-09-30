---
name: "Typed hours get a second look: the stamp, the hold, the worker's own door"
number: 70
group: ready
status: PR 1 (the database) shipped v2.4242 · PR 2 (the stamp on the nine approval views) shipped v2.4247 · next the Needs You card
summary: >
  A clock session someone typed looked the same as a punch, and the assistant who typed it could
  approve it. Now the database records typed hours (who, when, the day before and after), holds the
  typist and the person themself from approving, and records the second look. Left: the stamp on
  the nine approval views, a Needs You card, a worker's "it did not clock me in" door, the Hours
  grid stopping before it writes over clocked hours, and the dev switch.
next: >
  PR 3 the Needs You card and "Looks right"; PR 4 the worker's door; PR 5 the grid stop and the
  dead Quickfill hours grid; then a dev flips the switch from test to on in Settings.
size: M (PRs 1–2, shipped) + S–M per screen PR × 3
blocker: Nothing — building.
ver: v2.4242 · v2.4247
---

# Typed hours get a second look

## The ask

The owner, 2026-09-30, with a worker's text in hand (*on Friday it didn't let me clock in… my hours
for Friday were 10 AM to 9 PM*) and the assistant's note (*Michael's hours were short from last week.
Fridays weren't entered*): *help me figure out how much I should add to enable her the tools to
manually suggest hours by override without seeing the rest of people's hours.*

What the look at her access found: she already has more than that. Any assistant can read every
clock session (the Hours tab, three weeks back), insert a session for anyone, edit and reject any,
and approve — her own hours included. Nothing recorded who typed a session: it looked the same as a
punch. The gap was never access; it was that typed hours had no mark and no second person.

## The decisions (owner, 2026-09-30)

1. **Stamp typed hours** — who typed them, when, and what was on the day before and after.
2. **Whoever typed it cannot approve it.** Any other person who approves hours can — a dev, a
   controller, a pay-approved master, the assistant when someone else typed.
3. **Nobody approves their own hours.**
4. **The stamp shows on every view hours are approved from** — nine of them, all calling one
   function — at three sizes (full row, compact, a pencil dot). A hand-typed row is never swept in
   by an *Approve all*.
5. **The worker can file his own missed day** — *I worked but it did not clock me in* — so the
   office approves instead of retyping a text.
6. **The Hours grid stops** before a typed number writes over hours the clock recorded.
7. Her access is **not** narrowed. She still sees hours (no wages) — that is what the role is for.

Not decided, taken as drawn: the second person is anyone else who can approve (not payroll access
only); a trim (a forgotten clock-out cut back) is recorded and shown but holds nothing.

## The mock-ups

[`mockup.html`](./mockup.html) — the stamp at three sizes, the !N cell popover today and proposed,
Approve all holding typed rows, the worker's door, the grid stop.

## Where it plugs in

- **Database (shipped, v2.4242)** — `clock_typed_entries`; triggers `clock_sessions_typed_snapshot`,
  `clock_sessions_typed_record` (deferred), `clock_sessions_guard_approval`; `clock_session_approval_hold`,
  `approve_clock_sessions` (skips held) + `approve_clock_sessions_v2` (says how many), `confirm_clock_typed_entry`,
  `clock_typed_stamps`, `list_typed_hours_waiting`; switch `app_settings.typed_hours_second_look_v1`
  (`off` / `test` / `on`, seeded `test` = sample accounts and ZZ-named people only).
  Test bed: `npm run test:pg:typed-hours`.
- **One helper** — `src/lib/approveClockSessions.ts`; every approval view calls it.
- **The nine views** — `DashboardMyTeamSection`, `DashboardTeamActiveClockStrip` (+ `ClockSessionStripActionsModal`),
  `PeopleHoursDayAuditModal`, `PeopleHoursPendingCellPopover`, `UpcomingWeekSessionsModal`,
  `PeopleHoursApprovalsQueueModal`, `PeopleHoursBulkApprovePendingModal`, `PeopleHoursSessions`
  (`ClockSessionsTable`), `MoneyfillTimeQueuesSections`. A tenth caller, `quickfill/HoursSection.tsx`,
  is mounted nowhere and writes `people_hours` directly — delete it (PR 5).
- **Needs You** — `src/lib/dashboardNeedsYou.ts` (copy the `hours-approvals` card), hosts
  `DashboardPinnedQuickRow` and `QuickfillNeedsYouSection`.
- **The worker's door** — Job Mode shows no My Time; `DashboardJobModeCard`'s button grid and
  `DashboardMyTimeSection`'s footer row are the two places a field worker looks.
- **The grid** — `PeopleHoursGrid.tsx` blur handlers (desktop input and the phone day sheet) choose
  `saveHours` (a direct `people_hours` write) or a draft session; the grid does not know whether a
  day has approved sessions today.

## The plan

1. **PR 1 — the database** · shipped v2.4242. No screen changes.
2. **PR 2 — the stamp and the hold on the approval views** · shipped v2.4247. `approveClockSessions`
   calls `_v2` and falls back; `useTypedStamps(ids)` + `TypedHoursStamp` (full / compact / dot); each
   view shows the stamp, takes typed and held rows out of its *Approve all*, and says what it left.
3. **PR 3 — Needs You + "Looks right".** A card for dev / controller / office when typed hours wait
   on a second person; the approvals queue gets a *Typed by hand* filter and the approved-but-unlooked
   list with *Looks right*.
4. **PR 4 — the worker's door.** A small form (day, in, out, the job from that day's schedule, what
   happened) that inserts his own session; the ledger stamps it *typed by him, late*.
5. **PR 5 — the grid stop**, delete `quickfill/HoursSection.tsx`, and the dev switch in Settings.
6. Flip the switch to `on`; delete this folder.

## How to verify

- `npm run test:pg:typed-hours` (Docker, or `PGTEST_PGBIN=/usr/local/opt/postgresql@15/bin`).
- Live, while the switch reads `test`: the hold applies to **sample accounts and ZZ-named people
  only**. As the dev, type a day for a sample account from People → Hours; the row wears the stamp
  and the dev cannot approve it; *View as* the sample assistant and approve it — the entry reads
  confirmed. Reject or delete the test sessions afterwards.
- Known limits are listed in `docs/recent-features/v2.4242.md`.
