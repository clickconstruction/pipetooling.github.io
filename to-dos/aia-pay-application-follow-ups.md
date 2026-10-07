---
name: "AIA G702-G703: what the history train left"
number: 92
group: residual
status: the history train shipped 2026-10-06 (v2.4710 #4720, v2.4714 #4723, v2.4715 #4724, types #4731; both migrations pushed) · left: Restore, a paid line, Put the amounts back, Taunya's look on a phone
summary: >
  The pay application window now opens on the job's history: where the job stands, one line per
  application with who saved it and each workbook that went out, a warning naming what changed
  after a workbook went out, and deleted applications kept as quiet lines. Four pieces were drawn
  or raised and left: putting a deleted application back, showing what the GC actually paid on
  each application, a one-press "put the amounts back" on the changed-after warning, and whether
  a phone should land on the history or the form.
next: Taunya's look on her phone first (it decides item 4); then build 3 and 1, which need no new data. Item 2 needs the owner's yes on how an application is tied to a bill.
size: S each (1, 3) · M (2) · a look (4)
blocker: None for 1 and 3. Item 2 waits on the owner's call on the bill tie; item 4 on Taunya.
ver: v2.4710 · v2.4714 · v2.4715
opinion: later — the history answers the owner's question today; build 3 the first time someone hits the warning, 2 when the office asks what was paid on an application.
mockup: the train's mock-up and its critique — https://claude.ai/artifact/7x1hxdFQbgdoh9RRhhLHeB (section C)
---

# AIA G702-G703: what the history train left

## The ask

The owner, 2026-10-06: *"In the tool, are we able to see the history of what was created in the
tool for the job previously?"* A mock-up drew today's chips, a six-column ledger, a critique of that
ledger, and the version that survived it (C). The owner said *build C*, and it shipped the same day
as three PRs. This file holds what C drew or the critique raised but the train did not build.

## What shipped (for orientation)

- **v2.4710 #4720** — the window opens on the history on a job with saved applications
  (`src/components/jobs/AiaG702G703History.tsx`, kernel `src/lib/aiaPayApplicationHistory.ts`):
  the standing, one line per application with *Saved … by …* and each kept workbook from
  `sent_documents` (kind `pay_application`, by `source_id`), **New application · N**. The Documents
  tab table gained *Went out* and *Saved*.
- **v2.4714 #4723** — Generate files the application's figures with the workbook
  (`sent_documents.source_snapshot`); `changedAfterWentOut` names each amount a later save moved.
- **v2.4715 #4724** — Delete marks the row (`job_pay_applications.deleted_at / deleted_by`, one live
  application per number); deleted applications list after the live ones with their workbooks.

## What is left

1. **Restore a deleted application** (S). The database already allows it: clear `deleted_at` and
   the stamp trigger clears `deleted_by`; the partial unique index refuses a restore onto a number a
   live application now holds (the SQL bed's case 10 covers both). Missing: a *Put it back* button
   on the deleted line in the history and on the Documents tab row, an IO call in
   `aiaPayApplicationsIo.ts`, and the words when the number is taken (*Application 1 is live again
   on this job. Delete it or give this one another number first.*).
2. **A paid line** (M, the owner's call first). C drew *Paid $13,588.20 · Aug 22* under each
   application with a dotted edge, *bill not yet tied*. No application is tied to a bill today.
   The call: does the office pick the bill an application became (a nullable
   `job_pay_applications.invoice_id`), or does the app match by amount and date? Then the line reads
   the bill's payments the way the job window's money card does.
3. **Put the amounts back** (S). The changed-after warning names each amount that moved since the
   newest workbook went out, but offers no press to undo it. The carry-mismatch warning already has
   *Use application N's amounts* (`withCarriedAmounts`); the same shape here would rebuild the form
   from `parsePayApplicationSnapshot(copy.sourceSnapshot)` and leave it unsaved for a Save.
4. **History or form first on a phone** (a look). C opens the history first everywhere a job has
   saved applications; the monthly typist loses one tap. Ask Taunya on her phone whether the history
   is what she wants to see first there, or the new application.

## Where it plugs in

`src/components/jobs/AiaG702G703Modal.tsx` (the `view` state, `startOn`), `AiaG702G703History.tsx`,
`JobWindowDocumentsTab.tsx`, `src/lib/aiaPayApplicationHistory.ts` (`changedAfterWentOut`,
`parsePayApplicationSnapshot`), `src/lib/aiaPayApplicationsIo.ts` (`loadDeletedPayApplications`,
`deletePayApplication`), the guide `fill-out-an-aia-g702-g703`.

## How to verify

Render smokes beside each component (`AiaG702G703Modal.render.test.tsx` has the history cases);
the SQL bed `npm run test:pg:pay-applications` (Docker) for anything that touches the table.
