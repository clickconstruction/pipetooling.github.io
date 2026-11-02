---
name: "Projects board: every working project as one picture, the expected hours as a slider inside the labor budget, the days and the stages on the strip, and the same line on the superintendent's phone"
number: 242
group: close
status: built 2026-11-02 as the card's train of five, each cut from main: v2.6320 the kernels and the strip, v2.6321 the job_expected_hours ledger and hook, v2.6330 the board at /projects-board beside Forecast, the superintendent's phone card (#6776, in the merge queue), v2.6337 the shares on #234's per-line budgets and the Costs tab's door, and the owner's add of 2026-11-02, the leader's Projects line under Money in on the Dashboard (PR 6, open); the spike's code stays on origin/spike/projects-board-242, never to merge · left: the owner's first morning read against live projects
summary: >
  Punch list #234 gives every project a labor budget and the superintendent a line that says
  ahead or behind. This is the office's side of that line and its lever: one page off the
  Pipeline where the leader, the superintendents and the office see every working project as a
  card whose strip is the labor budget, filled by the job's real days, divided by its stages, with
  the work done as a mark and the money as a thin line; a slider under it sets the expected hours,
  bounded by the hours already in and the budget's edge, in the open with who, when, from what and
  why; a press on the card opens it large for a finer hand; hovering a day, a stage bar or the
  strip answers "what was that day", "what does this stage cost to reach" and "which stage is
  this". The superintendent's phone draws the same strip from the same kernel, so the office and
  the field read one number. The spike proved it on eleven live projects and settled the shape.
next: The owner reads the board one morning against live projects and moves one number; then delete the folder. #238's job kind replaces the gate's guess when it ships.
size: L as a train of five (M · S · M · M · S); one migration (expected hours); no edge function
blocker: none. The bonus and what counts as certified stay on #234; this card stops at the line and the lever.
ver: v2.3297 · 3299 · 5245 · 6077 · 5929 · 2145 · 5837
opinion: now — the owner read every pass and said "this is so great"; the ground it stands on (#234's PR 1) is in the merge queue, and the card is where a leader will actually look every morning
mockup: not required — the design is live code on origin/spike/projects-board-242 (routes /dev/projects-board and /dev/job-mode-preview), walked against real projects; a drawing would say less
---

# Projects board (#242)

## The ask

The owner, 2026-11-01, after the superintendent's line of #234 was spiked onto a phone preview and
walked across three jobs:

> I need to expose an independent page to the leader and to the superintendents and to the office
> where we can very quickly see where all of the big jobs are and adjust their expected hours so
> that teams that are getting lazy can be artificially incentivized.

Then seven turns on the spike, each folded into the design below, in order:

> I don't love this spike. I don't think we're doing a good enough job showing instead of telling.

> This is really good and a huge step in the right direction. Now I just need a method to be able to
> extrapolate days … slices of days in that red bar … kind of like a projection.

> Instead of clicking on those days, I'd like to be able to just hover over them and have it come
> off my cursor. And I would further like to be able to press some sort of button and see a large
> modal of what these little cards are right now.

> I just realized when I am sliding that slider, I am not sliding it usefully. I should have the
> bottom of the slider be the edge of the labor range and the top of the slider be the edge of the
> labor range in costs. If something goes over budget, why would I need to slide it further? And if
> something is under budget, that's great.

> Instead of having an expanding button, I would like to be able to click on the title or click on
> the card and any of the space around it to open up that big modal of it.

> I'm starting to notice that some of these items have multiple stages. It might be a bit
> claustrophobic, but should we add those stages into this screen? … Yes, build it.

> The user has to know what those stages are. So perhaps if they were to hover over the black bar
> they could see a very clear modal of what that stage is called and how many man hours and labor
> costs it took to reach it.

And on saving it: "I like all of this. Let's save it in a way where another session can build it
all in one go."

## Where the spike lives

`origin/spike/projects-board-242` — a branch off main of 2026-11-01 that carries the spike's files
and never merges; the build cuts from `main` and takes the files from the branch as a reference,
not as a merge. Read it first; it is the design. The pieces, with what each becomes:

| Spike file | What it is | In the build |
|---|---|---|
| `src/lib/jobs/superintendentLine.ts` | the kernel: input → tone, headline, days ahead or behind, hours per day, money leading, the one move | PR 1, kept as a kernel with tests |
| `src/lib/jobs/stageShares.ts` | the kernel: a job's lines → its stages' shares of the labor budget, in order | PR 1, with tests |
| `src/components/jobMode/PaceStrip.tsx` | the strip: days, crew-day ticks, done mark, money line, target mark, stage pieces, stage end bars and their card | PR 1 |
| `src/components/jobMode/DayDetailsModal.tsx` | one day: hours and money at the top, who clocked, subs, bought that day, the report; as a hover card and as a window | PR 1 |
| `src/hooks/useExpectedHours.ts` | the target store, `localStorage` in the spike | PR 2 replaces it with the table and a hook |
| `src/pages/DevProjectsBoard.tsx` | the page: the read, the cards, the large view, the slider, the recent-changes strip | PR 3 as `/projects` |
| `src/pages/DevJobModePreview.tsx` | the phone preview with the superintendent's card | PR 4 takes `SuperintendentCard` into Job Mode; the preview page stays dev-only or goes |
| `src/components/jobs/JobsStagesCommandBar.tsx` | the *Projects* press beside *Forecast* | PR 3 |

The branch also carries the stage-checklist spike of #237 (`checklistDocument.ts`,
`useChecklistDocuments.ts`, `ChecklistDocumentSheet.tsx`, `JobDocumentsChecklists.tsx`, the mount on
the Documents tab), because the phone card counts the checklist as its proof. That is #237's build,
not this one; PR 4 reads the count from whatever #237 has shipped by then, or from #164's answers
until it has.

What the spike fakes and the build must not: the expected hours and the checklists live in
`localStorage`; the budget columns of #234's PR 1 are not loaded (every line falls back to the
assumed split, so stage shares come out near equal); the board's project read is a one-off select.

## The design

**The gate.** A working project: status *working* and either a stage marked *In order* or a price
of $25,000 and up, read the way the Pipeline recognizes stages. #238's kind replaces that guess
when it ships. Service calls stay out.

**Who sees it.** The leader (master technician), the superintendents, the assistant and the
controller. The door is a *Projects* press on the Pipeline's command bar beside *Forecast*, shown to
whoever sees Forecast. Who may move the expected hours: the leader and the office set (assistant,
controller); a superintendent reads his own number and its reason.

**The card.** One per project, worst first (money leading, then behind by days, then even, then
ahead, then no reading yet), in a grid of 340 px columns. Title *J1044 · Name*, the phone link, then
the strip, its legend, the expected-hours row, the reason box once the handle moved, the words.
The card's title is a press and so is every space around a control: both open the card large in
`ResponsiveModalShell` (960 wide) with the strip at 40 px, a long slider, − / + one crew day,
a typed hours box, and the full reading. The slider, a day, a stage bar and the links do their own
thing and never open it (`closest('button, a, input, textarea, select, label, [role="dialog"]')`).

**The strip is the labor budget.** The track's length is the job's labor budget in hours from the
Costs baseline (`resolveJobBudget`, bid → typed → assumed; the lines' sum when the baseline has no
hours) or the hours used when they have passed it. On it:

- the real days, one amber segment per work date as wide as that day's hours, laid end to end from
  the left (`laborDaysOf` over the charge timeline's team-labor events); red when the job is behind;
- the days left, one tick per crew day over the empty rest, where the crew day is the mean of the
  worked days when there are two or more, else 24 h assumed (ticks skipped under 2% of the track);
- the work done as a blue 4 px mark at the job's percent, with a chip beside it: `+N d`, `−N d`,
  `on pace`, `money ahead`, or `budget?`; and `N d left` at the right while the fill is under 85%
  and the done under 60%;
- the money spent as a thin line along the bottom, red when it leads the work by ten points or more;
- the expected hours as a dashed mark with the rest hatched, drawn only when the target is short of
  the budget;
- the stages (below) as pieces of the track with a bar where each ends;
- the legend: `done N% · hours N% · N days, tap one · N stages, hover one · money N%`.

**The days.** Hover a day and a card comes off the cursor, pinned beside the pointer, taking no
clicks, flipping above when low on the screen: the day's hours and money in bold at the top, then
who clocked and for how long, the subs, what was bought, and the report's percent if one was filed.
On a phone, where nothing hovers, a tap opens the same as a window.

**The stages.** A staged project's labor budget is the sum of its stage lines, so the track is
divided where each stage's share ends: in-order stages by their sequence, then any-time lines,
then whatever carries hours and no stage folded into one trailing piece (`stageSharesOf`); fewer
than two pieces draws nothing. Each piece is a named stretch of track (hover says *Rough In · 56 h
of the budget · 40% done*), and in the large view its name sits under it. A stage's own percent,
when the crew reported one on that line, is a thin blue line along the top of its piece. The bar
where a stage ends is a 12 px hover target with a help cursor, and its card says: *End of Rough
In · stage 1 of 3 · Budget to reach here 56 h · $2,538 · Rough In alone 56 h · $2,538 · The crew
passed here on Oct 20, 82 h in* (or *N h short of here, M h in*, or *No hours on the job yet*).
Dollars show only when every stage carries them. A line's name can be a paragraph; the strip
shows its first words.

**The slider is the budget's range.** Its floor is the hours already in; its ceiling is the labor
budget's edge. Past the edge is over budget and there is nothing to set there; under it is the
point. Steps are one crew day. The − / + presses and the typed box clamp to the same range. A job
at or over the edge (within an hour counts) shows the slider pinned and disabled with *Over the
labor budget by N h.* or *At the labor budget's edge.* and *The budget is the lever now, on the
Costs tab, not the target.* Dragging re-reads the strip and the words live as if the target were
set; nothing writes until *Keep*.

**The expected hours are a target in the open.** A target is who set it, when, from what to what,
and why (the reason box is required once the handle moved). The card reads *🎯 Expected 110 h, set
by Robert on Nov 1 (was 138 h): the bid carried 138 h for a slab job that framed in a week; 110 is
the real number · back to the budget*. A *Recent changes* strip at the top of the page holds the
last changes with *Undo the last change*. The target never changes the budget: the Costs tab's
baseline and #234's bonus ground stay frozen apart, and `back to the budget` clears the target.

**The line's rules (the kernel).** Done percent against hours percent of the budget gives the days
ahead or behind at the crew day; a planned finish, when one exists, gives the finish words; money
leading the work by ten points or more outranks hours (*Spending N points ahead of the work.*);
spent over three times the budget reads *The money budget looks wrong.* instead of a verdict; no
percent yet reads *The line needs a percent to read a pace.* with *Set the %*; the proof line is
the certified percent when there is one, else the checklist count, else the crew's own percent
marked provisional; the one move when behind is the stage eating hours, in the Build desk's words.
The budget source reads as a glyph: ◆ from the bid · ✎ typed by the office · ≈ assumed · 🎯
expected.

**The phone.** The superintendent's Job Mode card draws the same `PaceStrip` from the same kernel
with the same inputs, compact: headline, strip, the target line when one is set, money only when
it leads, the proof, the move, the two presses (*Set the %*, *Open the checklist*). The office's
page and the phone must never disagree, which is why the kernel is one file.

## The build

1. **PR 1 — the kernel and the strip (M).** `superintendentLine.ts`, `stageShares.ts`,
   `laborDaysOf`, `PaceStrip`, `DayDetailsBody` / `DayHoverCard` / `DayDetailsModal`, the stage end
   card. Unit tests for every rule above (ahead, behind, even, early, money leading, budget looks
   wrong, crew day from two or more days else 24, stage shares in order with the folded trailing
   piece, the target mark only short of the budget, slider bounds) and a render smoke for the strip
   with days and stages. Nothing on a screen yet.
2. **PR 2 — the expected-hours table (S).** `job_expected_hours`: job_id, hours, from_hours,
   set_by, set_at, why, cleared_at; append-only so the history is the recent-changes strip; RLS as
   the job's; `SET lock_timeout`, the three fences. A hook that reads the latest open row per job
   and writes one. `docs/migrations/` fragment. Push right after the merge; nothing calls it until
   PR 3.
3. **PR 3 — the page (M).** `/projects`, gated as above; the read (working projects by the gate, in
   one query with their fixtures; the bulk burn inputs `useBidVsActualBurnInputs`; `job_budgets` in
   bulk; the checklist counts); the cards, the large view, the slider in the budget's range with
   its reason, the recent-changes strip with Undo, the Pipeline door. Render smokes for a card in
   each tone and the pinned over-budget state. Guide *see where every project stands and set its
   expected hours*; `APP_DIRECTORY.md`, `PROJECT_DOCUMENTATION.md`, `ACCESS_CONTROL.md`.
4. **PR 4 — the phone (M).** `SuperintendentCard` in Job Mode for the superintendent on a project,
   from the same kernel and inputs as the board; the day as a window on tap; the proof from #237's
   count when it has shipped, else #164's; *Set the %* opens the stepper. Guide update for Job
   Mode.
5. **PR 5 — the ground under the shares (S).** When #234's PR 1 is live, the board's fixture read
   takes the five budget columns so stage shares follow the per-line budgets; the Costs tab's
   *Where we are* card links to the project's card on the board. Gen-types pass if owed.

Each PR: `npm run claim`, a release note, a `docs/recent-features/` fragment, plain words in every
first-timer sentence, `formatErrorMessage` on every failure, `EmptyState` for an empty board
(*Nothing working as a project yet* with the door to the Pipeline).

## Open questions

Each with the recommendation the build takes unless the owner says otherwise:

1. **Who may set the expected hours?** The leader and the office set. A superintendent reads his
   own and its reason; the point is that someone else moved it.
2. **Does a superintendent see other superintendents' projects?** Yes, the whole board; the
   number on his own card is the one that matters to him, and seeing the rest is the incentive.
3. **The gate until #238 ships?** *In order* stage or $25,000 and up. A card for a job that should
   not be there costs nothing; a missing one costs the morning read.
4. **Where does the target live on the Costs tab?** Nowhere: the Costs tab is the budget. The
   board is the target's only home, and the phone reads it.

## Where it plugs in

- `useJobBudget` + `resolveJobBudget` (`src/lib/jobs/jobBudget.ts`): the baseline's hours and
  source (bid v2.3297, typed v2.3299); `spendByComponent` for the money.
- `useBidVsActualBurnInputs` / `useJobChargesTimelineInputs` (`src/lib/jobChargesTimeline.ts`):
  team hours, charge events (team labor with `who` and `hours`, sub labor, purchases) and value
  events (the reports' percents, v2.5245).
- `readTargetMarginPct` (`src/lib/jobs/jobBurnForVerdict.ts`) for the money budget when the baseline
  has no direct figure.
- `lineBudgets.ts` (`calcLineBudget`, `lineBudgetFor`, `lineBudgetEntryOf`) for each line's labor
  hours and dollars; #234's PR 1 (#6745) makes the columns real.
- The stage checklists (v2.6077) for the proof count; the Build desk (v2.5929) for the move's words;
  the Quickfill deck (v2.2145) and Needs you review (v2.5837) for where a project with no budget is
  caught, which stays #234's.
- `ResponsiveModalShell` for the large view and the day window; `JobsStagesCommandBar` for the door;
  `pageGate` for the roles.
