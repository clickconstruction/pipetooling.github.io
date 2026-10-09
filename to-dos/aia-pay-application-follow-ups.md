---
name: "AIA G702-G703: what the history train left"
number: 92
group: ready
status: the history train shipped 2026-10-06 (v2.4710 #4720, v2.4714 #4723, v2.4715 #4724, types #4731; both migrations pushed) · Restore (v2.4883) and Put the amounts back (v2.4885) shipped 2026-10-07 · the paid line shipped 2026-10-09 (v2.5032) · left: Taunya's look on a phone
summary: >
  The pay application window now opens on the job's history: where the job stands, one line per
  application with who saved it and each workbook that went out, a warning naming what changed
  after a workbook went out, and deleted applications kept as quiet lines. Four pieces were drawn
  or raised and left: putting a deleted application back, showing what the GC actually paid on
  each application, a one-press "put the amounts back" on the changed-after warning, and whether
  a phone should land on the history or the form.
next: Taunya's look on her phone decides item 4.
size: a look (4)
blocker: Item 4 waits on Taunya.
ver: v2.4710 · v2.4714 · v2.4715 · v2.5032
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

1. **Restore a deleted application** — shipped v2.4883 (*Put it back* on the deleted line, in the
   window's history and on the Documents tab; the history also opens when only deleted
   applications remain).
2. **A paid line** — shipped v2.5032 (the owner's call of 2026-10-09: the office picks the bill an
   application became). `job_pay_applications.invoice_id` is set on the application's line in the
   history (**Tie a bill…**) or from Bill Customer's *This bill is pay application* line, and the
   amount-and-date match only pre-fills the pick. The history reads *Paid $13,588.20 · Aug 22* under a
   tied application from the bill's payments the way the job window's bills do, and *Bill not yet
   tied* on a dashed edge under an untied one. Section C was the drawing.
3. **Put the amounts back** — shipped v2.4885 (the open form names what moved since the newest
   workbook went out, and *Put the amounts back* rebuilds it from that workbook's snapshot, unsaved).
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
