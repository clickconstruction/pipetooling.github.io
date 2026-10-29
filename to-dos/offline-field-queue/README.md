---
name: "Offline in the field: the phone keeps the press and sends it later"
number: 163
group: ready
status: building on claude/163-offline-queue-pr1 … pr5 · PR 1 built (v2.6074, the outbox kernel, PR #6472) · PR 2 built (v2.6099, the store, the bar on the strip, clock in and out through the queue, the `land_field_press` RPC and `field_presses`) · step 4 taken by #183 PR 3 (v2.6059) · the five calls taken on the review canvas of 2026-10-29 (rule B for the clock, one workday's wait, no photos in this train, money and sends never queue, the bar on #183's strip) · proposed 2026-10-24 from the trade ERP comparison (gap 3 of 9) · the bar at the top set the same day · mock-up drawn 2026-10-26 · the bar's green with Got it, its red, and the per-press id decided the same afternoon (#183, part 3)
summary: >
  With no signal the phone only offers Retry, so the clock, a note and a field report all stop
  until the signal returns. The smallest useful version keeps a short queue on the phone: clock in,
  clock out, a job note and a field report wait there with the moment they were pressed and go out
  in order when the signal is back. A bar at the top of the screen shows whenever anything has not
  uploaded yet or is still waiting to happen, today's schedule stays readable from the last read,
  and a plain list says what works offline and what does not.
next: PR 3, notes and field reports through the queue (the RPC's two more kinds, one migration); then PR 5 the guide and the card's deletion. PR 4 is only this card's note, since #183 PR 3 (v2.6059) keeps today's schedule for My Schedule and Job Mode.
size: L as a train of five (S · M · M · S · S); two migrations (the clock's RPC and table, then the two more kinds)
blocker: none; the clock-time rule is B (2026-10-29)
opinion: build; never queue a money write
---

# Offline in the field: the phone keeps the press and sends it later (#163)

## The ask

The owner, 2026-10-24: *"Draft to-dos in the repo for the top five gaps, each with its smallest
useful version, as one docs PR."* This is gap 3 of the trade ERP comparison the owner ran the same day.
The owner kept its weight at 2 of 3. Its gap is 2, so it scores 4, tied with #161 and #162.

This is a proposal. Nothing here is built until the owner picks.

## What the comparison found

- ServiceTitan's field app keeps job status, time, signatures, notes, photos and estimates
  working offline, and publishes a plain list of what needs a connection.
- Service Fusion documents its offline mode area by area. Simpro's app works mostly offline.
  Successware has a dedicated offline mode.
- Others are thin: Housecall Pro is view only for a few days of jobs, and Jobber is read only.
- Field apps that break without signal are one of the complaints reviewers repeat across vendors.

## Today

- **The app's files** are precached by the service worker ([`src/sw.ts`](../../src/sw.ts),
  workbox, with the single-page fallback and the push handler), so the shell can open, but every
  read and write goes to the database live.
- **A failed write** shows [`OfflineRetryPanel`](../../src/components/OfflineRetryPanel.tsx)
  over `lib/offlineRecoveryState.ts`: a network failure gets Retry, and nothing is kept.
- **The clock** writes `clock_sessions` from the Dashboard and Job Mode. A session is punched or
  typed (v2.4242, `clock_typed_entries`, [`lib/clock/typedHours.ts`](../../src/lib/clock/typedHours.ts)):
  a person's own typed hours are a late entry that waits for someone else's approval.
- **Notes and field reports** write the job's activity and `reports` live.

## The decision

**Decided 2026-10-24: a bar at the top.** The owner: *"for 163 it has to show a bar at the top when
something has not uploaded yet or is waiting to happen."* The bar is the queue's one face. It is
there on every screen while anything waits and gone when nothing does.

**Decided 2026-10-29**, on the review canvas Taunya approved for the owner, every call as
recommended:

- **The clock-time rule is B.** A clock press that reaches the server after the fact files a
  typed entry through the late-entry path that already exists (`clock_typed_entries`,
  [`lib/clock/typedHours.ts`](../../src/lib/clock/typedHours.ts), v2.4242), with the phone's
  pressed time filling the entry's times and a sent-late mark, so it waits for approval like any
  typed hours. The live session runs from the moment the press lands. Rule A is not built.
- **A press may wait one workday.** A press still waiting the next morning turns the bar red with
  its reason and a door, the same face a refused press has.
- **Photos do not queue in this train.** That is #189's PR 7, later, on this queue.
- **What never queues**: a payment, a bill, a card split, a send to a customer, anything needing
  the server's stamp on a signature.
- **How often crews lose signal** was not answered; the train is built either way.

## The mock-up

[`mockup.html`](./mockup.html) beside this file (drawn 2026-10-26, made-up data): today's lost
press and its two bad choices, the queue with the bar waiting and held amber, and the clock-time
rules A and B drawn side by side as the approver would see them.

## The smallest useful version

1. **A queue on the phone** for four presses: clock in, clock out, a job note, a field report.
   Each waits with the moment it was pressed.
2. **It sends what is ready.** When the signal returns the queue goes out in order. A press the
   server refuses (the office changed the session meanwhile, say) stays on the phone with the
   server's reason and a door to fix it, and the rest still go.
3. **A bar across the top of every screen** while anything has not uploaded yet or is still
   waiting to happen: *2 waiting to send · last tried 10:14*. A tap lists each waiting press with
   when it was pressed. A press the server refused turns the bar red with its reason and its door,
   and stays until the door is opened. When a press lands the bar turns green, *Clock in from
   7:58 AM sent ✓*, and waits for **Got it**; several at once read *3 sent ✓ · see them ›*. A
   resend is quiet, shown only as the countdown to the next try. The owner's call of 2026-10-26,
   drawn in #183's mock-up as the press's life on the strip, which the bar shares with the slow
   line ([`honest-and-fast`](../honest-and-fast/README.md), part 3 of the plan).
4. **Today's schedule stays readable** from the last read, marked with when it was read.
5. **A plain list** in a help guide of what works offline and what does not.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The shell offline | `src/sw.ts` precache | — |
| A failed write | `OfflineRetryPanel`, `offlineRecoveryState.ts` | the queue takes over for the four presses |
| The queue | — | `lib/offline/outbox.ts`: which writes may queue, the order, the pressed-at stamp, the retry rule, and a per-press id made on the phone so a send that lands twice counts once; pure and tested. The server side of each of the four presses takes the id |
| Its store | — | IndexedDB on the phone, read and written through one hook |
| The clock | `clock_sessions`, `clock_typed_entries` | an RPC that takes the pressed time within the bound (rule A) or files a typed entry (rule B), likely one migration |
| The bar | the app's top chrome (`--app-top-chrome` in `src/index.css`, under the iPhone's status bar) | a bar fed by the queue, on every page, below the status bar and above the windows (`npm run check:status-bar`, `check:window-z`) |
| Today's schedule | Job Mode, My Schedule | the last read kept on the phone |

## The plan

1. **The kernel.** The queue's rules, tested.
2. **The store, the bar and the clock.** The IndexedDB store, the replay hook, the bar at the
   top, clock in and out through the queue, and the server side of the clock rule.
3. **Notes and field reports** through the queue.
4. **Today's schedule** from the last read.
5. **The guide**: what works offline.

## How to verify

In the browser pane set the network offline, clock in on a ZZ test job, write a note, file a
report: the bar at the top reads *3 waiting to send*. Go back online: the three land in order,
the clock session carries the pressed time (or the typed mark under rule B), and the bar turns green, *3 sent ✓*, until Got it. Send the same press twice on purpose and see one session. On a phone, airplane mode does the same.
Refuse one on purpose (edit the session from the office while the phone is offline) and see the
bar turn red with that one's reason while the rest go green.

## Where it stands

- **PR 1 built** (v2.6074, PR #6472): the kernel [`lib/offline/outbox.ts`](../../src/lib/offline/outbox.ts),
  the rules above as code, every word the bar and the list will read, 42 tests.
- **PR 2 built** (v2.6099): the IndexedDB store under one in-memory store, the replay hook mounted
  in `Layout`, the bar as the strip's second segment with its list, clock in and out through the
  queue on the Dashboard's button and Job Mode, the line beside the clock, and the migration
  `20261029230000_field_presses.sql` (the table and the `land_field_press` RPC; rule B as one row
  at the pressed time, the typed-hours trigger filing the stretch). **Pushed by hand after the
  merge**: `supabase db push`, then the types chore.
- **Step 4 of the plan**, today's schedule from the last read, shipped as #183's PR 3 (v2.6059,
  `useKeptRead` keyed by the day for My Schedule and Job Mode). Nothing left to build here.
