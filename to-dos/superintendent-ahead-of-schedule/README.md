---
name: "Superintendent ahead of schedule: hours on every commercial job, a line that says ahead or behind, and a reward paid at the certified pay app"
number: 234
group: ready
status: in hand on claude/234-pr4-scoreboard — PR 1a the budgets at award merged 2026-11-07 as v2.6646 (#7244), its migration `20261107150000` pushed and the types regenerated (#7264) · PR 1b the owner tunes merged 2026-11-08 as v2.6656 (#7256), its migration `20261107210000` pushed · PR 1c the weekly review card merged 2026-11-08 as v2.6662 (#7260), its migration `20261107180000` pushed, the types regenerating (#7276) · PR 2 the planned finish merged 2026-11-08 as v2.6665 (#7261), its migrations `20261107190000` and `20261107190500` to push · the owner's three calls recorded on main 2026-11-07 (the office's sign-off counts as certified, the bonus is on hours saved, a sub-performed stage counts on the sub's sheet hours) · PR 4 the scoreboard (#7263) open with its migration · thought through 2026-11-01 with the owner and mocked up in seven boards; PR 1 merged 2026-11-02 as v2.6300 and is live with its migration pushed; the superintendent's line moved to #242's build
summary: >
  The owner's long-term aim: associate hours with commercial work so a superintendent can see
  whether he is on track or ahead of schedule, and so the company can reward superintendents for
  being ahead. Residential and service calls are too hard to estimate and stay out. The app already
  holds the pieces: a job's hours baseline on the Costs tab (from the bid's Labor tab, or typed,
  frozen as a snapshot), the Costs verdict's ahead-of-the-work figure and its time-left-at-pace,
  the Build desk's hours-in against percent-out, the pay application's certified line percents, and
  People → Review's earned column. What is missing is a baseline on every commercial job at award, a
  percent the superintendent cannot grade himself on, a planned finish carried from the bid's rough
  schedule, one line on the superintendent's phone, and a computed score the office pays on. The
  discussion stops here until the owner settles what counts as certified, whether the bonus is on
  hours saved or days ahead, and whether a sub-performed stage counts. Later the same day the
  baseline became a budget: in dollars beside the hours, born on each line the customer sees as
  what the bid's workbench priced it from, assumed by a company split when the line was typed,
  tuned only by the owner, frozen at award as the sum of the lines; and the gate became #238's
  kind, a job priced before the work.
next: Push PR 2's two migrations and regenerate the types; merge PR 4 and push its migration; then the live walk on ZZ Test rows (How to verify), PR 1a's first: a ZZ Test project from a bid with hours on its Labor rows, the award block, the Costs strip's frozen line, Quickfill's *Freeze the book's N h* and its Undo.
size: L as a train of six (M · M · S · S · M · M), PRs 1, 1a, 1b, 1c and 2 shipped; left: PR 4 (M), open with its migration
blocker: None. The owner's three calls were made 2026-11-07 and are written under Open questions.
ver: v2.6300 · 3297 · 3299 · 3361 · 3360 · 3598 · 4781 · 5216 · 5244 · 5245 · 5929 · 6077 · 6090 · 2145 · 5837
opinion: build — the three calls are made and PR 1 is live; the train runs from PR 1a to the scoreboard
mockup: to-dos/superintendent-ahead-of-schedule/mockup-phone.html
---

# Superintendent ahead of schedule (#234)

## The ask

The owner, 2026-11-01, after reading where a job's hours live on the Costs tab:

> It's really hard to estimate the number of hours we should spend on a job when the job is
> residential or a service call. But there's great value in associating those hours with commercial
> work. Long term, one of the features enabled by this is a superintendent's ability to see if they
> are on track or ahead of schedule and then we can reward superintendents for being ahead of
> schedule. Can you help me think through how we could enable and strengthen this in the app?

And, the same day, on saving it: he is not ready to answer the questions, and wants the canvas and the
thinking kept so the discussion can continue before anything is built.

The thinking came out of the owner's larger measure for the app (the read-and-judge session of
2026-11-01): a screen should move decisions off a person who has to think. The superintendent's
decision is "am I ahead or behind, and what do I do today"; the office's is "who earned the bonus".

Later the same day, four turns, each folded into the thinking below:

> What's becoming more clear is maybe we should not put in an hours amount, but we should put in
> an hours budget. As every person who works on a job has varying cost and incurs varying
> overhead for their labor. So maybe we should really use a labour budget?

> For every line item we send a customer, we should have our own interpretation of what the labor
> budget is and what the materials budget is for each line item.

> How can I add this in a tasteful way? Every time an assistant adds in this information, I would
> need to be able to tune it. To be really easy for her.

And the cut between a service call and a project, which became punch list #238: "Service calls,
we don't know how much to bill until the very end. While projects coming from bids or estimates
or even oral conversations, we know how much they are gonna cost before we start."

## The mock-ups

Three boards, made-up names and figures, beside this file:

- `mockup-phone.html` — the superintendent's phone: one card per project with "3 days ahead at this
  pace" or "4 days behind", the done and hours bars, the planned finish against the finish at pace,
  the proof line (the certified pay app percent, the checklist's ready count, his own percent marked
  provisional), the one move when behind, and his running score for the pay-app period.
- `mockup-baseline.html` — the Costs tab's baseline strip in three states: today's amber "no baseline,
  bid sent without hours"; a proposed assumed-hours baseline at award, grey, from the Labor tab's own
  jobs baseline (hours per $1k from similar jobs); and the from-the-bid baseline at award with a change
  order added and the planned finish from the rough schedule. Under them, the Quickfill deck line
  "commercial jobs working with no hours baseline" with its three answers.
- `mockup-scoreboard.html` — People → Review's Schedule table, one row per superintendent, with the
  rule card and the Settings card where the three decisions sit as bracketed choices.

Four more from the owner's later turns, the budgets:

- `mockup-baseline-at-award.html` — the award window that writes one baseline, every time, with
  its source (the bid's Labor rows, the book's assumed hours, typed), the Costs strip in its four
  states (◆ bid, ≈ book, ✎ typed, ! none), the Quickfill deck line for projects awarded before, and
  the row's shape. Drawn in hours; the dollars beside them are the line budgets' sum.
- `mockup-line-budgets.html` — before and after, live: Edit Job's ① Line Items as it is and with one
  quiet budget line under each price, the owner's tuning sheet on a phone with two sliders per line,
  the weekly Needs you review card, and the Settings card with two sliders per stage kind. The
  sheet and the Settings card are live and the after-table follows the sheet.
- `mockup-line-budgets-settings.html` — the Settings card alone, live, the second pass after the
  owner read the first ("easier to navigate, more intuitive, sliders").
- `walk-budgets.html` — the click-through: Assistant at a desk, Owner on a phone, Owner at a desk,
  two projects, one shared state. The assistant adds lines and never sees a budget field; the
  owner tunes with sliders, brushes a split across a job's assumed lines, stamps the rest *Looks
  right*, moves a default from the learning line, and reads the Costs tab as the sum of the lines.
  Its later passes, after the owner walked it and said it was not intuitive enough for an
  impulsive assistant who clicks fast and needs to go back: the Costs tab reads budget, spent,
  earned and kept per line and names the line eating hours; a line's budget opens in place on
  ① Line Items (the ✎) with two sliders that autosave; the assistant's tap shows the same sliders
  read-only (show, never tell); ① Line Items is an editable grid whose last row is the add, the
  kind read from the words, *needs a price to count* instead of an error; × removes with *Put it
  back*; a *Recent changes* strip on every screen holds the last five changes with Undo, and the
  three bulk presses (Looks right, the sheet's Save, Settings' Save) undo with their counts; the
  tune sheet folds the workbench lines. The private artifact the owner clicked through is *Line
  Budgets Walk* — https://claude.ai/artifact/6tqary9zzv5dzKU168tiHX. These passes are the
  build's spec for PR 1b: nothing is final, edit where you look, no scolding.

The wider canvas these came from, with the before-and-after boards of the owner's seven changes, is
*Click Tooling before and after* — https://claude.ai/artifact/3qAyRskDe9gdeQMn8K57g3 (private to the
owner; its before boards hold live figures, so they are not in this folder).

## The thinking

**The measure, in one rule.** For a commercial job, "ahead" is two numbers the Costs tab already
computes and nobody in the field can see: percent done minus percent of baseline hours used (the
verdict's ahead-of-the-work figure, `aheadPts` in `src/lib/jobs/jobCostsVerdict.ts`), and the finish
at today's progress pace against a planned finish (the verdict's `timeLeft`). A real job showed why
the baseline matters: its bid predicted 9 hours, the job took 334, and the only reason the app could
say "the book was light here" is that a number was frozen before the work started.

**Leg one: every project carries a frozen budget at award, hours and dollars, as the sum of its
lines.** Today a baseline exists only when a bid is linked and its Labor tab carried hours
(`job_budgets`, kind `bid`, v2.3297), or when someone typed one on the Costs tab (kind `typed`,
v2.3299). The usual gap is a bid sent without hours. The gate is #238's kind, a job priced before
the work, never the customer's Res/Comm. At award the app writes one baseline, every time, with
its source: the bid's Labor rows when usable, else the book's assumed hours (hours per $1k from
similar projects, the tile on Bids → Labor, v2.3598) marked a guess the way the Bridge greys a
pile, else typed with the typer's name; the award window shows the pick and the other two and
the press names the number and the source; *Not now* still writes the book's number. Refresh from
bid writes a dated sibling and the award row never changes. A Quickfill deck line, *projects
working with no hours baseline*, catches the ones awarded before this shipped, the way the
cleanup deck does (v2.2145).

**A budget in dollars beside the hours.** Two jobs at 480 hours are not the same job if one is run
by a master and a helper and the other by three masters. The bid priced labor in dollars, the P&L
closes in dollars, and the thing to protect is the labor margin, so the office's and the score's
measure is the labor budget at award (hours at the cost rate the line was priced at, burdened)
against the actual labor cost (each clock hour at that person's burdened rate) at the certified
percent. The hours stay beside it because they are the field's lever: a superintendent cannot
change what people cost, only how many hours a stage takes and who he puts on it, "3 days ahead
at this pace" is an hours-and-crew statement, and the labor book learns in hours per fixture and
per stage, so a dollars-only budget could not tell productivity from pay rates. Learn in hours,
budget in dollars, measure both; the Review row shows them side by side so the office can see
which one moved.

**Budgets are born on the line.** The bid's workbench already builds every line from fixtures ×
the book's hours × a rate plus the parts, then flattens it into a price; keeping the labor hours,
the labor dollars and the materials dollars on the line is declining to discard what the pricing
knew. Each line the customer sees carries, inside and never on the customer's paper, those three
numbers and a source: ◆ from the workbench, ≈ assumed by the company's split when the line was
typed, ✎ tuned by the owner. The job's budget is the sum of its lines; the award snapshot freezes
the set; a change order brings its own lines with their own budgets. Progress is already per line
(reports move each line's percent, draws bill by stage, the pay app certifies line percents), and
on a construction job the lines are mostly the stages, so earned labor is computable per stage
and the "stage that is eating hours" becomes arithmetic. Actuals per line come later: labor
inferred to the stage on site now on the Stage Plan with the superintendent able to correct a
day, and Tally's job pick also picking the stage.

**Nobody types a budget; the owner tunes.** The assistant types what she types today, lines and
prices, and nothing stops to ask her for a number she does not have. A workbench line's budget
rides along; a typed line takes the company split for its kind, grey, marked assumed. Under each
price on ① Line Items sits one quiet line: the glyph, a three-part bar (labor · materials ·
margin) and the numbers; the portal, the proposal and the pay app never draw it. The owner tunes
in a pass he makes when he wants: a sheet with two sliders per line, labor and materials, the
margin reading out under them with the target mark and turning red beneath it, the hours
following the cost rate; *Brush* carries one line's split to the other assumed lines on the job,
Undo takes it back, Save names what it writes, and every line he touches reads ✎ with his name.
Where it finds him is Needs you review (v2.5837), once a week: *4 assumed lines on 2 projects
awarded this week*, with *Looks right · stamp 4* and *Tune*. Settings → Jobs & billing → Line
budgets is the whole configuration: two sliders per stage kind (Rough In, Top Out, Trim Set, Any
line) and one burdened cost rate with the roster's figure beside it, each row read out in dollars
and hours on a line of the size he picks; Save moves only lines still assumed. The learning line:
after a handful of tunes on one kind the app offers once, *Your Any lines ran 52% labor against
the 45% default · Use 52%*, and the default moves only with his press.

**Leg two: a percent the superintendent cannot grade himself on.** The crew's stepper sets percent
today (`FieldPctUpdateModal`, `job_pct_events`, v2.5245), and the person being rewarded would control
it. Anchor the scored percent to something outside the crew: the pay application's line percents,
which the AIA G702/G703 form already offers from the crew's figure and the GC then certifies
(v2.6090); inspections passed; and the stage checklist's ready count (v2.6077). The crew's own percent
stays but reads provisional until one of those confirms it. The settlement moment is the certified
pay app, which is also when the money is real.

**Leg three: a planned finish.** The rough schedule on a GC bid already draws weeks by stage
(`gc_rough_schedules`, dev-only, v2.4781). Carry it onto the job at award as planned stage dates,
frozen like the baseline, so "ahead" reads in days as well as hours.

**What the superintendent sees.** One line on his job window and his Dashboard, no money: "Building
C: 52% done, 44% of hours used, 3 days ahead at this pace." Green, amber or red by rule, and when
red, the one move: the stage that is eating hours and has not moved, in the Build desk's own words
(`src/lib/bridge/build/buildDesk.ts`, v2.5929), with Set the % and the checklist as the proof.

**The reward.** Score each superintendent per pay-app period, on certified percent only: the labor
budget earned at that percent minus the actual labor cost at burdened rates is labor kept, with
hours under baseline beside it so the office can see whether pace or crew mix moved it, and days
ahead is its own figure. Pay a share of labor kept, or a day rate for days ahead, when the GC
certifies and the bill goes out. One kernel, two readers: People → Review, which already credits people by the Bridge's earned
rule (`src/lib/people/reviewEarned.ts`, v2.3360) and takes a Schedule column, and the
superintendent's own phone, so he sees the number the office pays on. Never typed, always computed.

**Guard rails.** The baseline is the award snapshot; Refresh from bid writes a dated new one but the
score reads the award. Change orders add lines with their own hours and dollars (a change order is
an estimate flavor and carries Labor rows), so bigger scope does not read as behind. A budget in
dollars rewards crew mix as well as pace, which is mostly right and sometimes not; the checklist
and its signatures (#237) are the counterweight on quality, and hours beside dollars on the Review
row are the counterweight on mix. A job with no baseline is not scored and says so. Sub-performed stages have no clock hours,
so they are scored on the sub's hours or excluded, named either way. Every certified job feeds Book
vs jobs → Set, which calibrates the labor book (v2.3598), so each scored job sharpens the next
baseline. That is what makes the Bridge's Build link (v2.5216, v2.5244) a reading instead of a guess.

## Open questions

The owner's three, put to him on 2026-11-07 with the card's recommendation beside each, and his
answers:

1. **What counts as certified?** The GC's certified pay application, a passed inspection, or the
   office's sign-off. The card recommended the pay app. **His call: the office's sign-off.** The
   scored percent is the one the office confirms on the job; the crew's own percent stays
   provisional until the office signs it. The plan reads a GC's certified pay app, when there is
   one, as the office's sign-off too, so a GC job settles at the pay app without a second press.
2. **Hours saved or days ahead?** Hours saved against the baseline at the job's labor rate, paid as a
   share; or days ahead of the planned finish at a day rate. **His call: hours saved**, the card's
   recommendation. The bonus is a share of labor kept (the labor budget earned at the certified
   percent minus the actual labor cost at burdened rates), with hours under baseline beside it; days
   ahead stays its own figure on the row and on the phone once PR 2 lands, never paid on.
3. **Does a stage a sub performs count?** Sub labor sheets carry no clock hours. Count it on the sub's
   sheet hours, or leave it out of the score. The card recommended leaving it out. **His call: it
   counts, on the sub's sheet hours.** A sub-performed stage's actual labor is the sub labor sheet's
   hours at the sheet's rate (the sub's dollars already land as sub labor on the Costs tab), so a
   superintendent who runs subs well is rewarded with the rest.

Four more from the budgets, each drawn one way in the boards and his to flip:

4. **Which rate is the budget?** The bid's *cost* rate per line where it has one, else the
   Settings rate, burdened; never the sell rate, since sell minus cost is margin, not performance.
5. **Burden per person, or one factor?** Per-person burdened rates are the honest version; until
   they exist, one company factor on each pay rate is one Settings number and good enough to start.
6. **Who sees the dollars?** The office and the estimator; the superintendent reads hours per stage
   and no money, as his phone is today.
7. **Does the learning line move a default by itself after N tunes, or only with his press?** Drawn:
   only his press.

And three the build will meet: whether the assumed baseline scores at all or only the from-the-bid
and typed ones (the mock-up says only those score); whether a superintendent sees other
superintendents' rows (the mock-up shows him only his own); and what a job that runs over reads on
the scoreboard (the mock-up shows a negative figure and "$0, nothing owed back").

## Where it plugs in

What exists:

- `job_budgets` with kind `bid` / `typed` and the resolved budget's three footings
  (`src/lib/jobs/jobBudget.ts`, v2.3297); the Costs tab's baseline strip and Budget card
  (`src/components/jobs/JobBudgetCard.tsx`, `JobCostsVerdict.tsx`, v2.3299, v2.3361).
- The verdict's ahead-of-the-work and time-left-at-pace (`src/lib/jobs/jobCostsVerdict.ts`).
- The Labor tab's head: usable-as-a-job-budget bar, field hours, jobs baseline per $1k, Book vs
  jobs → Set (`docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`, v2.3598).
- Percent done: `job_pct_events`, the crew's stepper and the office's percent window (v2.5245); the
  pay application's line percents offered from the crew's figure (v2.6090); the stage checklist's
  ready count (v2.6077).
- The rough schedule on a GC bid (`gc_rough_schedules`, v2.4781).
- The Build desk's hours-in against percent-out per job (`src/lib/bridge/build/buildDesk.ts`,
  v2.5929) and the earned rule (`src/lib/bridge/earnedRevenue.ts`).
- People → Review's earned column (`src/lib/people/reviewEarned.ts`, v2.3360).
- The superintendent's reach: assigned projects, the percent stepper, job thread notes, no money
  (`docs/ACCESS_CONTROL.md` → superintendent).
- The job's lines: the Stage Plan rows (`jobs_ledger_fixtures`) and ① Line Items on Edit Job
  (`src/components/jobs/JobFormFixturesSection.tsx`); the bid's Labor and Pricing tabs, where each
  line's hours and parts are computed today and then flattened into a price.
- Quickfill's deck lines (v2.2145) and Needs you review (v2.5837), where the owner's weekly card
  goes; the job kind from punch list #238.

What is new: per line, `labor_hours`, `labor_cost`, `materials_cost`, `budget_source`
(`workbench` · `assumed` · `tuned`), `tuned_by` and `tuned_at`, on the Stage Plan row or a
`job_line_budgets` table beside it; the award snapshot and its freeze with the job's footings as
the sum; the award window; the quiet line and the Tune door on ① Line Items and the Pricing tab;
the tuning sheet with the brush; the Needs you review card; Settings → Line budgets with the
splits, the rate and the learning line; planned stage dates on the job; the superintendent's line
kernel and card; the Schedule column and the bonus setting; the certified-percent source rule.

## The plan

1. **PR 1 · the line budgets** (M), shipped 2026-11-02 as v2.6300 (#6745) with its migration
   pushed. The budget is columns on the line item row (`budget_labor_pct`, `budget_materials_pct`,
   `budget_source`, `budget_tuned_at`, `budget_rate_usd` on `jobs_ledger_fixtures`), written by the
   same autosave that writes the price; the quiet line under each line on ① Line Items, with the
   owner's two sliders opening in place; the Costs tab's *Where we are* card, spent of the whole
   budget with a row per line; and the owner's two grid asks, the stage badge as the press and the
   cents small. What shipped and how is `docs/recent-features/v2.6300.md`.
2. **PR 1a · the budgets at award** (M), open 2026-11-07 as v2.6646 with its migration
   (`20261107150000_job_budget_award.sql`: `job_budgets.kind` gains `book`, eight `awarded_*`
   columns hold the frozen award, `set_book_job_budget` and `award_job_baseline`). The gate is
   #238's `jobKind` on the quiet line and the Costs card; the *Bid price* line a bid import carries
   takes the bid's labor and materials shares as ◆ (the bid's rows never reach the job, so the ◆
   lands on the carried line, not per stage); the *Hours baseline at award* block on New Job picks
   bid → book → typed and Create Job freezes it through `award_job_baseline`; the Costs strip's
   four states with the frozen line and the score words; the Needs You line *N projects working
   with no hours baseline* with its Fill them in presses. Left out, with the reason in
   `docs/recent-features/v2.6646.md`: the Pricing tab's quiet line (its workbench rows already
   read labor, materials and margin per line, and the cover letter carries none of it).
3. **PR 1b · the owner tunes** (S), open 2026-11-07 as v2.6656 with its migration
   (`20261107210000_line_budget_settings.sql`: one `app_settings` row and the owner's write policy).
   Settings → Jobs & billing → Line budgets with two sliders per kind, the burdened cost rate with
   the roster's beside it, the target margin, the read-out on a chosen line size, Save naming what
   it writes and moving only lines still assumed, the learning line on its kind's row; every reader
   of the budgets on the shared settings; the brush on a line's panel with Undo. **PR 1c**, open the
   same day as v2.6662 with its migration (`20261107180000_fixture_budget_reviewed.sql`: the reviewed
   mark on the line row and the owner's stamp): the owner's weekly Needs you line *4 assumed lines on 2
   projects awarded this week* over the award freeze, its window listing the lines with *Looks right ·
   stamp 4 lines* (reviewed with his name, left assumed) and *Tune*. Left out for good: spent per line,
   since no hours land on a stage yet (the clock has no stage), named in `docs/recent-features/v2.6656.md`.
4. **PR 2 · the planned finish** (S), open 2026-11-07 as v2.6665 with two migrations
   (`20261107190000_job_planned_finish.sql`: six `planned_*` columns on `job_budgets`,
   `set_job_planned_finish`, `award_job_baseline` taking `p_planned`; `20261107190500_project_board_planned_finish.sql`:
   the board's read returns it). The plan freezes with the hours at award from three sources in order:
   the GC project's rough schedule when its weeks were kept (`gc_rough_schedules.kept_finish`; the rough
   stores no per-stage dates, so the finish is the whole job's), else the start the bid assumed and the
   baseline hours at 24 crew hours a day in working days (assumed), else a typed day; the award block
   draws it under the hours, the Costs strip's frozen line ends with it and offers a date box where
   none is set, the Projects board and the superintendent's line read days against it.
5. **PR 3 · the superintendent's line** (M), moved to punch list #242, the Projects board, which
   builds the line with the office's board from the same kernel; its card is the spec. Its kernel
   and pace strip (#6769) and the expected hours (#6771) merged 2026-11-02; the board and the phone
   card were in review. What stays here is the line's ground: days against the planned finish once
   PR 2 lands, and the certified percent as the proof.
6. **PR 4 · the scoreboard** (M), open 2026-11-07 as v2.6666 with its migration
   (`20261107200000_superintendent_scores.sql`: `superintendent_scores(from, to, job_ids)`, SECURITY
   DEFINER, and the `superintendent_bonus_v1` row with the owner's write policy), on the owner's three
   calls: the certified percent is the office's own sign-off (the newest percent an office role set),
   the bonus is a share of the labor kept (the award's labor dollars at that percent minus the team at
   the burden factor and the subs on their sheet hours), a sub-performed stage counts on its sheet
   hours. People → Review → Scoreboard (the dev-only sample of v2.1312 replaced; a dev or a
   pay-approved master) reads one row per superintendent for a month with the jobs signed off, hours
   used of earned, days against the plan, labor kept and the bonus, the held jobs named with their
   reason, and the rule; the superintendent's card on Job Mode reads his own row, no wage; Settings →
   People → Superintendent bonus holds the share.

## How to verify

On the dev server as the dev, prod data, nothing written outside ZZ Test rows: make a ZZ Test
commercial job from a ZZ Test bid with hours on its Labor rows, award it, and read the strip
(frozen hours, the planned finish); clock ZZ Test hours and set a percent; read the superintendent's
line as the Superintendent sample through View as; certify a ZZ Test pay app and read the Review
row. Delete every ZZ Test row after.

## Where it stands

2026-11-07: the owner made the three calls (above). PR 1a opened the same day as v2.6646 with its
migration, PR 1b as v2.6656, PR 1c as v2.6662, PR 2 as v2.6665 and PR 4 as v2.6666, each with its own,
each to be pushed right after its merge; PR 1a merged the same day and its push is owed. PR 3 builds
on #242 from the same kernel. What is left after the merges: the pushes, `npm run gen-types`, and the
live walk on ZZ Test rows (How to verify). The ground for PR 4 is settled: the certified percent is the
office's sign-off, the bonus is a share of labor kept, and sub stages count on their sheet hours.

2026-11-01: thought through with the owner and mocked up; nothing built. The owner asked to keep the
canvas and the thinking here and to continue the discussion before any PR. PR 1 is safe to build
before his three calls; PR 3 and PR 4 are not. Later the same day his four turns on the budget
(dollars beside hours, born on the line, tuned by him alone, gated by #238's kind) were folded
in with their boards and the Line Budgets Walk; PR 1 is now the budgets at award and PR 1b the
tuning, and the four new calls carry the drawn defaults until he flips them.

Same evening, a design spike in the real app (worktree `spike-line-budgets`; its code is kept on
`origin/spike/projects-board-242`, a branch that never merges):
the quiet line under each line item on Bill → ① Line Items, the two sliders opening as a row
under the line with *Back to* and autosave, and a Costs tab card reading the sum of the lines
and a row per line, walked on a ZZ Test project of four lines. The sliders and the one-press
Back to are right; the margin line in red under target is the thing the owner wants. The spike
kept its budgets in a store keyed on the grid's row id, and a reload lost the tuning while the
line stayed, because the form mints that id and the save hands back other ids — so PR 1 keeps
the budget on the row. Also found: the ✎ press collides with the name box's ✎ (the source glyph
becomes the press); the Costs tab's amber *No baseline* strip must give way to the card; *Kept so
far* reads as profit with nothing spent; a line with no percent of its own must not borrow the
job's. The owner's two grid asks from the same walk (the badge as the press, small cents) are
built in the spike and fold into PR 1. His third ask, the per-line table on the Costs card,
is redrawn in the spike as one row per line with the same reading as the quiet line (glyph,
name, price; the labor | materials bar with the line's own percent as a mark across it; the
words under it), *Kept so far* reading "—, nothing spent yet" until something is spent, and no
line borrowing the job's percent; PR 1 draws it that way.

2026-11-02: PR 1 merged as v2.6300 (#6745). Its migration `20261102003938` is on prod, the five
columns read back in the live schema, and the Pages deploy of the merge went out. The
superintendent's line moved to #242, whose build started from the same spike. Next is PR 1a;
PR 3's ground and PR 4's reward still wait on the owner's three calls.
