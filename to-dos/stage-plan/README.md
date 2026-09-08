# Stage Plan — the line item is the stage

Status: **in progress** · PR 1 (data + kernel, v2.3083, PR #2838) · PR 2 (Bill tab, v2.3100) on `claude/stage-plan-2-bill-tab` · designed and approved 2026-09-07. Owner: Stephen. Designed in the session that shipped the three-party scheduling train (v2.2927–v2.2934) and the hub guide (v2.2938). Any session can pick this up cold; everything needed is in this folder.

## The ask, in the owner's words

- "The GC should never see that we have offered any of our work to a sub and should always think we're the one doing it."
- "For GCs we need to keep it simple, stupid. And I don't think that we can get to a later stage until we complete a prior stage."
- "Sometimes stages need to be sequential and sometimes we throw change orders in that need to happen at any random point in time. We need to be able to tastefully offer this to our team so they can edit it and have our team be able to see what it looks like on a customer's portal quickly, and allow our team to know when things are sequential and when things are immediate."
- "Stages can go above job details." · "The stages order or any time should be set in the billing section of this modal, and the Multiple Segment Generator will need to be updated to accommodate this." · "Help me make the order / any selector on the second line of each line item."

## What ships today that this replaces

The GC portal's Stages card from v2.2933 / v2.2934 (`supabase/functions/_shared/gcStages.ts`, `src/pages/CustomerPortal.tsx`, `src/components/portal/PortalStageAsk.tsx`) prints the sub's **first name** on every scheduled / working / passed stage, has an **"Offered to a sub"** state and chip, and says **"the sub is picking new days"** while re-scheduling. That is a leak against the first rule above and is fixed by PR 5 below. Stage sharing today is per window (`job_stage_windows.offered_to_gc`, the **Offer to GC / Withdraw / Offer several together** buttons on Jobs → Subs → Work); that moves to the line item.

## The four rules

1. **The line item is the record.** Order and kind live on `jobs_ledger_fixtures`. The Bill tab sets them, the Edit tab reads them, the portal shows them, draws follow them.
2. **Order rows wait; Any rows don't.** A numbered (Order) stage starts when the one above it passes inspection. An Any stage has its own dates and no place in the line. A plain line item is neither.
3. **The GC sees our crew, never a sub.** No names, no "offered", one live stage at a time, one ask link on the next stage.
4. **Draws follow stages.** An Order stage becomes a draw when it passes inspection; an Any stage bills when its work is done; a plain line item rides on the final draw. Nothing bills out of order. **A stage is done when the customer pays its bill.**

## Decisions

Settled by the owner (2026-09-07):

| Question | Decision |
|---|---|
| Where order and kind are set | **Bill → ① Line Items.** The Edit tab's Stages group is a read-out (eye + preview), never a second control. |
| Where the selector sits | **The second line of each line item**, ahead of the stage's state words. Not a right-hand column. |
| Default kind for a hand-added line item | **Any time.** |
| When a stage is done | **When the customer pays its bill.** Passing inspection is what lets the *next* Order stage start and what makes the draw billable; *done* (the green check, "Stage N of M" advancing past it) is paid. |
| Backfill of existing jobs | **Every existing line item becomes Any time.** No job is put in order by the migration; a user stages a job by flipping rows to Order when they want to. |
| Stages on the Edit tab | **Above the job details** (under the address, above Account man). |
| Selector labels | **Order / Any / —** (— is a plain line item). |

Proposed, not yet confirmed — build with these unless the owner says otherwise:

- A plain (—) line item bills **with the final Order draw**; on a job with no Order rows it bills on its own like an Any row.
- **Offer to GC, Withdraw and "Offer several together"** are removed from Jobs → Subs → Work; the eye on the Edit read-out is the only per-stage share control, and the job-level "Share stage dates with this GC" switch stays as the master. Bundles are dropped; the sequence makes them unnecessary.
- The "Offer the next stage when one passes" switch flips the next Order row's eye on when the prior stage passes inspection.
- Rows already broken off into an invoice keep the selector disabled (a paid draw can't change kind).

## The mock-ups (approved)

Kept here, open in a browser:

- `mockup-job-modal.html` — the job dialog before / after, three sections. Left of each is a **real screenshot** of prod with sample names swapped in: the **Edit tab** (Stages read-out above the job details, the customer drawer), the **Bill tab** (selector on the second line, badges, draw bar by stage, invoice list by stage, "Bill it"), and the **Multiple Segment Generator** (kind column, presets carry kinds, "+ Change order" preset). Renders: `edit-before-after.png`, `bill-before-after.png`, `bill-line-items.png`, `gen-before-after.png`.
- `mockup-gc-card.html` — the GC portal's Stages card: what ships today (rendered by the real component, leaks marked) versus the simple sequence. Renders: `real-vs-new.png`, `gc-card-simple.png`.
- `build-plan.html` — this plan as a page.

The sample data in every mock: job #1004 · 407 E 6th St · Sample Contracting (GC) · sub "Sam's Plumbing". Stages Rough-in (passed), Top-out (on site, 50%), Trim & final (window), Final inspection; change orders CO-2 Relocate water heater (done, unbilled) and CO-3 Add hose bib (not scheduled, hidden); a plain "Permit & misc" line.

### What the Bill tab rows read

| Kind | Second line |
|---|---|
| Order | `[Order] Any —` · **Stage 1** · passed Sep 4 · draw 1 paid Aug 29 |
| Order (live) | `[Order] Any —` · **Stage 2** · on site Sep 9 – 10 · 50% · draw 2 billed Sep 5 |
| Order (later) | `[Order] Any —` · **Stage 3** · window Sep 22 – Oct 2 · draw 3 after it passes |
| Any | `Order [Any] —` · ◆ done Sep 16 · ready to bill |
| Any | `Order [Any] —` · ◆ not scheduled · bills when done |
| — | `Order Any [—]` · not a stage · bills with the final draw |

### What the GC card reads

Headline **"Stage 2 of 4 · Top-out · on site now"**, then one row per Order stage: green check "Passed inspection Sep 4" (check = done per the paid rule, see open question 1), filled dot "On site Sep 9 – 10 · about halfway" with a plain progress bar, hollow dot "Planned Sep 22 – Oct 2" with the only **Need other dates?** link, hollow dot "After trim & final". Under it **Also on this job**: shared Any rows with the same three states. Re-scheduling reads "we're picking new days inside the window". Never a name, never "offered". Percent in words: just started / about a third / about halfway / nearly done.

## Where it plugs in

Exists today:

- `jobs_ledger_fixtures` (`id, job_id, name, count, line_unit_price, line_description, sequence_order`, …) — the line items; `sequence_order` is already the ▲▼ order.
- `job_stage_windows` (one per fixture: `window_start/end`, `offered_to_gc`, `bundle_id`, `asked_*`, `answered_at`, `answer`, `answer_note`) — windows and the GC's asks. Stay as they are; `offered_to_gc` and `bundle_id` stop being read after PR 5.
- `step_commitments` (`stage_window_id`, `picked_start/end`, `change_requested_at/_note`, `work_days`) — the sub's pick. Unchanged.
- `people_labor_jobs` (`stage`, `progress_pct/note/at`) — the sheet's stage and the sub's percent. Unchanged.
- `src/components/jobs/JobFormFixturesSection.tsx` — ① Line Items rows (name × count $ price, ▲▼, remove, + Add line item).
- `src/components/jobs/MultipleSegmentGeneratorModal.tsx` — total, presets (`SEGMENT_GENERATOR_PRESETS`: Commercial 30/30/30/10, Residential 40/40/20), rows with name + %, Add to Job.
- `src/components/jobs/JobFormSegmentsBar.tsx` — the ② Invoices segment strip, the Make Invoice track, "Create invoice from remaining on N segments", the covered-hatching logic for dollar bills.
- `src/components/jobs/JobFormModal.tsx` — the dialog (Job / Edit / Bill / History tabs; Edit tab sections at ~L3660–3960: Account man, Customer & GC, Links, Fixtures, Break-off, Parts cost).
- `src/components/jobs/JobFormCustomerSection.tsx` → `JobGcStageSharingSwitches.tsx` — the two job-level switches under the GC picker (`jobs_ledger.gc_shares_stage_dates`, `gc_auto_offer_next`).
- `src/components/jobs/JobsSubsWorkView.tsx` — Subs → Work rows, the Window column, the GC column (Offer to GC / Shown · Withdraw / Offer several together…), the GC-ask block (`data-testid="gc-ask"`).
- `src/lib/subs/offerNextStage.ts` — `nextStageToOffer`, `offerNextStageAfterPass` (called from `SheetStoryModal.setStage('customer_pay')`).
- `src/lib/estimateChangeOrder.ts`, `src/components/estimates/CreateJobFromEstimateModal.tsx` — where a change order's lines become job line items.
- `supabase/functions/_shared/gcStages.ts` (`buildGcStageEntries`, `gcStageLine`; states window / offered / scheduled / working / inspection / passed; emits `who` = sub's first name), `_shared/stageAsk.ts`, `customer-portal` (`stages[]` in the payload), `submit-portal-request` (`stage_window` kind).
- `src/pages/CustomerPortal.tsx` (Stages card at `data-testid="portal-stages"`), `src/components/portal/PortalStageAsk.tsx`.
- `supabase/functions/_shared/customerSample.ts` — `SAMPLE_GC` ("Sample Contracting", Pat Sample) and the `sample-gc` token the office previews under Settings → What customers see. Has no stages today.
- Guides: `split-a-job-into-stages.md`, `set-a-window-for-a-subs-stage.md`, `show-a-gc-the-stages-you-plan.md`, `schedule-a-sub-across-every-surface.md`, `watch-a-job-for-sub-updates.md`.

New:

- Two columns on `jobs_ledger_fixtures`: `stage_kind text` check in `('order','any')` (null = plain) and `shared_with_gc boolean not null default false`. Backfill: `UPDATE … SET stage_kind = 'any'` for every row; `shared_with_gc = true` where the fixture's window has `offered_to_gc = true`.
- `src/lib/jobs/stagePlan.ts` — the one kernel (below).
- `src/components/jobs/JobFormStagesGroup.tsx` (Edit read-out) and `JobFormStagesDrawer.tsx` (the customer preview beside the dialog).

## The kernel — `src/lib/jobs/stagePlan.ts`

Pure, unit-tested, consumed by every PR after the first. Shape it like `src/lib/subs/subsTabRows.ts`.

```ts
buildStagePlan({ fixtures, windows, orders, sheets, invoices, payments, todayYmd }) → StagePlan
// rows in display order (Order rows by sequence_order, then Any rows by sequence_order, then plain),
// each: { fixtureId, kind: 'order'|'any'|null, number: number|null, badge: 'done'|'live'|'later'|'any'|'any-done'|'none',
//         stateLine: string, window, pick, pct, draw: 'paid'|'billed'|'ready'|'waits'|'later'|'none', sharedWithGc }
headline(plan) → "Stage 2 of 4 · Top-out · on site now"      // Order rows only count toward N of M
billable(plan) → { fixtureId, amount, why }[]                 // Order: passed inspection & unbilled; Any: work done & unbilled; plain: with the final draw
gcView(plan)   → { headline, steps: [{ name, state: 'done'|'now'|'next'|'later', line, pct?, askable }], also: [...] }
                                                              // never a name; askable true only on the 'next' Order row; only rows with sharedWithGc
```

Tests to write first: numbering skips Any rows; a plain row never gets a number; `headline` counts Order rows only; `billable` never returns an Order row whose predecessor is unbilled; `gcView` output contains no `display_name` / first name under any input; ask allowed on exactly one row.

## The PR train

Stack them the way the scheduling train was stacked: branch off the parent, `git rebase --onto origin/main <old parent sha> <branch>` after the parent squashes, `gh pr edit N --base main`, `gh pr merge N --auto`. Claim versions with `npm run claim` when writing the docs entry, never derive. Deploy per PR: client (deploy.yml) → `supabase db push` (PR 1 only) → `supabase functions deploy` (PR 5 only), from a clean detached worktree at origin/main.

### PR 1 · Data and the kernel (M)

- Migration `supabase/migrations/<next>_fixture_stage_kind.sql`: `SET lock_timeout = '3s'`; two `ADD COLUMN IF NOT EXISTS`; the two backfill `UPDATE`s; a `docs/migrations/` fragment. No new table, so no read-only fence appliers needed.
- `stagePlan.ts` + `stagePlan.test.ts`; regenerate `src/types/database.ts`.
- Release note (infra), docs fragment, session card. Nothing visible changes.
- Live: after `db push`, every fixture reads `stage_kind = 'any'`.

### PR 2 · Bill tab: the line item sets the stage (L)

- `JobFormFixturesSection`: a badge column on the left (number / diamond / dashed circle, done and live fills); a second line under each row: the **Order / Any / —** selector then `stateLine`; the selector writes `stage_kind`; ▲▼ unchanged; selector disabled on invoiced rows.
- `JobFormSegmentsBar`: blocks in plan order carrying the row's `draw`; legend Paid / Billed / Ready to bill / Unbilled, waits on its stage / Later; one hint line "Draws follow the stages…"; **Bill it** on an Any row that is done and unbilled (ticks that one segment and runs the existing create-invoice path). Keep the covered-hatching code path; only order and labels change.
- Invoice list: "Draw N · name" from the plan; a "Later" row for the next unbilled Order stage.
- Change-order apply: the new fixture lands with `stage_kind = 'any'`, `shared_with_gc = false` — in PR 2 this is the column default plus `fixtureInsertRows` writing `undefined → 'any'` (tested in `stagePlanForm.test.ts`); the generator's explicit kinds are PR 3.
- Ready to Bill pipeline's capable list reads `billable()`. **Deferred past PR 2 (v2.3100):** the Stages board's *capable to bill* total sums unbilled line items per working job; reading `billable()` there needs windows / orders / sheets for every working job in one fetch. Do it with PR 4 or as its own small PR.
- Guide *split a job into stages and bill stage by stage* rewritten around the selector. Render smoke for the fixtures section.
- Live (test job on prod, then delete it): flip a row to Order and back; apply a change order and see it arrive as Any and hidden; the draw bar reorders; Bill it breaks off one invoice.

### PR 3 · Multiple Segment Generator (S)

- A Stage column with the same selector per segment; presets carry kinds (Commercial → 4 Order, Residential → 3 Order); a **+ Change order** preset that adds an Any segment with its own dollar amount outside the percentage split; the allocation line reads "100% allocated · $X in order · $Y outside the split"; the summary line counts kinds.
- Add to Job writes `stage_kind` with each appended fixture. The split math moves to a tested pure helper.
- Guide section; release note.

### PR 4 · Edit read-out and the customer drawer (M)

- `JobFormStagesGroup` under the address, above Account man: collapsed summary "N in order · N any time · N shown to <GC>"; open, the In order / Any time lists from the plan with the window or pick chip and the eye (writes `shared_with_gc`); buttons **See it as the customer** and **Set stages on Bill →**; legend line. No grips, no kind switch.
- `JobFormStagesDrawer` beside the dialog: renders the portal Stages card component with `gcView(plan)`; "Open the portal ↗" opens the job's GC link (or the sample when none).
- `JobsSubsWorkView` GC column: Offer / Withdraw / bundle buttons removed; shows the eye state read-only with "set on Edit". `offerNextStage.ts` flips the next Order row's `shared_with_gc`.
- Guide *show a GC the stages you plan* rewritten (eye, drawer, no Offer button). Render smokes.

### PR 5 · The GC card in the company's voice (M)

- `_shared/gcStages.ts` → reads `shared_with_gc`, emits `gcView` rows (done / now / next / later, `also`), **no `who`, no `offered`**, percent for the live row only, `askable` on the next Order row only. Keep the old field names one release with `who: null` so a stale client never shows a name.
- `customer-portal`: new payload; `submit-portal-request`: reject a `stage_window` ask on a row that is not `next`.
- `CustomerPortal.tsx` Stages card → the sequence (headline, numbered rows with check / filled / hollow dots, progress bar in words, "Also on this job", footer). `PortalStageAsk` mounts on the next row; re-scheduling copy "we're picking new days inside the window".
- `customerSample.ts`: the four sample stages + two change orders so *What customers see → GC* shows the card.
- Kernel tests: never a name, one live row, ask only on next. Deploy `customer-portal` and `submit-portal-request` after the client. Release note (fix + feature).
- Live: sample GC portal shows the card; a real GC link on a shared job shows no sub name; an ask still lands in dispatch and on the Bill/Edit rows.

### PR 6 · Guides and screenshots (S)

- Hub guide *schedule a sub across every surface*: GC section and a new Bill section re-shot; the three GIFs that were missing (GC card, drawer, Bill rows) — now capturable from the sample fixture and a test job without prod test data.
- `PROJECT_DOCUMENTATION.md` / `GLOSSARY.md`: stage kind, the eye, draws follow stages.

## Open questions (build with the proposal unless answered)

1. **"Done = paid" and the GC's check mark.** The owner's rule is that a stage is done when the customer pays. Proposal: the next Order stage may *start* when the prior passes inspection (work doesn't wait on payment), the draw becomes billable at pass, and the card's green check plus "Stage N of M" advancing mark **paid**. Between pass and paid the row reads "Passed inspection Sep 4 · billed".
2. Whether the Any-row "done" that makes it billable is the sheet's *my work here is done* / 100% (proposed) or something the office marks.
3. Whether Offer to GC and bundles are removed outright (proposed) or hidden behind the eye.

## How to verify

- Screenshots without prod writes: the sub portal at `localhost:5191/sub?demo=1` (dev-only fixture), the GC portal at `/portal?t=sample-gc` signed in, office rows with names swapped in the DOM before capture via Playwright (`channel: 'chrome'`, persistent profile signed in through a dev-login link; see `scratchpad` recipe in the hub-guide PR #2680 description).
- The permission classifier blocks REST inserts of test rows on prod from the browser tool; create test jobs through the app's own New Job flow and delete them after, and never press Send / Bill against a real customer.
- Test job recipe that worked for the scheduling train: job `ZZSCHED…`, customer Zebra Quartz Testing LLC (GC, test), sub "Claude Test Sub"; clean up `job_watcher_notices` needs a service role.
