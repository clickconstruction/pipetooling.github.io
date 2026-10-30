---
name: "Show it, don't say it: seven shapes for the 131 places the app still tells"
number: 217
group: gated
status: scanned and drawn 2026-10-30 · eight read-only scans of main at 9e8f233, 131 findings, drawn as seven shapes with 51 before/after pairs and a second pass on each (shape 1 drawn whole on the owner's ask the same day; Draft Payroll, the Pricing tab and the Project Board drawn on the pages they land on, on her notes) · waiting on the owner's picks
mockup: to-dos/show-not-tell/mockup.html
summary: >
  Taunya asked for a scan of the whole app for the places it tells instead of shows, so a reader sees
  processes they can understand and trust instead of wondering where text comes from. Eight scans walked
  every area and wrote up 131 places where a sentence stands where a shape should: a date said in words,
  a figure with its parts in a caveat, a guess drawn like a fact, a process reported after the fact, a
  count with no names, a verdict with no visible making, one fact said three times. Every one wants one
  of seven shapes the app already has since #214 drew the Legal desk's four. The mock-up teaches each
  shape once with its strongest pairs and lists every other place under it, with Build · Later · Drop on
  each, so a yes can be a yes to a shape as much as to a screen.
next: The owner's picks on the mock-up (the claude.ai copy saves them as she presses; the repo copy's Copy my picks pastes them). Then one build session per picked shape, cut by weight, each PR one screen or one kernel plus its places.
size: XL as a program; each pair is XS to M on its own (the pairs say which), five need a function deploy, two a small migration
blocker: The owner's picks.
opinion: build — start with shape 3 (a mark and a door, XS to S each, and field-1 fixes a wrong record), then shape 6 (the verdicts the office and the owner act on daily), then 1 and 2 (one kernel and one drawing each, reused across their places), then 4; 5 and 7 ride along as each surface is touched
---

# Show it, don't say it: seven shapes for the 131 places the app still tells (#217)

## The ask

Taunya, 2026-10-30: *"I would like to scan the app for areas we are telling too much instead of showing and
come up with mockups for what improvements could look like. We want the user to see processes that they
feel like they can understand and trust instead of wondering where text comes from."* Then: send out a
batch of Opus sessions to scan, draw before and after for what comes back, give every mock-up a second
pass (*is this the best we can do?*), and present current against refined in one HTML file to approve
from, with the approved ones built in new sessions. The prior art is #214, the same question asked of the
Legal desk on 2026-10-29 and answered by four PRs (v2.6104 to v2.6108).

## The read

Eight read-only sessions, one per area (the Jobs hub's operations side; its money side with Banking,
Tally, Estimates and what #214 left on the Legal desk; Bids; GC mode, Messages, Prospects and Customers;
the Dashboard, Quickfill, the Bridge and Settings; the phone; People, Materials, Documents and workflows;
the outside pages and everything the app sends), each briefed with twelve patterns of telling and the
shapes that show, read the code on `main` at `9e8f233` and looked at the screens through the sealed lens
(Settings → What everyone sees) on invented data. They wrote 131 findings, each with its door, the kernel
and inputs the words come from, the pattern, the shape, what to reuse, a weight and a size. The eight files
are gitignored under `.claude/sessions/scans/show-not-tell/findings/` in the checkout that ran them; the
mock-up carries everything a builder needs from them.

The 131 collapse into seven shapes, and every shape already lives somewhere in the app:

| Shape | The rule | Lives in the app as | Places |
| --- | --- | --- | --- |
| 1 · A date against today | A time said in words is a position left undrawn | the Timeline strip (v2.6107), the Lien desk's Deadlines track, the Windows calendar | 24 |
| 2 · A figure as its parts | A number with a caveat is a bar left undrawn | the money bars (v2.6105), the Pipeline row's paid · billed bar, the G702's columns | 24 |
| 3 · The source on the figure | A guess that looks like a fact is the purest "where did this come from?" | the Labor book's provenance chips, `PercentProvenanceChip`, the bill reader's tints | 22 |
| 4 · A process as its steps | A run reported as a sentence is a stepper left undrawn | Quickfill's stations, GC Review's Check → Send → Word, the outbox door, `batchOutcomeWords` | 21 |
| 5 · Counts that open | A count with no names is a list left unopened | the Timeline's count chips (v2.6107), the Evidence filters (v2.6108), Crew Day's chips | 23 |
| 6 · The verdict lights its cause | A verdict with no visible making is a red rule left undrawn | the Pipeline's red rule on a hot row, the gap chips (v2.6104), the Robot envelope's trio | 13 |
| 7 · Say it once | One fact said three times is three places to doubt | the Evidence row's chip with the record on hover (v2.6108), the portal's ruled sum | 4 |

## The mock-up and its second pass

`mockup.html` teaches each shape once: its rule, where it already lives, then the strongest pairs (51 in
all, covering 55 findings since four ride with a sibling; shape 1 is drawn whole, all 24 places, on the owner's
ask of 2026-10-30 after she had picked over its first six), each the screen's words of today in a dashed
frame beside the shape drawn in a solid one, the lines under them saying what the shape gains and what it
reuses, and a blue *Second pass* box saying what the first render got wrong and what moved. Under each
shape a table lists every other place that takes it (76 rows) with today's words, the shape in one line,
weight and size. Every pair and every row carries **Build · Later · Drop** and a note line; a shape's
header carries *Build all · Later all · Drop all · Clear*. The claude.ai copy of the page
(https://claude.ai/artifact/3f74NuNKDsMAtpGcFgCV1v) saves the picks as they are pressed; the repo copy
keeps them in the browser and **Copy my picks** puts them on the clipboard. Every name, job, street and
figure is invented (Hillcrest Builders, Sample Retail Shell 1318, Hal · Rosa · Cora · Dana Sample).

The second pass, done on a 1,280 px frame, in dark, and at 390 px: a dozen pairs moved. Labels on the
Billed row's track collided and ran off the frame (the months went, today moved under the axis); three
labels under the nudge strip overprinted (two stay, a legend names the dots); the Compare quotes and
Can we sue? tables ran past their frames (heads and chips wrap); *Kept back* on the morning run was drawn
like a switched-off step and is the step that matters most (now amber with its reasons); six bar segments
lost their words at scale (shortened to the number). Nineteen pairs held as drawn, each with the question
asked of it answered in its box.

## Where it plugs in

Each pair names its kernel and inputs. The shared pieces a build reaches for first:

- The strip of days: `src/lib/legal/timelineStrip.ts` and `LegalTimelineStrip.tsx` (v2.6107), the Lien
  desk's `LienDeskCalendarTab` track and `lienMarkCards`, `lienWindowsAxis.ts`.
- The money bars: `src/lib/legal/moneyBars.ts` and `LegalMoneyBars.tsx` (v2.6105), `jobMoneyBar.ts`,
  `MoneyLifecycleBar`.
- The marks: `PercentProvenanceChip`, `RowKindChip`'s dashed guess, the bill reader's `billTint` looks,
  the report's `DraftedMark` and `HeardFold`, `BidCellPast`.
- The steppers: `QuickfillRoundList`, the sub portal's rail (`subPortalRail.ts`), `RobotStatusSheet`'s
  step list, the outbox door's sections, `batchWords.ts`.
- The chips that filter: `timelineCountChips` (v2.6107), `LEGAL_DOCUMENT_FILTERS` (v2.6108), the
  Submittals rows table's chips.

## The plan

One build session per picked shape, each shape a train of small PRs in weight order, the first PR of each
train the kernel or component the shape shares and its first screen. Five pairs need a function deploy
(the morning run's `messages-nudge-dispatch`, the interest and pay-application emails'
`gc-customer-email`, the Stripe lines' function, the photo tiles' bucket read), two a small migration
(the report's `voice_draft` column; the workflow step's told rows), one the Bank feed's run row. Each PR
ships its release note, fragment and guide as usual; the card's status line records each train.

## How to verify

Open the mock-up at `/to-dos/show-not-tell/mockup.html` on the dev server (`?theme=dark` for dark). Each
pair's *Door* says where the screen is in the app; the lens (Settings → What everyone sees) draws most of
them on invented data, and the pairs whose surfaces the lens has no rows for say so in the scan files.
After a train lands, the pair's *Today* frame is what the screen no longer draws.

## Where it stands

Scanned, drawn and second-passed 2026-10-30. The owner's first notes the same day: shape 1's other eighteen places drawn as pairs; Draft Payroll and the Pricing tab drawn whole with the bars in place; the Project Board's price redrawn so every word fits, then drawn whole. Her first pass, pasted the same evening: **build** people-docs-3 (the attendance strip); **drop** gc-messages-2, jobs-money-4 and jobs-pipeline-8 (the text is easier there); **prototypes** she wants to see before deciding: jobs-pipeline-1 and jobs-pipeline-6 as a view the user chooses (one remembered Words · Track choice, defaulting to today's words), office-5 (the round as columns) and jobs-money-3 (Tally's day strip, behind a switch, with a plain account of what it touches); and a refresh of jobs-pipeline-2 (bigger marks, rows named instead of a legend), done on the page. Four sessions started 2026-10-30 from those picks, one PR each (the prototypes as drafts with no auto-merge). The picks and notes are seeded into the mock-up and kept on the claude.ai copy's store. The rest of her picks come later.
