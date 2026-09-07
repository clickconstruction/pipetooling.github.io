# Subs → Work: the Compact board (four columns, text window, calendar on click, standing → next)

Status: in progress · branch `claude/nice-dirac-a75a63` (v2.2963, uncommitted batch as of 2026-09-07) · owner: Stephen

## The ask, in the owner's words

Over 2026-09-06/07, reviewing Jobs → Subs → Work on real data: "move New Sub Labor / New work order and search to the right of the Work/Pay toggle" → "the four tiles should open modals that are actionable" → "agreed, paid and open could be one column with colors" → "combine the GC portal and the window into the same column" → "if we're going to combine that, combine Where it stands and Next too" → "turn this into a prototype with real data before I decide" → "I don't like seeing the dates on the window header; text is the most compact and effective — if a user clicked the text, a modal could show what it looks like on a calendar" → "Sep 29 – Oct 10 · Accept Answer… on one line, the quote on the next".

## The decision

The board goes from nine columns to **four**: Sub · stage / **Window** / Agreed · Paid · Open (stacked) / **Where it stands → next**.

- **Window is text, not a track.** Line 1: the dates as a link (dotted underline) + the GC chip (grey *GC off*, dashed blue *Offer to GC ›*, teal *On ‹GC›'s portal ›*, amber *GC asked ›*). Line 2: one sentence — "set by the office · Change", "Behar picked Sep 9 – 10" (green), "as Summit asked", "worked Sep 4 – 5" (passed windows go grey). An open GC ask: line 2 = "Sep 29 – Oct 10 · Accept · Answer…", line 3 = the GC's reason in italics.
- **Clicking the dates opens a calendar modal**: the months the window touches, Monday-first, weekends dimmed; our window as light fill, the pick as a solid bar, the GC ask as a dashed ring, today outlined, the sub's off days hatched, the job's other stages as thin marks; side panel with the facts and the four existing moves (Change window, Accept, Answer with, Take off portal) and the stages on the job. Looking on the calendar, acting on the buttons — no click-a-day writes (drag-to-set is a later idea).
- **Where it stands → next is one cell**: the rail with its centered label, an arrow, the move as a button in its tone (blue normal · amber lapsed · green money · quiet text when the sub owns the step), a second button only at Pre-inspection (*Schedule inspection…* + *Passed → bill*), a ⋯ icon menu for what the actions column held. The actions column and the GC column go away.
- **Rejected:** the split chip alone (v1: no comparison across rows), the time track with a date axis (v2: dates in the header read as clutter; a track column costs 220px for a picture nobody asked to see every time).
- **Open questions:** should *Offer to GC ›* offer straight from the row after one confirm, or open the calendar on its GC facts? (Mock-up says straight from the row.) Does the calendar show "Behar is also on #273 Sep 8 – 9" from the dispatch data in v1, or later?

## The mock-ups

- [`subs-board-compact-window.html`](./subs-board-compact-window.html) — the Window cell in all ten states, the board, the calendar modal, the narrow card (artifact 226109a8, v3).
- [`subs-board-compact-next.html`](./subs-board-compact-next.html) — Standing → next, the ⋯ menu, the inline row form, the build order (artifact a27c2946, v2). Its Window column still shows the track; read the window mock-up for that column.

## Where it plugs in

Already built and uncommitted on the branch (v2.2963):

- `src/components/jobs/JobsSubsWorkView.tsx` — the Work view: `layout` state (`classic` | `compact`, dev-only toggle via `canPrototype` from `Jobs.tsx`), `compactTable`, `trackDataFor` / `trackCaption` / `gcDoor` (the GC chip), `moveFor` / `runMove` / `menuFor`, `moneyStack`; the quiet writes `withdrawQuiet`, `extendOffer`, `linkSheetToJobQuiet`, `billCustomerForJob`.
- `src/components/jobs/StandingMoveCell.tsx` (+ `MoreMenu`, lucide `MoreHorizontal`), `src/lib/subs/standingMove.ts` (+test) — the merged cell and its rule.
- `src/components/jobs/WindowTrack.tsx`, `src/lib/subs/windowTrackScale.ts` (+tests) — **to be removed** (replaced by the text cell).
- `src/components/jobs/SheetRail.tsx` `labelBelow` (centered label), `src/components/jobs/JobWatchersPopover.tsx` (bell without the word).
- The four tile queues `src/components/jobs/subsTiles/*` and `src/lib/subs/subsTileQueues.ts` — the inline forms the board rows will later reuse.
- Classic cells still in the file: `windowCell` (Set a window… / Change / Accept / Answer / propose form), `gcCell` (off · Offer to GC · Shown · Withdraw), `primaryAction` / `secondaryActions` (the actions column), the narrow `cards`.

Data the calendar needs is already on the page: `windows` (`job_stage_windows` incl. `asked_*`, `offered_to_gc`), `rows` (`step_commitments` incl. `picked_*`, `proposed_*`), `gcSharing` (job → GC name), `jobs[].fixtures` (stage names), `availability.offDays` (`person_availability`, loaded when a queue opens — load for the modal too), `subs.groups[].rows` (sibling stages per job).

## The plan (ordered, smallest shippable first)

1. **Finish and land the batch (v2.2963, this branch).** Replace the track in the Compact prototype with the text cell: new `WindowTextCell` (line 1 dates-as-link + `gcDoor`, line 2 caption, line 3 quote on an ask; `passed` grey; *Offer to GC ›* offers directly after confirm via `offerToGc`), delete `WindowTrack.tsx` / `windowTrackScale.ts` and their tests, drop the axis from the header. Compact stays dev-only. Commit once, PR, auto-merge. Release note + fragment already written — trim the track paragraph, add the text cell.
2. **`StageCalendarModal` (dev-only still).** Pure kernel `src/lib/subs/stageCalendar.ts`: `calendarMonthsFor(span)`, `dayCellsFor(month)` with per-day flags (window / pick / ask / today / off / sibling / weekend / other-month) — tested. Component: two month grids + side panel; reads the data above; buttons call `saveWindow` (via `StageWindowEditor` inline or the existing editor row), `answerGcAsk`, `offerToGc`, `withdrawFromGc`. Opens from the dates link in the text cell (Compact) and from the classic Window chip too, so it is useful before the switch. Guide: *set a window for a sub's stage* gains a "See it on the calendar" section.
3. **Compact becomes the board.** Remove the toggle and the classic table; narrow cards adopt the text cell and stack the Standing → next halves (dots + label centered, move full width). Retire `primaryAction` / `secondaryActions` / `gcCell` / the classic `windowCell` chip branch (keep the editor + ask-answer form, the modal and the cell reuse them). Update `clear-the-subs-tiles.md`, `set-a-window-for-a-subs-stage.md`, `schedule-a-sub-across-every-surface.md` (Window column, GC chip, ⋯ menu wording), `GLOSSARY.md` (Window cell, GC chip), `PROJECT_DOCUMENTATION.md` tab description, `JOBS_TABS_ARCHITECTURE.md` if it lists the Work columns.
4. **Inline row forms.** Lift the three queue forms (mini order from `HandshakeQueue`, sub picker from `StagesQueue`, re-send from `OffersQueue`) into `src/components/jobs/subsTiles/RowActionForm.tsx`; the board's `draft` / `offer_stage` / `resend` moves expand the row into it instead of opening the assembler; the queues mount the same component. Add `useSubAvailability` so the board loads orders/off days once for both.
5. **Later, only if asked:** drag across calendar days to set or move a window; "also on #273 Sep 8 – 9" marks from `fetchSubOrdersForRange`; *Not a sub — crew pay* on a handshake row (needs a per-sheet flag → migration); Print all from the Signed queue.

## How to verify

- Prod has **no stage windows and no job shares dates with a GC**, so the text cell shows "Set a window… · GC off" on every row and the calendar has nothing to draw. Set up one job you don't mind: Edit Job → GC/Builder → *Share stage dates with this GC*; on Subs → Work, "+ Add a stage…" on its header, pick a line item, set a window. The specimen job **Zebra Quartz Testing LLC** (see memory / the training account recipe) is the safe choice; re-archive it after.
- Never press **Send** on a queue or a row against prod — it emails a real sub. Withdraw / Extend / Offer to GC are safe to undo.
- Dev login: `http://localhost:5173/dev-login?as=1&to=/jobs?tab=subs`; the Compact toggle is at the right end of the Work toolbar (dev role only); the choice persists in `localStorage.subsWorkLayout`.
- Checks: `npm run typecheck && npm run lint && npx vitest run src/lib/subs src/components/jobs/subsTiles src/components/jobs/JobsSubsWorkView.render.test.tsx src/components/jobs/StandingMoveCell*`; theme tokens `node scripts/theme-tokenize.mjs --check src`.
- Gotchas hit: Prettier is not enforced and `JobsSubLaborTab.tsx` was never formatted — edit by hand, never run the formatter on it. The Browser pane's `find` sometimes misses fresh buttons; click by coordinate or via DOM. The dev server drops its session on restart — dev-login again.
