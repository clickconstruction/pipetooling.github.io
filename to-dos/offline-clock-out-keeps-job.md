---
name: "A clock-out made with no signal clears the session's job"
number: 228
group: ready
status: found 2026-10-31 in v2.6198's live check on clicktooling.com · not started
summary: >
  A clock-out pressed with no signal is kept on the phone and lands later. But the session it closes
  loses its job, and its hours read *No Job or Bid*. With no signal, the clock-out window cannot load
  the job the person is clocked into, so its job pick is empty. The kept press carries that empty
  pick, and the server's clock-out writes it over the session's job. The window also has a Clear
  for removing the job on purpose, so an empty pick cannot simply be read as "keep the job".
next: Keep the session's own job and bid on a clock-out unless the person picked another or pressed Clear, with a render smoke that clocks out with no signal and reads the kept press's job.
size: S
blocker: None.
ver: v2.6099 · 6198
opinion: build — a kept clock-out should never move hours off the job
mockup: not required — no screen changes; the job a clock-out sends is fixed
---

# A clock-out made with no signal clears the session's job

## What happened

v2.6198's live check on clicktooling.com, on 2026-10-31 at 1:55 to 1:58 AM, used the dev login on ZZ Test (J1085):

- Clock In was pressed with no signal on ZZ Test. The kept press carried ZZ Test's id, and it landed as a session on ZZ Test.
- Clock Out was pressed with no signal on that session. The kept press carried `jobLedgerId: null`.
- It landed and closed the session at the pressed moment. The session's day editor then read *No Job or Bid*.

The test session was rejected and deleted the same night. The cause is in three places.

1. **The window cannot load the job.** `openClockOutReviewModalOnly` in `src/components/ClockInOutButton.tsx` empties the pick. Then an effect loads the session's job (`jobs_ledger`) or bid (`bids` with its customer). That read fails with no signal, and the effect sets the pick to null.
2. **The kept press carries the empty pick.** `handleCompleteClockOutReview` sends `jobLedgerId` and `bidId` from the pick. `landFieldPress.ts` always maps them to `job_ledger_id` and `bid_id`, even when they are null.
3. **The server clears the job.** `land_field_press`'s clock-out sets `job_ledger_id` whenever the key is in the payload, even as null. That code is in `supabase/migrations/20261030040000_field_presses_notes_reports.sql`. It keeps the job only when the key is absent.

Job Mode's direct apply (`applyUpdateFocusDirectImpl`) is not affected: it sends the open session's own job and bid. Online, the same loss can happen if the window's read fails at the moment of clock-out. That is rare, since the read lands first.

## The decision

The window's **Clear** on the job chip removes the job on purpose. An empty pick therefore means one of two things: "cleared" or "never loaded". The fix has to tell them apart.

The proposal is to track whether the person touched the pick, meaning they picked a job or pressed Clear. If they did not, the clock-out keeps the job the person is clocked into: `openSession.job_ledger_id` and `bid_id`. The clock knows those with no signal, from the open session it already drew. If they did, the pick stands, empty or not.

The window could also draw the chip from the session's own ids when its read fails, so the person sees the job will stay. That is optional, and it is a screen change.

## The plan

One PR, client only:

1. A pure kernel for "which job a clock-out sends", given the pick, whether it was touched, and the open session, with unit tests.
2. `handleCompleteClockOutReview` uses it.
3. A render smoke cuts the signal with the window open and presses Complete clock out. The kept press must carry the session's job. A second case presses Clear first, and the press then carries none. The smokes in `src/components/ClockInOutButton.keptClockOut.render.test.tsx` show how to stub the reads and keep a press.
4. Add a release note and a `docs/recent-features/` fragment. Then delete this card.

No migration is needed. The server already keeps the job when the key is absent, but the client sends the job it means instead of omitting keys.

## How to verify

Live on clicktooling.com after the deploy, use the recipe in `docs/recent-features/v2.6198.md`. That means a `window.fetch` stub rejecting `*.supabase.co` outside `/auth/v1/`, `navigator.onLine` set to false, and an `offline` event.

1. Clock in on ZZ Test and let it land.
2. Cut the signal and clock out.
3. Bring the signal back.
4. The session's day editor must still read ZZ Test.

Delete the ZZ session afterwards: reject it, then delete it from People → Hours → Rejected Sessions. Its `field_presses` rows have no delete in the app.
