---
name: "GC mode: a schedule builder, phases and rows made once and put on the next job"
number: 204
group: ready
status: proposed 2026-10-27 from the owner's look at another GC's job schedule · the owner took all seven calls as drawn the same day · ready for PR 1, the kernel
summary: >
  The owner saw another GC's job schedule from the sub's side: one list of 50 rows in 8
  phases, each row with a start, an end, a day count, a milestone type and an assignee, the
  job 20 weeks long. A quick-lube shell repeats, so he wants to make a schedule like that once
  and put it on the next job. GC mode has a schedule template today, but it is a timing
  overlay on the lines a job's scope book already has: it keeps no phases, no milestones, no
  office rows and no row the job lacks, it is made only by saving a built job, and it never
  changes once saved. The refined cut is a Templates pill on GC projects where a template is
  phases and rows with no dates, an editor and a paste, and Start from a template on the job
  draws every row from the start day.
next: PR 1, the kernel, which needs none of the screens. Then the migration, the Templates page, the paste, the job's side and the portal, in that order.
size: L (six PRs, each S or M; one migration)
blocker: Nothing. The calls are made.
ver: v2.5188 · 5189 · 5193 · 5200 · 5211
opinion: build — every piece under it exists (the templates table, the draft, the links and spare days, the list view, the portal); what is missing is a template that holds rows of its own and phases, and an editor for it
mockup: to-dos/schedule-builder/mockup.html
---

# GC mode: a schedule builder (#204)

## The ask

The owner, 2026-10-27, looking at a GC's job portal as one of its subs. The job's Schedule tab was
one list: 50 rows in 8 phase groups. Preconstruction and procurement, Sitework and utilities,
Foundations and slab, Building shell, MEP rough-in, Interior and equipment, Exterior sitework,
Commissioning and closeout. Each row had a Start, an End, a day count, a Type column that read
*Milestone* or nothing, and an Assignees column. Each phase row carried its own start, end and days
from its children. The whole job ran 20 weeks. A quick-lube shell is the kind of job that repeats.
He wants to make a schedule like this once and reuse it on the next job of the same kind, with a
start date and its rows assigned to trades.

## What GC mode has today

Read before this was written. Each is a door the builder should go through, not around.

- **A schedule template** (`gc_schedule_templates`, v2.5188, Glossary *Schedule template*). The shape
  of a built job's schedule: each trade line's days, what it waits on with the gap, and its offset
  after them. No dates, companies, percents or moves. Made one way, from the **Templates** card under
  the chart of a job being built (`GcScheduleTemplates.tsx`, `templateShape` in
  `src/lib/gc/schedule/templates.ts`). Its lines never change once saved: the table is append-only by
  privilege but for `name` and `aside_on` (`GC_SCHEDULE_APPEND_ONLY` in `src/lib/gc/doors.ts`).
  Renamed or set aside. Company-wide, read and written by the schedule team through
  `gc_on_any_schedule_team()` (the team door migration of 2026-10-21).
- **Start from a template** on the first draft and on the rough (`GcTemplatePick`,
  `templateDraftPress`, `scheduleDraft`'s `like` in `draft.ts`). A line of the same trade and name
  runs as it ran on the template's job. Every other line takes the stage days. The fit is said before
  anything is drawn (`templateFitWords`). The job keeps the template's name and day.
- **The first draft** (`scheduleDraft`): one bar per line of each trade package's scope book or
  schedule of values, in one of 13 fixed stages read from the words in the line's name
  (`SCHEDULE_STAGES`, `lineStage`), two inspections and three milestones. Every day is a working day.
  The chart marks weekends and six holidays and works them, the owner's ruling of 2026-10-05
  (`network.ts`).
- **A rough schedule** while we bid (v2.5189): a start day, the job's stage days, or a template.
- **Bring in their schedule** (v2.5193, `import.ts`): a Microsoft Project XML or our own export's
  spreadsheet, each file row placed on one of the job's lines. It makes a job's first schedule, not a
  template.
- **On the job**: links with gaps and spare days (`network.ts`), the critical path, the look-ahead,
  moves with a reason, the walk, what-if copies, late notices, Tell the trades, the job's own work
  (**Add an activity**, kind `added`, with a `who`), **Milestones** (`gc_schedule_milestones`, by
  package or the job's own), the list view by stage (`GcGanttList.tsx`, `ganttGroups` by trade, stage
  or company).
- **The trade portal** (`portalSchedule.ts`, `GcTradePortalSchedule.tsx`, v2.5200): the company's
  own bars, the work right before them and the work waiting on them, by company name, never by
  price. Worked out by `gc-trade-portal` so no other bar leaves.
- **The customer's portal** (`PortalGcSchedule.tsx`, v2.5211): the finish against their contract,
  the stages as a strip, the dates to meet and what changed this week. The strip the refined cut
  gives the trade portal is this one's shape.

## The gap, row by row

| What the owner saw | Today | Gap |
|---|---|---|
| Phases as named groups with rolled-up dates and days | 13 fixed stages, read from the words in a line's name. The list groups by stage, trade or company. | Phases the office names, kept in the template and on the job. A phase row that reads from its rows. |
| A row for anything: Notice to proceed, submittals, long-lead orders | A bar is a scope line of a trade package. The job's own work is added on the job by hand and a template drops it. | Office rows and Us rows in a template, drawn on the job as the job's own work. |
| A day count per row | The bar form shows the days. The list shows dates. | A Days column on the list. Small. |
| Milestones as a row type | Milestones live on the job. A template keeps none. | Milestones in a template, drawn as milestones. |
| Assignees per row | A bar's trade package, and its company once awarded. The job's own work has a free-text who. | Trade, Us or Office in the template. The company on the job. No people. |
| A template by job kind | Named, company-wide, no kind. | A kind tag and a filter on the pick. Small. |
| Put a template on a job from a start date | Exists. Covered lines only. | Every row lands. A row the scope book lacks lands too. |
| Dependencies and the critical path | Exist. A template keeps waits, gaps and offsets. | Nothing. |
| Make it once, change it later | Made only from a built job. Never changes once saved. | An editor, and versions. |
| Working days | Every day is a working day. | A call. The other GC's counts are Monday to Friday. |
| A list pasted from a spreadsheet | A file in our export's columns, onto a job. | A paste into the editor, by phase, row, who, days, waits on, gap and milestone. |

## Three ways to offer the builder

The mock-up draws each one. Costs and reuse in short.

**A. A Templates page with an editor, beside the Project Board.** A pill on GC projects. A
template is made from nothing, opened, changed and saved. Cost: the editor is the big piece, with a
new template shape under it. Reuses the templates table, the pick on the first draft, the fit words
and the pills. Leaves the job's side alone until the last PR.

**B. Grow Save as a template, so a job's schedule keeps everything.** The job is the editor. The
save keeps the office's rows, the milestones and the phases. Cost: small, a kernel change in
`templateShape` and `scheduleDraft`. What it misses: a template needs a job first, so nothing is
made once from nothing. The phases stay the 13 stages. A saved template still cannot change. A row
for a trade the job has no package for still has no place.

**C. The job's own list as the builder.** The list the owner saw, made editable in place on the
job, with Save as a template. Cost: large. An editable chart list is a lot of screen, and it fights
a rule the schedule keeps: every change of a bar's days on a job is a move with a reason, and the
trades are told. A builder that asks why on every typed day is the wrong tool. Not recommended as
the main shape. Its one good idea, a phase group on the job's list, is in the refined cut.

**D. Paste rows.** A box that takes tab-separated rows, one a line: phase, row, who, days, waits
on, gap, milestone. Cost: small once the editor exists, on the import kernel's pattern of saying
what it could not read. A complement to A, not a shape on its own.

## The refined cut, D

A, with B's small change folded in and D's paste beside it. The mock-up's D1 to D5.

1. **The Templates page** on GC projects, a pill beside Customers. Every template with its kind,
   rows, phases, weeks, who saved it and the jobs drawn from it. **New template**, **From a job's
   schedule** (today's save, kept, and it now keeps the office's rows, the milestones and the stage
   as the phase), **Paste rows**, a kind filter. A save makes a new version. The jobs drawn from an
   older version keep what they drew. Set aside keeps a template off the pick.
2. **The editor**: phases and rows with no dates. A row has a name, a who (a trade from the scope
   book's list, **Us** for our own crew, **Office** for work nobody is hired for), days, what it waits
   on with a gap, and a milestone tick. A phase's days read from its rows. **Add a phase**, **Add a
   row**, move up and down, move to another phase, take off. A line under the toolbar says the weeks
   it makes from a Monday start. **Days are** Mon to Fri or every day, per template.
3. **On the job, before**: Start from a template says what will land. How many rows and phases, the
   weeks, how many rows land on the job's trades, which rows name a trade the job has no package for
   yet, how many are ours, how many the office's, the milestones, and which of the job's own scope
   lines are in no row.
4. **On the job, after**: the list and the chart gain **By phase**, a phase row reading its start,
   end and days from its rows, a Days column, a Spare column, the company once awarded or
   **No company yet** as a door to Trade partners. From here every change is a move as today.
5. **The trade portal**: above the bars it shows today, the job's phases as a strip with their dates
   and the dates to meet. Never another company's bars.

Is this the best we can do? Three doubts. A template that holds rows the scope book lacks puts two
lists of work on a job, the scope book's and the schedule's, and the office must keep them in step
by hand. The refined cut answers it by never changing the scope book from a template and by saying,
before the draw, which scope lines are in no row. The second doubt is working days. The owner ruled
every day works, and the other GC's counts are Monday to Friday. Both can be true: the template
counts working days, the chart works any day. The third doubt is the editor's size on a phone. The
editor is an office tool at a desk. The list on the job already opens on a phone and stays as it is.

## The owner's calls

The owner took all seven as drawn on 2026-10-27. Each row holds the recommendation the mock-up draws and his answer.

| # | The call | Options | Recommended | Owner's answer |
|---|---|---|---|---|
| 1 | Phases or flat | Named phases per template. Or one flat list grouped by the 13 stages, as today. | Named phases. The 13 stages stay as the fallback for a schedule drawn with no template. | Named phases, as drawn. |
| 2 | Who may make and change a template | The schedule team, the office and any GC project manager. Or a dev and the owner only. | The schedule team, the same people who move a bar. A save makes a new version, so the append-only grant stands and no job's draw changes under it. | The schedule team, with a new version on each save. |
| 3 | What a row is assigned to | A trade, Us or Office. A company. A person. | A trade, Us or Office in the template. The company shows on the job once the trade is awarded, as today. Not a person. People come from the look-ahead and the crew count, not the schedule. | A trade, Us or Office. Not a person. |
| 4 | Working days or every day | A template's days count Mon to Fri. Or every day, as the chart works today. | Mon to Fri in a template, with a switch per template to count every day. The chart keeps the 2026-10-05 ruling and lets a bar sit on any day. | Mon to Fri per template, with the every-day switch. The chart works any day. |
| 5 | What the trade portal shows of it | Its own bars and neighbours, as today. Plus the phases strip and the dates to meet. Plus every bar by company. | The phases strip and the dates to meet above what it shows today. Never another company's bars. | The phases strip and the dates to meet. Never another company's bars. |
| 6 | Where the builder lives | A Templates pill on GC projects. A card on Settings. A card on the Project Board. | A Templates pill on GC projects, beside Customers. The schedule team works there, and Settings is the owner's and a dev's. | A Templates pill on GC projects. |
| 7 | A row whose trade the job has no package for | It lands with No company yet. It adds a package to the scope book. It is left out of the draw. | It lands with No company yet, a door to Trade partners at that trade. A template never changes the scope book. | It lands with No company yet. The scope book is never changed. |

## Where it plugs in

Exists, to reuse:

- `src/lib/gc/schedule/types.ts` (`TemplateLine`, `ScheduleTemplate`, `ScheduleActivity`,
  `ScheduleMilestone`), `templates.ts` (`templateShape`, `templateFitWords`, the name rules),
  `draft.ts` (`scheduleDraft` and its `like`), `network.ts` (links, gaps, spare days, the critical
  path, the calendar), `gantt.ts` (`ganttGroups`, `ganttListGroups`), `import.ts` (the pattern for
  reading rows and saying what could not be read), `portalSchedule.ts`.
- `src/components/gc/GcScheduleTemplates.tsx` (the card and the pick), `GcGanttList.tsx`,
  `GcGantt.tsx` (the Group control), `GcScheduleCards.tsx` (the job's own work and the milestones),
  `GcScheduleImport.tsx` (the window shape for a paste), `src/pages/GcProjects.tsx` (the pills and
  `?view=`), `src/components/gc/GcTradePortalSchedule.tsx` and the customer's
  `src/components/portal/PortalGcSchedule.tsx` (its stages strip).
- Tables: `gc_schedule_templates`, `gc_schedules` (`template_id`, `template_name`,
  `template_used_on`), `gc_schedule_activities` (kinds line, inspection, added), `gc_schedule_links`,
  `gc_schedule_milestones`. The RPC `gc_schedule_draft` takes the whole draft.

New:

- A template shape, version 2: `phases` and `rows` beside the old `lines`, a `kind`, a `version_of`
  and `working_days`. A template saved before reads as rows with the stage as the phase.
- A `phase` on `gc_schedule_activities` and on `gc_schedule_milestones`, and the phases' order on
  `gc_schedules`.
- The draw from rows: a trade row lands on the package's line of the same name, or as the job's own
  work on that package when the line is not there, or with no package when the trade is not on the
  job. An Us row lands on our own package. An Office row is the job's own work with the project
  manager named. A milestone row is a milestone.
- The editor, the Templates page, the paste, By phase, the Days and Spare columns, the portal's strip.

## The PR train

Smallest shippable first. Each PR ships its release note, its fragment and its guide.

1. **The kernel** (S). The template shape v2 in `types.ts`, `templateShape` keeping the office's rows,
   the milestones and the stage as the phase, `scheduleDraft` drawing every row of a template
   including the ones the job lacks, working days when the template says so, the fit words of D3.
   Tests on a quick-lube template of 50 rows. No screen.
2. **The migration** (S). The template columns, the phase on activities and milestones, the phases'
   order on the schedule, a new version row on save with the append-only grant kept. `docs/migrations/`
   and the types regen.
3. **The Templates page** (M). The pill, the list, the editor, New template, From a job's schedule,
   Rename, Set it aside, the kind filter. Guide *build a schedule template*. The Glossary's *Schedule
   template*, the page map's §20 and `docs/twins/APP_DIRECTORY.md`.
4. **Paste rows** (S). The box, what it read and what it could not, a guide section.
5. **On the job** (M). Start from a template draws every row from the start day with D3's words
   before the draw, By phase on the list and the chart, the phase row, the Days and Spare columns,
   No company yet as a door, the Templates card under the chart becoming a door to the page. Guides
   *start a schedule from a template* and *walk the schedule each week* amended.
6. **The portal** (S). The phases strip and the dates to meet on Your schedule on this job, in
   `gc-trade-portal`'s shared copy of the kernels, per call 5. Guide *see what a trade partner sends
   from its portal* amended.

## How to verify

1. On the dev server as the dev: `/dev-login?as=1&to=/gc?view=templates`.
2. Press **New template**. Name it *ZZ TEST quick-lube shell*. Add three phases and eight rows, one
   an Us row, one an Office row, one a milestone. Save.
3. On a bidding test project (*GC test project, delete me* from v2.5188's fragment), open
   **Schedule**, pick Mon Nov 2 and the template. Read D3's words. Press **Draw a first draft**.
4. Check the list By phase: the phase rows' dates and days, the milestone, the Us row on our package,
   the Office row with the project manager named, a trade row with no package reading No company yet.
5. Open the test trade partner's portal link on that job. Read the strip and the dates to meet.
6. Set the template aside and delete the test rows. A template save and a draw write prod rows, so
   steps 2 to 5 wait on the owner's yes.

## Where it stands

Proposed 2026-10-27 and the owner took all seven calls as drawn the same day, so the train can
start with PR 1. Nothing built. The mock-up is drawn from the Templates card, the first draft card,
the list view and the portal as they are on main, with made-up names and dates.
