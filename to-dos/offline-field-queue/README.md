---
name: "Offline in the field: the phone keeps the press and sends it later"
number: 163
group: gated
status: proposed 2026-10-24 from the trade ERP comparison (gap 3 of 9) · waiting on how often crews lose signal and the clock-time rule
summary: >
  With no signal the phone only offers Retry, so the clock, a note and a field report all stop
  until the signal returns. The smallest useful version keeps a short queue on the phone: clock in,
  clock out, a job note and a field report wait there with the moment they were pressed and go out
  in order when the signal is back, today's schedule stays readable from the last read, and a plain
  list says what works offline and what does not.
next: The owner says how often crews lose signal and picks the clock-time rule (a late press is punched at the pressed time, or typed like a late entry); then a mock-up of the waiting-to-send line.
size: L as a train of five (S · M · M · S · S); maybe one migration for the clock's pressed time
blocker: The clock-time rule, which touches payroll.
opinion: build, after the clock-time rule; never queue a money write
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

## The decision (open)

- **How often crews lose signal**, on new builds, in basements, out of town. It sets how soon this
  matters.
- **The clock-time rule** for a press that reaches the server late:
  - **A. Punched at the pressed time**, trusting the phone's clock within a bound (say 12 hours),
    marked *sent late* for the approver.
  - **B. Typed**, through the late-entry path that already exists, so it waits for approval like
    any typed hours. Safer for payroll, one more approval for the office.
- **What never queues**: money (a payment, a bill, a card split), a send to a customer, anything
  with a signature that needs the server's stamp.

## The smallest useful version

1. **A queue on the phone** for four presses: clock in, clock out, a job note, a field report.
   Each waits with the moment it was pressed.
2. **It sends what is ready.** When the signal returns the queue goes out in order. A press the
   server refuses (the office changed the session meanwhile, say) stays on the phone with the
   server's reason and a door to fix it, and the rest still go.
3. **A line on the phone**: *2 waiting to send · last tried 10:14*.
4. **Today's schedule stays readable** from the last read, marked with when it was read.
5. **A plain list** in a help guide of what works offline and what does not.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The shell offline | `src/sw.ts` precache | — |
| A failed write | `OfflineRetryPanel`, `offlineRecoveryState.ts` | the queue takes over for the four presses |
| The queue | — | `lib/offline/outbox.ts`: which writes may queue, the order, the pressed-at stamp, the retry rule; pure and tested |
| Its store | — | IndexedDB on the phone, read and written through one hook |
| The clock | `clock_sessions`, `clock_typed_entries` | an RPC that takes the pressed time within the bound (rule A) or files a typed entry (rule B), likely one migration |
| Today's schedule | Job Mode, My Schedule | the last read kept on the phone |

## The plan

1. **The kernel.** The queue's rules, tested.
2. **The store and the clock.** The IndexedDB store, the replay hook, clock in and out through
   the queue, and the server side of the clock rule.
3. **Notes and field reports** through the queue.
4. **Today's schedule** from the last read.
5. **The guide**: what works offline.

## How to verify

In the browser pane set the network offline, clock in on a ZZ test job, write a note, file a
report, then go back online: the three land in order, the clock session carries the pressed time
(or the typed mark under rule B), and the line clears. On a phone, airplane mode does the same.
Refuse one on purpose (edit the session from the office while the phone is offline) and see it
held with its reason while the rest go.

## Open questions

- Rule A or B for the clock.
- Whether photos queue too, which waits on #164's choice of where photos live.
- How long a press may wait before it needs a person to look.
