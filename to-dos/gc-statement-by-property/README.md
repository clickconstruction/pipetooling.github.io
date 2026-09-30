---
name: "GC statement email: one property at a time, then the payments received"
number: 71
group: ready
status: asked and mocked up 2026-09-30 · PR 1 shipped v2.4255 (the total, one block per property, one line per bill with the payment on it, the QR code) · PR 2 not started
summary: >
  Grace's ask (2026-09-30, on GC Review's Draft Message): the statement a GC gets was one flat
  table sorted by address — a property with seven bills printed its street seven times, one
  property spelled four ways read as four places, nothing said what a property owed, and
  "nothing applied yet" sat on 16 of 19 rows. Redraw it one property at a time, show the
  payments made, keep the account link and add a QR code as the bill emails have. PR 1 shipped
  the layout in both lanes from one shared renderer. Left: the block the mock-up drew under the
  total — "Payments we have received", the GC's checks of the last 30 days and where each went.
next: >
  PR 2 — the payments block. Client: `fetchGcChecksInputs` + `buildGcChecksReport` already read a
  GC's checks (Find a check, the printed sheet); filter to the window, hand `received` rows to the
  renderer. Dispatcher: the kernel has to move to `_shared` (as `billPaidBy.ts` did) and the
  function read the same rows with the service role; then the renderer prints the block in both
  lanes and the parity test pins it. Settle the window first: 30 days, or since the last statement.
size: M (PR 2)
blocker: One call — 30 days, or since the last statement sent to this GC.
ver: v2.4255
opinion: soon — the bookkeepers' first question on a statement is "did you get my check", and the block answers it without a call.
---

# GC statement email: one property at a time, then the payments received

**The ask** (Grace, 2026-09-30, with the Sep 30 preview for RMC- Dudley Mason): "when a user goes to send an account statement it can be quite confusing when not broken down by property, also showing what payments have already been made… I like the link at the bottom and I think the link should stay but we should also offer a QR code like on other surfaces." Then, on the mock-up: "love it, build it."

**The mock-up**: [`mockup.html`](./mockup.html) (the canvas is https://claude.ai/artifact/S5Hed4KUdHHBYjaFuL1AZD) — a Proposed / Today switch over the same nineteen bills, numbered notes beside the paper, and the four calls to settle. The addresses, jobs and amounts owed are the preview's; the payments in the drawing are made up.

## The decision

- **The total first**, then one block per property with its subtotal, then one line per bill — job number, the day it was sent, what is still owed — and under a bill the payment recorded against it. The job's name shows only when it says something.
- **What counts as one property**: the job's property record (`jobs_ledger.customer_address_id`), else the cleaned address (`normalizeAddressKey`, the portal's rule). Never fuzzy: *Lenox Hill* and *Lenox Hl* merge only through the record.
- **Owed stays the board's figure; the payment line names only payments recorded against that bill.** The v2.4100 line walked unlinked money oldest-bill-first and so could read *paid in full* beside an amount owed (job 273). The office is told about money on the job and on no bill before it sends; whether the board should count that money the way the portal does is on [`owner-decisions-pending.md`](../owner-decisions-pending.md).
- **The QR code rides where a file can**: app sends attach it inline; Preview draws it; Copy for email pastes the card with the address and no code.
- **Payments we have received** (PR 2): the GC's payments of the last 30 days, newest first, each with the property and job it went to, under the line *If one you sent is missing, reply and we will find it.* Drawn as 30 days; "since the last statement we sent you" never shows a check twice.

## Where it plugs in

- The renderer, both lanes: [`supabase/functions/_shared/gcStatementByProperty.ts`](../../supabase/functions/_shared/gcStatementByProperty.ts) — `StatementRenderInput` is where PR 2's `received` rows go.
- Client mapping: [`src/lib/jobsDocuments/gcStatementEmail.ts`](../../src/lib/jobsDocuments/gcStatementEmail.ts) (`gcStatementBillsOf`); the rows: [`src/lib/gcReviewRollup.ts`](../../src/lib/gcReviewRollup.ts).
- Dispatcher mapping: [`supabase/functions/gc-statement-email-dispatch/render.ts`](../../supabase/functions/gc-statement-email-dispatch/render.ts) (`statementBillsOf`), the property read and the attachment in its `index.ts`.
- The GC's checks, read payment-first: [`src/lib/jobs/gcChecksApplied.ts`](../../src/lib/jobs/gcChecksApplied.ts) (`buildGcChecksReport`, `GcCheck.lines[]` says where each landed) and [`gcChecksAppliedIo.ts`](../../src/lib/jobs/gcChecksAppliedIo.ts) (`fetchGcChecksInputs`). For the dispatcher, the kernel moves to `_shared` and the function reads jobs + payments + moves with the service role.

## The train

1. **PR 1 — the layout** (v2.4255, shipped): the shared renderer, both mappings, the QR code on both send paths, the office note, the guide.
2. **PR 2 — Payments we have received**: the block in both lanes. Client first (the loader exists); the dispatcher needs the kernel in `_shared` and a service-role read. The parity fixture gains a check that paid a bill on a job that is now paid off — the case the statement's own rows cannot see.

## How to verify

- Unit: `gcStatementByProperty.test.ts`, `gcStatementEmailParity.test.ts`.
- Live: dev login → Jobs → Stages → **GC Review** → RMC- Dudley Mason → **Draft Message** → **Preview**. Expect the Lenox block as one (seven bills), $84,601.00 as of 2026-09-30, the note *Paid on the job, not on a bill: Job 273 $38,780.00*. Send to yourself on **ZZ TEST GC** to see the code arrive in Gmail and Apple Mail — a send writes the audit row and the GC's last-sent date, so never on a real GC.
- Scheduled lane: schedule a send to yourself on ZZ TEST GC for a minute ahead; the email should match Preview and carry the code.
