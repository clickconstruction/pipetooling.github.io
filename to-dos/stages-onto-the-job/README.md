---
name: "Stages onto the job: a won bid offers its stages as the job's lines, and the superintendent gets a way in"
number: 397
group: ready
status: asked 2026-11-18 · reviewed, drawn and planned the same day · the owner's word *build on defaults, build it all* · PR 2, the rule file, on `claude/stages-rule` with this card · PR 3, the window on New Job, on `claude/stages-offer`, walked on the dev server with the ZZ bid · PR 1 offered to its own session · PR 5 waits for punch list #396's open PRs · PR 7 held by the owner's default
summary: >
  The app calls five things a stage, and only the Pipeline's is used on every job. Everything new that
  reads a job's stages (the pace card's rail, the Projects board, the stage checklists, Before we start)
  reads the job's lines, and a job opened from a won bid arrives with one line, Bid price. The bid knew
  Rough In, Top Out and Trim Set with hours for each, and that is dropped at the one moment it is needed.
  This card fills the lines at the win by an offer the office accepts, makes the same offer on a job
  still on one clean line, opens the superintendent's doors to the stages, and tidies three small things
  found on the way. Seven small PRs, no new table and no database change.
next: PR 4, the same offer on a job that already exists, stacked on PR 3.
size: M as a train of seven (S · S · M · S · S · S · S)
blocker: None. PR 5 waits for punch list #396's four open PRs. PR 6 waits for the owner's look at the lines it re-reads. PR 7 is held until crews mark stages on real jobs.
opinion: build — the owner picked this direction over doing nothing and over one shared stage system, and took every default
---

# Stages onto the job (#397)

[mockup.html](mockup.html) is six drawn screens, in the order a job meets them. Every job, bid, price,
hour and percent in it is made up. The dashed outline marks what this card adds.

## The ask, in the owner's words

> can you look at how stages on jobs work, and how we define stages in bids GC mode and stages in
> Developments and how stages look to superintendents on the dashboard. Can you help figure out where
> we should offer connection and how we should make it easy for a superintendant or master to define
> the criteria for starting another stage, marking % complete, and other features in this domain. can
> you look at it all holistically and let me know how we should improve access and flow and if further
> connections should be made or if we should do nothing at all?

Shown the review's three directions (do nothing; one connection and three doors; one shared stage
system):

> I love B, mock it up and come up with a detailed plan and show it to me before we build the PR train

Shown the mock-up, the seven PRs and six calls with a default each:

> build on defaults, build it all

## What the review found

- **Five things share the word.** The Pipeline stage (`jobs_ledger.status`). The stage line, a priced
  line on the job's Bill tab marked In order or Any time (`jobs_ledger_fixtures`). The bid's Rough In,
  Top Out and Trim Set. The workflow step under Projects (`project_workflow_steps`). The GC project's
  stage (`gc_projects.stage`). The Development page has none of its own: it shows each job's Pipeline
  stage.
- **Only the Pipeline stage is in real use.** On 2026-11-18 most jobs with lines had exactly one line.
  A handful of lines were In order. Two lines had ever been given their own percent. No stage window
  and no stage checklist answer existed. The workflow steps had not been touched since August. GC mode
  held test projects only.
- **The stage line is the hub.** The pace card, the Projects board, the checklists, the draws that go
  in order and Before we start (#382) all read it.
- **A won bid does not fill it.** `bidImportFirstLine` in `src/lib/bids/jobImportFromBid.ts` makes one
  line. Only the bid's total hours cross, frozen at the win.
- **One percent is marked and already reaches money as an offer.** The Pipeline's *Bill the finished
  work* is each Working job's percent times its price (`jobCapableToBillAmounts`).
- **The superintendent cannot reach where stages are set.** His Jobs tabs are Reports and Subs. The
  Projects board opens for him with no door but the search.

## What a closer read changed

- **The bid cannot give the dollars. It can give the hours.** The app's own reader
  (`loadBidScheduleForJob`) found a schedule of values on no won bid: the schedule is built from
  materials by stage, and nearly every won bid has none. A third of the won bids carry hours for all
  three stages. So the dollars follow the company's own terms, the Multiple Segment Generator's
  presets, and the hours follow the bid's Labor tab. A bid that does have its own schedule still wins,
  as it does on the pay application.
- **Lines arrive Any time.** `stageRecognition.ts` already draws lines named Rough In, Top Out and
  Trim Set as stages on the Pipeline and in the crew's report, while the billing rule stays behind the
  In order badge (the owner's call of 2026-09-14, *row only, for now*). In order stays one tap away.
- **The board on a phone.** `PaceStrip` drops *hover one* on a touch screen, so a phone reads
  *3 stages* with no way to open them.
- **The Stage Plan's ready to bill** reads a sub's passed inspection through a stage window. It never
  reads the crew's 100%.
- **Two readers of a stage's name disagree.** `stageRank` (`src/lib/jobs/stageRecognition.ts`) reads
  the start of the name. `bidStageOfLine` (`src/lib/bids/stageEarnedValue.ts`) reads anywhere in it.

## The owner's calls, 2026-11-18

Each was put to him with a default, and he took every default.

| # | The call | Taken |
|---|---|---|
| 1 | Where do the dollars for each stage come from? | The company's terms, by chip: 30/30/30/10 or 40/40/20. The bid's own schedule of values wins when it has one. Never by hours. |
| 2 | Does 30/30/30/10 bring a fourth line, Final? | Yes. It is the generator's own preset. |
| 3 | The stage checklists wake up on these jobs, and the Pipeline reads *not ready* until the crew answers. | Yes, let them. |
| 4 | Does a superintendent see every project on the board, or only his own? | Every project, as the board does today. |
| 5 | PR 6 changes how a few lines on open jobs are read. Does he see them first? | Yes, on a private page before PR 6 opens. If one looks wrong, the rule changes, not the line. |
| 6 | Is PR 7, the 100% notice, built now or held? | Held until crews mark stages on real jobs. |

## Guard rails

- **Never silent.** Stages come only when a person picks *As stages*. The estimator's draft path keeps
  bringing one line and asks nobody.
- **Never touches a bill.** A line on a bill, or a job with a pay application, is not offered the split.
- **Never changes how a job bills.** Lines arrive Any time.
- **Never moves the frozen hours.** The hours frozen at the win stay. The lines' sum sits beside them.
- **Never invents a number without saying so.** The window says where the dollars and the hours came
  from: the bid, the company's terms, or assumed.
- **A percent offers a bill. It never sends one.**

## Where it plugs in

Exists today: the carry question on New Job from a bid (`useJobFormImport.ts`,
`bidImportCarryQuestion`); the generator's presets and its cents-exact split
(`src/lib/jobs/segmentGenerator.ts`); the bid's schedule as lines (`src/lib/aiaBidScheduleIo.ts`); the
bid's breakdown with hours by stage (`bid_estimate_breakdown`, `AwardBidBreakdown`); the line budget's
five columns and their reader (`src/lib/jobs/lineBudgets.ts`); stage recognition; the pace card and
its rail (#396); the Projects board and `DashboardProjectsStrip`; the stage checklist's sheet.

New: the rule file `src/lib/bids/jobStagesFromBid.ts`; the window `BidCarryWindow`; one link beside
Multiple Segment Generator; a press on a rail's stage; the board's stages as a press; the Projects bar
for a superintendent; one reader for a stage's name; an empty state on the Workflow page.

## The plan

Seven small PRs. Each claims its own version and ships its release note, its fragment and its guide
words.

| PR | What it brings | Size | Touches | Waits on |
|---|---|---|---|---|
| 1 | **The Workflow page stops writing on open.** An empty state with *Start a workflow*. | S | `useWorkflowStepsEngine.ts`, `Workflow.tsx` | Nothing |
| 2 | **The rule, no screen.** A price, a split and a bid's stage hours become job lines that add up to the cent. The rule for a job that exists, with each hold and its words. | S | `src/lib/bids/jobStagesFromBid.ts` and its tests | Nothing |
| 3 | **The offer on New Job from a won bid.** One window, three answers: *As stages*, *As one line*, *Start at $0*. | M | `useJobFormImport.ts`, a new `BidCarryWindow.tsx`, a new guide | PR 2 |
| 4 | **Bring the bid's stages on a job that exists.** The link beside Multiple Segment Generator, or the reason it is held. | S | `JobFormFixturesSection.tsx`, `JobFormModal.tsx` | PR 3 |
| 5 | **The superintendent's doors.** A press on each stage of the rail, *All projects*, the Projects bar on his Dashboard, the board's stages as a press. | S | `PaceRail.tsx`, `SuperintendentCard.tsx`, `PaceStrip.tsx`, `DashboardProjectsStrip.tsx` and its gate | Punch list #396's open PRs |
| 6 | **One reader for a stage's name.** The job's reader and the bid's become one rule. | S | a new `src/lib/jobs/stageWord.ts`; `stageRecognition.ts`, `stageEarnedValue.ts`, `aiaBidSchedule.ts` read it | The owner's look (call 5) |
| 7 | **A stage at 100% that is not billed.** One Needs you line, with the Bill tab as its press. | S | `dashboardNeedsYou.ts` and its read | Held (call 6) |

PR 3 should land before #382's fourth PR, *The list on a stage*, so that list has stages to sit on.

## Left out on purpose

- The Dashboard's *In progress stage:* line. It reads the workflow step through two list functions in
  the database, and it shows on almost no job.
- The GC schedule's two readers of a stage's name. GC mode has no real job.
- Hours per stage on the clock, which #234 already plans.
- A record for a home in a development.
- One shared stage definition for bids, jobs and developments. If this card gets real use, PR 6's one
  reader is its first step.

## How to verify

- **PR 2:** `npx vitest run src/lib/bids/jobStagesFromBid.test.ts`.
- **PR 3 and PR 4:** render smokes for each answer and each hold. One live walk on the ZZ rows: open a
  new ZZ job from the ZZ bid, pick *As stages*, read the Bill tab, save, read the Pipeline row and the
  pace card. That walk writes a ZZ job, so it is asked for first.
- **PR 5:** walked as the Sample superintendent at phone width, reading only.
- **PR 6:** one table of names and the stage each must read, run against both old readers first, so
  the PR shows which rows move.
- Every PR: the dev server at phone and computer width, light and dark.
- No real job's name or figure goes in a test, a comment, a PR or this card.

## Where it stands

PR 2 is on `claude/stages-rule` with this card. PR 3 is on `claude/stages-offer`, stacked on it.

PR 3's walk, 2026-11-18, on the dev server with the ZZ bid, reading only: the window opened, **Bring 4 stages** laid four Any time lines into Line Items, and the form was closed unsaved. The walk caught one flaw before it shipped. A stage the Labor tab put at 23 h read 15 h on its line, because every reader of a line works hours out at the company's rate. The rule now values the hours at that rate, so a line reads the bid's own hours back, within a percent of its price.

Not walked yet: a saved job, which writes a ZZ row.
