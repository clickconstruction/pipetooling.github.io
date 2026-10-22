---
name: "Accounts payable: an aging cell opens onto the invoices behind it"
number: 132
group: waiting
status: built and live 2026-10-21 — proposed, clarified twice, mocked up and approved 2026-10-20 ("Build it", on the recommended defaults for all nine calls); PR 1 the cell modal (v2.5673 #5911), PR 2 the chip as an act (v2.5675 #5915), PR 3 the move window (v2.5677 #5927; migration 20261020130000 pushed, edge request-job-account-move deployed, the test-mode send verified end to end); the Needs You line on the Dashboard and Quickfill on the owner's ask of 2026-10-21 (v2.5723, decision 8 amended); PR 4 (the doors) waits on real use
summary: >
  The aging heat map on Supply houses → Accounts payable sums unpaid invoices into cells —
  a house's 60–90 dollars, the No due date column, the footer totals — and none of those
  numbers has a door. To see which papers make up a cell, the office clicks the row, the whole
  house expands with every invoice, and the bucket is rebuilt by eye from the "Nd past due"
  chips. After: a cell with money in it opens a modal listing exactly the invoices the kernel
  summed into it — number, PO, dates, the past-due chip, the Job acct chip, the scan link —
  with the house's door at the bottom. Totals cells open the same modal across houses, and the
  No due date cell becomes the fix-it door its nudge sentence already points at. The Job acct
  chip on each row is an act, not just a mark. And because a house moves a charge onto the
  job account only while the invoice is Current, a movable row opens a move modal instead of
  flipping a flag: either an attested call (a checkbox — "I called the house, it was moved" —
  gates Mark it moved) or an emailed request to the house's job-accounts rep, sent from the
  app and followed up by phone, the ask recorded and aged until confirmed. A strip counts the
  still-movable dollars and the soonest closing window, and a worked list groups them by
  house with the rep's phone and a one-send email per house. Same pattern as the Dashboard
  money cards and GC Review's bill lines: a money number opens onto the papers behind it.
  Client-only except PR 3's one small table and one edge function for the emailed ask.
next: >
  A few days of real use of the cell modal, the chips and the move window, then PR 4 — the
  doors out of the modal (row press opens the invoice through the house detail, Add a due
  date on the No due date rows, Pick a job on job-less rows, Make a payment on house-scoped
  modals). The plan's PR 4 section below is the spec.
size: S (PR 1 — kernel, widened select, read-only modal) + S (PR 2 — the Job acct chip flow) + M (PR 3 — the move window: modal workflow, migration, edge function) + S (PR 4 — the doors out of it)
blocker: "Time: a few days of real use before PR 4."
ver: v2.5673 (PR 1, the cell modal) · v2.5675 (PR 2, the chip as an act) · v2.5677 (PR 3, the move window) · v2.5723 (the Needs You line, decision 8 amended)
opinion: build — the cell already knows exactly which papers it summed; making the office re-derive that by eye before every credit-desk call is the kind of detour the rest of the app has already paved over.
---

# Accounts payable: an aging cell opens onto the invoices behind it

Mock-up: [`mockup.html`](./mockup.html) — the table as it is, the table with doors, and the
modal three ways (a house's bucket, the No due date cell, a footer total). The data is made up.

## The ask, in the owner's words

2026-10-20, with a screenshot of the aging map: "On this particular screen, I would like to be
able to click on a cell and have it show me the invoices that make up that cell in a modal."

## The three lenses

**The seat.** The person at this screen is the office — the assistant who pays the houses and
the owner reading where the money sits. The heat map answers "how bad" at a glance; the moment
it works ("why is 60–90 at $24,932?") the screen stops helping. Today's path: click the row →
the house expands far below with *every* invoice → scan the Due column's "Nd past due" chips
and mentally rebuild the bucket. The cell already knows its papers; the person re-derives them.

**The job behind the ask.** The cell is read right before an act: calling the house's credit
desk about the 60–90 money, reconciling a monthly statement, picking today's payment run. Each
of those needs the same list — invoice numbers, amounts, the scan — not the house's whole
ledger. Two cells are themselves chores: the **No due date** column's own intro sentence says
"open the house and add one to place it" (a nudge with no handle), and the teal **job acct**
line under a cell says some of this is the owner's debt — which papers?

**The whole office.** The app's standing pattern is *a money number opens onto the papers
behind it*: the Dashboard's AP/AR cards drill to items and then to the bill itself
(`ItemsModal` → `ApBillModal` in `DashboardFinancialsSection`), GC Review's totals open
`GcBillLines`, a bid's price opens its breakout (#128). This matrix is the one money surface
whose numbers are painted on. The modal reuses the invoice-row vocabulary the office already
knows from the expanded house (same chips, same credit pairing line, same View link), so
nothing new has to be learned.

## The decision (proposed)

Click any **cell with money in it** → a modal titled with the house and the bucket
("Bluebonnet Supply — 60–90 days past due · $13,216.08") listing exactly the invoices the
kernel summed into that cell, oldest due first:

- **Row**: invoice # (with the v2.5035 credit-pairing line), PO #, invoice date, due date with
  the exact "Nd past due" chip the expanded house uses, the Jobs cell (Job acct chip + job
  numbers), amount, View (the scan) — the same columns as the house's Invoices table, minus
  Paid/Actions in PR 1.
- **Footer**: the cell's total (always equal to the cell — same kernel, same EPSILON), the
  "of this, $X job acct" line when *Mark job-account invoices* is on, and **Open <house> ›**
  (the existing `openHouseFromAging`).
- **Totals-row cells** open the same modal across houses, rows grouped under a small house
  heading. The **Owed / Total** column cell = all the house's unpaid invoices. **Credits
  open** cells list the open credit memos with their pairing lines.
- **No due date** cells: each row carries **Add a due date ›** (PR 4) — the nudge sentence
  finally gets its handle.
- **The Job acct chip is the act, not just the mark** (PR 2, the owner's ask on 2026-10-20):
  see *Flagging job accounts from the modal* below.
- A cell with a dash stays a dash. The row's click still opens the house; a cell click stops
  propagation. Cells become real buttons (focusable, Enter opens).
- **Not in scope**: paid invoices (the matrix is unpaid-only and the modal matches it — the
  *Show paid invoices* toggle does not reach it), the phone bars (see Decisions), any new
  fetch path beyond the widened select below.

## Flagging job accounts from the modal (PR 2)

The owner's second ask (2026-10-20): "in that modal, set some invoices as job accounts."

**What the flag is today** (v2.3423–v2.3440): `supply_house_invoices.on_job_account`, set in
the invoice form on the single allocated job's card — a checkbox plus a status band read from
`job_supply_house_accounts` for the (job, house) pair: **open** (green, flag defaults on),
**requested / none** (amber, with **Mark opened…** → the shared `MarkJobAccountOpenedModal`),
**not needed** (grey). The flag applies only when the invoice sits on exactly one job — "job
accounts are per property". The form never blocks ticking the flag without an account; the
roster's amber *bought, no account* evidence rows carry that truth.

**The flow, compressed to a row-level act.** The modal's Jobs cell becomes the control, with
the same three truths the form's band shows, so nothing is learned twice:

- **One job, flag on** — the teal **Job acct** chip, tappable. Tap → flag off. One update,
  no confirm (reversible and visible: the footer's teal subtotal and the cell's teal line
  re-sum at once).
- **One job, flag off** — a hollow **+ Job acct** chip. Tap →
  - account **open** → flag on immediately, with the green band's line as a one-row note
    ("On the account · ref JA-4114 · opened by phone 9/14").
  - account **requested / none / not needed** → the form's own amber band unfolds under the
    row, its exact words ("No job account at Bluebonnet on record for this job" / "asked for,
    not open yet" / "marked not needed — <note>") and three doors: **Mark opened…** (the
    shared `MarkJobAccountOpenedModal`, stacked above; on save with status open the invoice
    is flagged too — the form's own `onSaved` behavior), **Flag anyway** (just the flag; the
    roster's evidence row keeps telling the truth), Cancel.
- **No job** — the chip reads **Pick a job ›** and opens the invoice form (the PR 4 edit
  door): allocation has its own validated flow (search, pct, the PO cross-checks) and the
  modal must not fork it.
- **Two+ jobs** — no chip; the form's own sentence as the tooltip: "Job accounts are per
  property — this invoice is split across N jobs."

**Data**: the modal's on-open fetch (allocations + job names, Decision 4) adds one read of
`job_supply_house_accounts` for the (job, house) pairs in view, so every chip knows its
one-tap-vs-popover path before the tap; the house's job-accounts reps load when a popover's
**Mark opened…** opens (the sheet needs them). **Write**: one `update` per tap, then
`loadSupplyHouseSummary()` — the matrix, the teal lines, and the open modal's own footer
re-sum from the same state. Office roles only (the tab's existing gate; RLS enforces).


## The move window: a charge moves only while it is current (PR 3)

The owner's third ask (2026-10-20), clarified the same day: "we can only add
[invoices] to job accounts while they are in the 'current' column, and in doing so we need
to come up with a modal workflow where the person doing it should check a box that they
called [the house] and the item was moved to a job account OR we should make it easy to send
an email from the app requesting the move where we then follow up with a call."

**The rule.** An unpaid charge can be moved onto the job account only while the invoice is
**Current** (not yet due). Each invoice has its own clock — its due date closes its window —
so the tooling keys on the Current bucket the kernel already computes: movable = unpaid,
Current, on a single job, not yet flagged. Past due = window closed; recording a flag the
house already carries is still allowed (the "we forgot to mark it" case), but no move is
offered.

**The move modal.** Pressing **+ Job acct** on a movable row opens it (the band and one-tap
paths now apply only to past-due rows). It shows the invoice facts, the days left in its
window, the (job, house) account state (open · ref, or "no account on record — ask the rep to
open one on the same call" with the shared **Mark opened…** sheet), and the rep. Two paths:

- **The call, attested.** A checkbox — *"I called <house> (<rep>) — this charge was moved
  onto the job account"* — with **Mark it moved ✓** dead until it is ticked. Ticking and
  saving sets `on_job_account` and records who attested and when. The flag is never set on
  hope.
- **The email, then the follow-up.** A drafted request to the house's job-accounts rep
  (their `job_accounts` contact email), previewed before sending: the invoice, PO, amount,
  the job, the account ref (or "please open one with it"), and "we'll call to confirm."
  Sending records the ask; the row turns amber — *asked 10/20 · follow up ☎* — and stays in
  the worked list until someone confirms by the same checkbox. An unanswered ask ages by the
  app's waiting convention (amber at 3 days, red at 7 — a named constant in `ageState.ts`).

**Worked as a list, by house.** The teal strip above the table counts the still-movable
dollars, the asks awaiting the house, and the soonest window to close; **Work the list ›**
opens every movable charge grouped by house, the rep's phone on the group line, and
**✉ Email <rep> the list ›** sends one request covering the group's unasked rows. The footer
counts *to ask · asked · dollars*; when everything is moved or marked the strip reads a
quiet ✓.

**What it takes.** This PR carries the train's only migration and edge function:

- `supply_house_invoice_move_requests` — one row per ask: invoice, job, house, who/when,
  `via` (email · phone), the sent email's recipient snapshot, `confirmed_by/at`. RLS like
  the invoice table's, plus the three read-only/twin write-block calls (CLAUDE.md), and
  `SET lock_timeout = '3s'`.
- Edge function `request-job-account-move` — sends from the app like the other office sends
  (reply-to the sender), one invoice or a house's list; `docs/EDGE_FUNCTIONS.md` section.
- Kernels: `movableInvoices(invoices, todayYmd)` (Current, single job, unflagged, unpaid)
  and the ask-age reading — tested on the window edge (an invoice due today is still
  Current; due yesterday is not).

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| `src/lib/supplyHouseAging.ts` | `agingBucketFor`, `buildSupplyHouseAgingMatrix`, `daysPastDue` | `invoicesForAgingCell(invoices, houseId \| null, cell, todayYmd)` — pure, returns sorted rows + subtotal + jobAcct subtotal; `cell` is a bucket key, `'owed'`, or `'credits'`. Tests pin *cell sum = matrix cell* for every cell of a seeded book. |
| `SupplyHousesTab.tsx` ~line 372 | summary select: `supply_house_id, amount, is_paid, updated_at, paid_at, due_date, on_job_account` | widen with `id, invoice_number, purchase_order_number, invoice_date, link, credits_invoice_id` — same table, same RLS, same single query; `agingUnpaidInvoices` carries them through. |
| `SupplyHousesTab.tsx` aging `<td>`s (~line 990) | plain cells, row-level `openHouseFromAging` | money cells become buttons opening `agingCellModal` state `{ houseId \| null, cell }`; sticky-modal styles (`stickyModalPanelStyle`) like the invoice form above it. |
| Job names in the modal | `supply_house_invoice_job_allocations` + `get_jobs_ledger_by_ids` (both already used by the expanded house) | one fetch on modal open for just the listed invoice ids (Decision 4). |
| Past-due chip, credit pairing, Job acct chip | all rendered today in the expanded house's Invoices table | extract the row bits or re-render them; no new vocabulary. |
| Flag from the modal | `job_supply_house_accounts` read (the form's per-(job, house) fetch), `MarkJobAccountOpenedModal` (shared since v2.3423), the roster's evidence rows | PR 2: the Jobs cell as the control — chip states, the unfolding amber band, one `update` per tap, accounts read folded into the modal's on-open fetch. |
| The move window | the Current bucket (the kernel already computes it), the `job_accounts` reps + emails (v2.3423) | PR 3: `movableInvoices` kernel, the strip, the move modal (attested call · emailed request), the worked list with per-house email, migration `supply_house_invoice_move_requests`, edge `request-job-account-move`. |
| Edit / due date / payment from the modal | `openEditInvoice` + `openApplyPaymentForm` exist but assume the house detail is loaded | PR 4: load the house detail, then open the form; the modal stays under it. |
| Help | `mark-supply-house-bills-paid` and `mark-an-invoice-on-a-job-account` guides | PR 1 adds the one line: press a colored cell to see the bills inside it. PR 2 adds the chip to the job-account guide. |

PRs 1 and 2 are client-only; PR 3 adds the one table (`supply_house_invoice_move_requests`, migration 20261020130000) and the one edge function (`request-job-account-move`), no RPC.

## The plan

1. **PR 1 — the kernel and the read-only modal.** `invoicesForAgingCell` + tests; the widened
   select; cells as buttons; the modal with rows, chips, View links, the matching footer
   total, the job-acct subtotal, **Open <house> ›**; totals-row and Owed and Credits cells per
   Decision 1; guide line; release note + fragment.
2. **PR 2 — the Job acct chip is the act.** The flow above: chip states on the Jobs cell, the
   accounts read on open, the anchored popover, **Flag anyway**, the shared
   `MarkJobAccountOpenedModal` stacked above, live re-sum of the teal lines and the footer
   subtotal; the job-account guide gains the chip.
3. **PR 3 — the move window.** The kernel, the strip and its ✓ state, the move modal (the
   attestation checkbox and the emailed request), the worked list with the per-house email,
   the *movable until <due date>* tag, the ask's age chips; the migration and the edge
   function above. The train's one M.
4. **PR 4 — the doors out of it.** Row press → house detail loads → the existing invoice form
   opens (Edit for any row; the No due date modal's rows say **Add a due date ›**; the
   **Pick a job ›** chip lands here too); a **Make a payment ›** footer button on house-scoped
   modals → `openApplyPaymentForm`. Ships only after PR 1–3 have been used for real a few
   days.

## How to verify

- Unit: for a seeded book (every bucket, credits, job-acct flags, a no-due-date row), every
  cell of `buildSupplyHouseAgingMatrix` equals the sum of `invoicesForAgingCell` for that
  cell — including the footer row and the Owed column.
- Live (dev login, prod data): open Materials → Supply Houses; for each house with 60–90
  money, the modal's rows re-added by hand equal the cell; toggle *Mark job-account invoices*
  and check the subtotal line; a cell with a dash does nothing; row click still opens the
  house; Esc and the × close; keyboard: tab to a cell, Enter opens.
- Phone (375px): unchanged in PR 1 — bars still open the house screen.
- PR 3 live: the strip's dollars equal the worked list's; **Mark it moved ✓** stays dead
  until the checkbox is ticked; a sent email writes one `move_requests` row and the row reads
  *asked · follow up*; confirming clears it and sets the flag; a past-due invoice shows no
  move path, only the closed-window band; an invoice due today is still movable, due
  yesterday is not (kernel edge tests); work every row and the strip reads ✓.
- PR 2 live: on a row whose (job, house) account is open, one tap flags and the teal lines
  move everywhere at once (cell, footer subtotal, the *Mark job-account invoices* lines); on
  a row with no account the unfolded band's words match the invoice form's band for the same pair;
  **Mark opened…** saved as open flags the invoice and the form's band reads open afterwards;
  a split invoice shows no chip; untick-then-tick lands back exactly where it started.

## Decisions (answered 2026-10-20: "Build it" takes every recommended default)

1. **Which cells click?** Recommended: every money cell — the six buckets, Credits open,
   the Owed/Total column, and the footer totals row (across houses, grouped). Alternative:
   bucket cells only.
2. **What can the modal do in PR 1?** Recommended: read-only + View links + Open house; the
   edit/due-date/payment doors wait for PR 2. Alternative: fold PR 2 in and ship once.
3. **The phone rows** (under 640px the map is bars, no cells). Recommended: nothing now — a
   bar tap already opens the house's phone screen, which has its own aging tabs. Alternative:
   tapping a bar segment opens the same modal as a sheet.
4. **Job names in the modal?** Recommended: yes — one allocations fetch on open, showing the
   same "4112 · job name (pct%)" line as the expanded house. Alternative: Job acct chip only,
   zero extra queries. (PR 2's chip flow needs the allocations anyway, so "yes" also keeps
   PR 1 and PR 2 on one fetch shape, and PR 3's move list reuses it.)
5. **May a past-due invoice be flagged with no account on record?** Recommended: yes —
   **Flag anyway** stays on the closed-window band, matching the invoice form (the roster's
   amber *bought, no account* row carries the truth). Current invoices are different: they go
   through the move modal, which never flags without the attestation. Alternative: the band
   offers only **Mark opened…**.
6. **One tap per row, or a batch?** Recommended: per-row taps — a cell holds a handful of
   invoices and an open account makes each tap a single press. Alternative: tick-boxes plus
   a "Flag N as job account" footer button, for the day a cell holds dozens.
7. **The email.** Recommended: sent from the app's mailbox (like the other office sends)
   to the house's `job_accounts` contact, reply-to the sender; one invoice from the move
   modal, or one email covering a house's whole list from the group line. Alternative: a
   `mailto:` draft the office sends from their own mail — no edge function, but the app
   cannot then record the ask reliably.
8. **Where does the nudge live?** Recommended on 2026-10-20: the strip on this screen only,
   for now; the alternative was a Dashboard / Quickfill line when a window is about to close
   ("$2,210 still movable, soonest closes Friday"), once the strip had earned it. **Built on
   the owner's ask of 2026-10-21 (v2.5723):** the Needs You line `job-account-window` on both
   hosts — the strip's four numbers from `count_supply_house_move_window()` (migration
   20261021220000, the kernel's predicate; the `supply-house-move-window` bed and
   `supplyHouseMoveWindow.parity.test.ts` hold the two readers to one set of rows), red within
   three days of the soonest window, amber within a week (`SUPPLY_MOVE_WINDOW_CLOSE`), **Work
   the list** → `/materials?tab=supply-houses&list=movable`, which opens the worked list. The
   strip stays as the screen's own summary.
9. **When does an unanswered ask escalate?** Recommended: the app's waiting convention —
   amber at 3 days, red at 7 (named constants in `ageState.ts`), red asks lead the worked
   list. Alternative: no aging; the office just sees "asked".
