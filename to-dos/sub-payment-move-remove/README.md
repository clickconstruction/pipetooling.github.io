---
name: Sub payments — move or remove, the rest
number: 22
group: residual
status: >
  PR 1 shipped v2.3562 (the sub sheet) · PR 3 shipped v2.3576 (Move to job… on Edit Job →
  Payments received, with the trace; migration 20260917180000) · PR 2 shipped v2.3605 (the
  portal's trace) · the sheet's live move ran 2026-09-19 on two throwaway sheets and found two
  bugs, fixed in v2.3625 · left: one live move on a throwaway job (Edit Job → Payments received)
summary: >
  **A payment recorded on the wrong job can now be moved to the right one** instead of
  deleted and retyped. Shipped for sub sheets (Jobs → Subs → Pay): every payment and
  backcharge row carries Edit · Move… · Remove, Move lists the same sub's other sheets first
  and previews both sheets' paid and owed, Remove asks why and can be undone for 30 days,
  and both sheets keep a grey trace line. Two pieces are left — carrying that trace to the
  **sub's own portal** so a sub does not phone about a payment that vanished, and putting
  the same **Move to job…** on customer payments in Edit Job, where only a sent bill may
  refuse the move.
next: >
  One move on a throwaway job (J1032 *ZZ TEST GC Notice Job* → J1023, the recipe below), then
  the folder closes; the three wording / policy calls stay open until asked.
size: XS — a live test
blocker: >
  None for PR 2. Three wording / policy calls in *Open questions* are the owner's and change
  one constant each.
ver: v2.3562 · v2.3576 · v2.3605 · v2.3625
opinion: your call — the sheet half is proven; the job half leaves a real $1 customer payment on a test job, so it is yours to sit through.
---

# Sub payments — move or remove, the rest

## The ask, in the owner's words

Taunya, 2026-09-17, an in-app request: *"I want to be able to delete a payment that was
applied to the wrong job."*

Read literally that is a delete, and a delete already existed — but only inside the Edit
dialog, reached from a grey **Edit** button that says nothing about removing anything. What
she actually hit is the wrong-job case, where deleting is the wrong verb: the money is real
and belongs on another sheet, so the fix is to carry it there, not to destroy it and retype
it. PR 1 built both, with Move as the recommended door and *Wrong job* on the Remove dialog
pointing at it.

## What shipped (v2.3562, on main, migration pushed)

- **The row.** Every payment and backcharge in a sheet's Payments table carries **Edit ·
  Move… · Remove**; below 640px it is Edit and a **⋯** menu with 44px items. The Edit
  dialog's own Remove hands the row to the reason dialog.
- **Move this payment.** The same sub's other sheets first (shared assignee, else the
  sheet's name, each with its date), a search that opens every sheet, and a *What changes*
  panel reading both sheets before and after (paid, owed, *paid in full*). The amount, date,
  memo and portal visibility travel with the row.
- **Remove this payment?** Reason chips — *Duplicate entry · Wrong amount · Something else*
  — and **Wrong job → Move it instead**. The row is deleted and its snapshot kept, so every
  existing reader stays correct with no filter; **Undo** restores it for 30 days.
- **The trace.** `people_labor_job_payment_events` (`kind` moved · removed · restored, both
  sheet ids, the snapshot, the reason, the actor) drives a grey line on both sheets and on
  the ledger's expanded row: *Moved → 922 Michael Palmer · Taunya · wrong job*.
- **Verified in prod**: the three RPCs answer as the caller (`SECURITY INVOKER`), reject an
  unknown id with `P0002`, and the events read returns 200. **No real payment has been moved
  yet** — see *How to verify*.

Files: kernel [`src/lib/jobs/subPaymentMoveRemove.ts`](../../src/lib/jobs/subPaymentMoveRemove.ts)
(+11 tests), dialogs [`SubLaborPaymentMoveRemoveModals.tsx`](../../src/components/jobs/SubLaborPaymentMoveRemoveModals.tsx),
the hook [`useSubLaborLedger.ts`](../../src/hooks/useSubLaborLedger.ts), migration
[`20260917140000`](../../docs/migrations/20260917140000_people_labor_job_payment_events.md).

## The mock-up

[`before-after.html`](./before-after.html) — the two remaining boards: the sub's portal
before and after, and Edit Job → Payments received with Move and the sent-bill refusal. The
full five-board canvas PR 1 was built from is
[design canvas — Delete or move a payment](https://claude.ai/artifact/KevTT7eXyDAi4MENU5GAa8).
Read the page's *Assumptions* block
before building; it names the places the design is a guess rather than a decision.

## PR 2 — the trace on the sub's portal — SHIPPED v2.3605

Today a sub whose payment moved sees it simply gone and their open balance jump, with
nothing to read. The office sheet explains itself; the portal does not.

| Exists | Change |
|---|---|
| [`sub-portal/index.ts`](../../supabase/functions/sub-portal/index.ts) — loads `people_labor_job_payments` for the sub's sheets | Also load `people_labor_job_payment_events` for those sheet ids |
| [`_shared/subPortalStatement.ts`](../../supabase/functions/_shared/subPortalStatement.ts) — `buildSubPaymentLines(payments, sheetsById, sinceYmd)` | A sibling that turns events into lines, same `sinceYmd` window, same newest-first sort |
| [`SubPortal.tsx`](../../src/pages/SubPortal.tsx) — the ledger list | Grey struck-through rows: *Moved to 922 Michael Palmer by the office* · *Removed by the office* |

Rules the drawing settled: the portal says **what happened and that the office did it, never
the internal reason**; only the sheet a payment *left* draws a line, because the destination
sheet already lists the payment itself; totals are untouched, since the events are not money.

**Deploy**: `supabase functions deploy sub-portal`. No migration.

## PR 3 — Move to job… on customer payments — SHIPPED v2.3576

Built as drawn: the button on every saved row (disabled with *unlink it from the bill first* on a sent bill's payment; absent on Stripe), the dialog with the job search and the What-changes panel, `move_jobs_ledger_payment`, the trace on both jobs. `docs/recent-features/v2.3576.md`.

The same wrong-job mistake happens on Edit Job → Payments received, where Remove and
*Unlink & remove* exist but nothing carries a payment to the right job.

| Exists | Change |
|---|---|
| [`JobFormPaymentsTable.tsx`](../../src/components/jobs/JobFormPaymentsTable.tsx) — per-row Remove, `canUnlinkMercuryPayment` gating *Unlink & remove*, the Stripe lock | **Move to job…** beside them, on rows no sent bill has counted |
| [`jobFormPaymentPredicates.ts`](../../src/lib/jobs/jobFormPaymentPredicates.ts) — `canRemovePaymentRowFromForm`, `paymentRowLinkedToInvoice`, `stripeBillInvoiceForPaymentRow` | `canMovePaymentRow` beside them (+tests): false when a sent bill counted the row, false for Stripe |
| [`JobFormModal.tsx`](../../src/components/jobs/JobFormModal.tsx) — the Remove and Unlink confirms | The Move dialog, reusing the sub sheet's shape and its what-changes panel |
| A migration | `jobs_ledger_payments` events + a `move_jobs_ledger_payment` RPC, shaped like `move_labor_job_payment`; the bank-deposit link moves with the row so Accounts Receivable still reads the deposit as applied |

**The rule worth keeping**: a payment a **sent bill already counted does not move**. The
customer was told a number, so the existing unlink-from-bill path comes first and the row
says so, rather than moving and silently re-opening a bill.

## Open questions

- **The portal's wording.** Does a sub see the office's reason (*Duplicate entry*), or only
  that the office moved or removed it, as drawn? Recommended: only the fact. It is an
  internal note, and "Duplicate entry" reads like an accusation.
- **The undo window.** 30 days is my number, not a rule from anywhere in the app. Shorten it
  to a week, or leave it.
- **Backcharges.** A backcharge moves exactly like a payment today. If a backcharge should
  never leave the sheet it was raised on, say so and it becomes one guard in the kernel.

## The live run — 2026-09-19

Run on two throwaway sheets for *Claude Test Sub* on J1032 *ZZ TEST GC Notice Job*
(`ZZ TEST move-remove sheet A` / `sheet B`, $10 each, one $1 payment). Steps 1–6 below passed
— the other sheet topped the list, *What changes* matched, both sheets and the ledger's
expanded row drew the grey line, Remove with *Duplicate entry* carried Undo, Undo restored
the payment — and found two bugs, fixed in v2.3625: the Payments table was wider than the
400px form (Date clipped on a desktop; the phone's ⋯ with Move and Remove off-screen), and
the trace line was dated in UTC (an 8:50 PM move read as tomorrow, on the portal too).

Two observations, not changed:

- **The verbs live on Edit sheet only.** The expanded ledger row lists the payments with no
  Edit · Move… · Remove; the office has to know to press **Edit**. Taunya's original
  complaint was a delete hidden inside a dialog.
- **Two sheets for one sub on one job read identically** in the Move list and in *What
  changes* (`1032 ZZ TEST GC Notice Job → 1032 ZZ TEST GC Notice Job`). The sheet date is on
  the list row; nothing tells them apart in the panel.

The two test sheets are still there (step 7 not run) — delete them from Edit sheet → Delete.

**Still owed: the job half.** On J1032 → Edit Job → Payments received, record a $1 payment,
**Move to job…** to J1023 *Water Sample Test*, check *What changes* and the grey lines on both
jobs, then remove the payment on J1023. It writes a real customer payment and a permanent
trace on both jobs, so use the test jobs only.

## How to verify

The sheet recipe (run 2026-09-19 — see above). A real move writes a permanent trace line the
subcontractor can see on their portal, so it needs a throwaway sheet.

1. `npm run dev`, then `/dev-login?as=1&to=/jobs?tab=subs%26view=pay` (signs in as Robert, dev).
2. Make a **throwaway sheet** for a test sub, record a $1 payment on it, and make a second
   throwaway sheet for the same sub.
3. On the payment row press **Move…**; the second sheet should top the list. Check the
   *What changes* panel against the two sheets' own totals, then move it.
4. Both sheets should now show the grey line, one *Moved →*, one *Moved here from*. The
   ledger's expanded row shows the same.
5. **Remove** the payment on the destination with reason *Duplicate entry*; the line reads
   *Removed · <you> · Duplicate entry* and carries **Undo**. Press Undo and confirm the
   payment comes back at the end of that sheet's list.
6. Narrow the window under 640px and confirm the row collapses to Edit and a ⋯ menu.
7. Delete both throwaway sheets.

Do **not** rehearse this on a live sub's sheet: every move and removal is permanent on their
portal, and the trace line names whoever did it.
