---
name: "Superintendent ahead of schedule: hours on every commercial job, a line that says ahead or behind, and a reward paid at the certified pay app"
number: 234
group: gated
status: thought through 2026-11-01 with the owner, read against the Costs tab, the Labor tab, the Build desk and People → Review; later the same day his four turns folded in (the kind by when the price is known, a labor budget in dollars beside the hours, budgets born on each line, the owner tuning what the assistant never types), with three more boards and the Line Budgets Walk; seven mock-up files; a design spike in the real app the same evening proved the sliders in place and settled that the budget is columns on the line row, and carries the owner's two grid asks (the badge as the press, small cents) into PR 1; nothing merged; three decisions are the owner's and he is not ready to make them
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
next: The owner's three calls under *Open questions*. Then PR 1, the budgets at award, which is useful on its own.
size: L as a train of five (M · S · S · M · M); two migrations, the line budgets at award and the planned dates; no edge function
blocker: The owner's three calls. He said on 2026-11-01 he is not ready to answer them yet; the card holds the thinking until he is.
ver: v2.3297 · 3299 · 3361 · 3360 · 3598 · 4781 · 5216 · 5244 · 5245 · 5929 · 6077 · 6090 · 2145 · 5837
opinion: later — the thinking is sound and PR 1 is safe to build before the calls, but the reward is the point and the reward waits on what counts as certified
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

The owner's, and he said on 2026-11-01 he is not ready to answer them:

1. **What counts as certified?** The GC's certified pay application, a passed inspection, or the
   office's sign-off. The pay app is the recommendation: it is the GC's word and the moment the bill
   goes out.
2. **Hours saved or days ahead?** Hours saved against the baseline at the job's labor rate, paid as a
   share; or days ahead of the planned finish at a day rate. Hours saved is the recommendation: it
   needs only leg one and two, and it is the number the book learns from.
3. **Does a stage a sub performs count?** Sub labor sheets carry no clock hours. Count it on the sub's
   sheet hours, or leave it out of the score.

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

1. **PR 1 · the budgets at award** (M). The gate on #238's `jobKind`; the line columns (one
   migration): a workbench line keeps the hours and parts it was priced from, a typed line takes
   the company split for its kind, marked assumed; the award window that writes one baseline every
   time with its source (bid → book → typed), the job's footings as the sum; the Costs strip's four
   states; the quiet line under each price on ① Line Items and the Pricing tab, never on a
   customer's paper (the lens's What customers see check proves it); the Quickfill deck line
   *projects working with no hours baseline*. Useful on its own: the Pipeline's burning card and
   the Build desk read it at once. The spike (below) settled three things PR 1 carries: the
   budget is columns on the line item row itself (`budget_labor_pct`, `budget_materials_pct`,
   `budget_source`, `budget_tuned_at`, `budget_rate_usd` on `jobs_ledger_fixtures`), written by
   the same autosave that writes the price, never a store keyed on the grid's row id; and two
   grid changes the owner asked for on the same screen ride with it: the stage badge is the
   press (tap the number or the diamond to flip In order / Any time, the kind in very small
   words under it, the two-button strip under each line gone), and the cents read small in the
   Unit price boxes and the Job Total (`MoneyDecimalAmountInput`'s `smallCents`, the overlay the
   Other charges box uses).
2. **PR 1b · the owner tunes** (S). The tuning sheet with two sliders per line, the brush, Undo and
   Save with the owner's name; the weekly Needs you review card with *Looks right* and *Tune*;
   Settings → Jobs & billing → Line budgets with the splits per kind, the burdened cost rate and
   the learning line, Save moving only lines still assumed.
3. **PR 2 · the planned finish** (S). Carry the rough schedule's stage weeks onto the job at award as
   planned dates; one migration with the award snapshot's freeze.
4. **PR 3 · the superintendent's line** (M). The kernel (ahead-of-the-work, days vs plan, the proof
   sources, the one move), the card on his Dashboard and job window, the guide. Hours and days
   only; no money on his phone.
5. **PR 4 · the scoreboard** (M). The Schedule column on People → Review with labor kept in dollars
   and hours under baseline side by side, the superintendent's own row on his phone, the bonus rule
   in Settings → People, paid at the certified pay app.

## How to verify

On the dev server as the dev, prod data, nothing written outside ZZ Test rows: make a ZZ Test
commercial job from a ZZ Test bid with hours on its Labor rows, award it, and read the strip
(frozen hours, the planned finish); clock ZZ Test hours and set a percent; read the superintendent's
line as the Superintendent sample through View as; certify a ZZ Test pay app and read the Review
row. Delete every ZZ Test row after.

## Where it stands

2026-11-01: thought through with the owner and mocked up; nothing built. The owner asked to keep the
canvas and the thinking here and to continue the discussion before any PR. PR 1 is safe to build
before his three calls; PR 3 and PR 4 are not. Later the same day his four turns on the budget
(dollars beside hours, born on the line, tuned by him alone, gated by #238's kind) were folded
in with their boards and the Line Budgets Walk; PR 1 is now the budgets at award and PR 1b the
tuning, and the four new calls carry the drawn defaults until he flips them.

Same evening, a design spike in the real app (worktree `spike-line-budgets`, nothing committed):
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
