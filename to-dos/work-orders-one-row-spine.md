# Work Orders + Sub Labor: one row, with the sub's rail on it

Status: in progress · PR 1 (derivation fix) shipped as v2.2865 on `claude/work-orders-needs-derivation-304ca9`; PR 2 next · designed 2026-09-05 · mock-up: [`work-orders-one-row-spine.html`](./work-orders-one-row-spine.html) (also published at https://claude.ai/code/artifact/a8ce5a7d-d47a-4e2f-905b-558e9d67e298)

## The ask, in the owner's words

After the Work Orders tab shipped (v2.2814 / v2.2819 / v2.2829, PRs #2556 / #2562 / #2567), the owner compared **Jobs → Work Orders** ("Needs a work order · 20 jobs") with **Jobs → Sub Labor** ("Only show due") and said:

> I don't think I understand work orders because these two tabs deviate in the jobs that are shown. If I was to refresh both tabs to paint a better story, what would that look like?

Then, showing the sub portal's tracker rail (Work → Inspection → Customer pays → You're paid, with the "Done with the work at 162 Forest Drive?" prompt):

> That is what our subs see. I want to be able to track progress from one of those views.

## The decision

Picked: **one row spine on both tabs, with the sub portal's rail as the "Where it stands" column.** Rejected: folding Work Orders into Sub Labor (fewer tabs, but the drafts/nudge queue would share a screen with paying people, and every deep link from the job window, dashboard and Person Desk lands on the board).

The rule, to be stated on both tabs:

1. **The sheet is the money.** Agreed · Paid · Open come from the sheet (items minus payments), everywhere: board, ledger, portal, job window.
2. **The work order is the agreement behind it.** Every roster-sub sheet should carry one; a signed order creates its sheet (already true since v2.2819).
3. **Crew pay sheets never need one.** Sheets assigned to teammates (the "Behar | Malachi | Abraham" rows) get a *Crew pay* label and stay out of every "needs a work order" count.

Row spine (both tabs): **Job · Sub · Agreed · Paid · Open/Due · Where it stands (rail) · Next · actions.** Work Orders sorts by rail position (no agreement → drafted → sent → signed); Sub Labor sorts by money due. Filters are rail positions on both, so the tabs cannot disagree.

The rail: seven dots on one line. Three small office-side dots — **Drafted · Sent · Signed** — then the sub's four big ones — **Work · Inspection · Customer pays · You're paid** — drawn like the portal (terracotta current dot, date under the label). A sheet with work under way and nothing signed draws its first three dots **dashed red**: "no agreement" is a gap in the line, not a chip. The **Next** column is the office's end of the sub's "Done with the work?" prompt: *Get it in writing · Price it and send · Waiting on <sub> · Schedule the inspection · Chase the customer · Pay <sub>*, with its button first in the row.

Open questions for the owner when picking this up: does Sub Labor's "Only show due" default stay on? Should crew pay sheets hide behind "Subs only" by default on Work Orders (the mock-up hides them there and shows them labelled on Sub Labor)?

## Two bugs to ship first (small, either way)

Verified 2026-09-05 against prod:

1. **"Needs a work order" reads `people_labor_jobs.paid_at`, which is never set.** Every sheet counts as "unpaid", so job 892's three fully paid Miguel Rodriguez sheets ($1,750 paid) show as needing an order. Derive from items minus payments (`subLaborJobBalance` in `src/lib/subLaborOutstanding.ts` already does this for the ledger).
2. **It only sees jobs in the Pipeline cache.** `jobsNeedingWorkOrder(jobs, …)` in `src/lib/subWorkOrders/workOrderCoverage.ts` is fed the Jobs page's `jobs` list; sheets whose `job_number` has no `jobs_ledger` row (977 Springtown, 1004 Kane, 931 Heron) never appear. Derive from sheets, and label by the sheet's job number + address when there is no ledger job.

Both live in `src/components/jobs/JobsWorkOrdersTab.tsx` (`needsWorkOrder` memo) and the kernel above. Also exclude crew sheets: a sheet counts only when its assignees (`people_labor_job_assignees` → `people.kind = 'sub'`) are roster subs, or, for legacy sheets with no junction, when `assigned_to_name` matches a `people` row of kind `sub`. **Learned in PR 1:** teammates carry `kind = 'sub'` too (Abraham is `sub` with a superintendent login), so the rule is kind `sub` AND (no login OR a `subcontractor` login) — `isRosterSub` in `sheetsNeedingWorkOrder.ts`. Reuse it for the *Crew pay* label in PR 4.

## Where it plugs in (what exists)

- **Rail kernel exists**: `sheetWorkOrderRail(status, sheetStage, sheetOpen)` in `src/lib/subWorkOrders/subWorkOrder.ts` already models Draft → Awaiting signature → Signed handing off to the sheet stages; the sheet's Work order box (`src/components/jobs/SubSheetWorkOrderPanel.tsx`) draws it. Lift it onto rows; add a `gap` state for "working, nothing signed".
- **Portal rail** (what the sub sees): `src/pages/SubPortal.tsx` tracker (stages from `src/lib/subSheetStage.ts`: `working` → `walkthrough` → `customer_pays`/billed → `paid`; the portal labels walk-through as *Inspection* — match that label office-side or agree on one word). The sub's "My work here is done" button moves the sheet to `walkthrough` via `submit-sub-portal` `mark_work_done`, and the `people_labor_jobs_stage_to_activity` trigger posts the Activity line; the office's *Next* column should read that stamp (`stage_changed_at`, `stage_source = 'portal'`).
- **Coverage kernel**: `src/lib/subWorkOrders/workOrderCoverage.ts` (`buildJobWorkOrderCoverage`, `workOrderBoardBucket`, `jobsNeedingWorkOrder`) + hook `src/hooks/useJobWorkOrderCoverage.ts` (`work-order-changed` event).
- **Board**: `src/components/jobs/JobsWorkOrdersTab.tsx` (rows are `step_commitments`, filters, `?wo=<id>` / `?wof=<filter>`); assembler `WorkOrderAssemblerModal.tsx`; document `workOrderDocument.ts` + `WorkOrderDocumentView.tsx`.
- **Ledger**: `src/components/jobs/JobsSubLaborTab.tsx` (rows are `people_labor_jobs`; `SheetWorkOrderChip` under the stage cell; `subLaborJobMatchesSearch`, `subLaborJobBalance`); form modal `JobsSubLaborFormModal.tsx` (mounts the sheet box and, since v2.2829, the assembler door).
- **Money**: sheet total = `laborItemsSubtotal` / `lineLaborCost` (`src/lib/peopleLaborJobItemLineCost.ts`); payments = `people_labor_job_payments`; the portal's Agreed · Paid · Open comes from `_shared/subPortalStatement.ts`.
- **Chips elsewhere that should keep agreeing**: `JobWorkOrderChip` / `JobWorkOrderStrip` (job window Edit tab + View bill), `PersonDeskWorkOrdersSection`, Needs You `work-orders-unpriced` (`src/hooks/useUnpricedWorkOrders.ts`).
- **Tables**: `step_commitments` (anchors `step_id` / `labor_job_id` / `job_id`; `record_id`; `amount` nullable while draft), `people_labor_jobs` (+ `_items`, `_payments`, `_assignees`), `people` (`kind = 'sub'`).

## The plan (PR train, smallest first)

1. **Derivation fix** (no UI change): a pure kernel `sheetsNeedingWorkOrder(sheets, items, payments, assignees, commitments, today)` in `src/lib/subWorkOrders/` with tests; board uses it; copy becomes "N sub sheets with nothing signed". Label rows by sheet job number + address.
2. **Row rail kernel**: extend `sheetWorkOrderRail` to the seven-dot model with `gap`, plus `sheetNextAction(rail, sheet, commitment)` returning `{label, hint, button}`; tests. A `SheetRail` component (small dots · big dots · label · date) used by both tabs; keep it token-coloured (`--rail-*`), terracotta for the current dot.
3. **Work Orders rows become sheets**: Job · Sub · Agreed · Paid · Open · rail · Next; groups by rail position; filters renamed to rail positions; *Sheet ›* door on every row.
4. **Sub Labor same spine**: Total cost → Agreed · Paid · Due; rail replaces the stage chip (stage menu stays on the rail's current dot); *Next* column; filters *No agreement* and *Subs only*; *Crew pay* label on teammate sheets.
5. **Reconcile the small chips**: job window strip, Person Desk row, Needs You copy use the same rail words.

Each PR: `npm run claim`, release note + `docs/recent-features/` fragment, guide updates (`src/content/help/assemble-a-sub-work-order.md`, `send-a-sub-a-work-order-from-a-sheet.md`, and the Sub Labor guide), `docs/JOBS_TABS_ARCHITECTURE.md`.

## How to verify

- Dev server: `.claude/launch.json` → `dev-alt` (port 5188), sign in at `/dev-login`. Browser-pane clicks do not land while the pane is hidden — drive modals with `javascript_tool` (`li[role=option] > button` for the job picker).
- Dummy sub **"Claude Test Sub"** is on the roster (person `d64fb9ec-d0dd-448e-9bcd-e874205c60fa`, no email, live portal token in `sub_portal_links`). Draft → send → sign on `/sub?t=<token>` creates the sheet; delete the test rows afterwards (`step_commitments`, the created `people_labor_jobs` + items + assignees, `dispatch_requests` kind `sub_offer_accepted`).
- Real rows that exercise the story (as of 2026-09-05): 977 Springtown (Texas R & A, $40,000 open, no order), 880 Reliant Health (Airfordable, $4,200 open, no order, job already billed), 273 Dudley (Edgar $8,500 agreed / $4,500 paid / $4,000 back-charge — nets to zero, so it does **not** need an order), 892 Megan Connell (three paid-up Miguel sheets — must **not** show as needing an order), 1004 Kane (crew pay sheet at walk-through, no ledger job).
- Gotcha met on this train: SECURITY DEFINER RPCs must read the service role from `request.jwt.claims ->> 'role'` (PostgREST no longer sets `request.jwt.claim.role`); see migration `20260905063000_create_sheet_for_work_order_claims.sql`.
