---
name: "Robot fixtures: the robot pulls the fixtures off the plans, the estimator picks which to add to her count"
number: 221
group: gated
status: proposed 2026-10-30 · the design written down, the door, the window, the shaded rows and the stage drawn three ways · waiting on the owner's picks · nothing built
mockup: to-dos/robot-fixtures/mockup.html
summary: >
  The robots already read every plumbing bid's plans, count the fixtures and seal a number nobody sees until the
  estimator sends. The owner (2026-10-30) wants the read to help her while she bids: load a set, have the robot
  pull out ONLY the fixtures with the text on the plans that backs each one, review them, and add the ones she
  wants to her own count, drawn shaded so she always knows which came from the robot. This folder decides what
  that does to the sealed envelope (the run reads assisted and leaves the gate; the fixtures themselves are
  scored against her final list instead), where the door lives so an estimator who ignores it sees nothing new
  (a button on the Counts tab beside Import from /Tooling, the same window from the Robot status sheet), what
  the robot hands over (a new twin-mcp verb, put_fixtures, with the substrate as the fallback read), how a row
  lands (a count row whose share names the robot, through the count sources that already exist), the stage strip
  (Plans filed → Read → Fixtures ready → Checked → Sealed → Sent → Scored), counts before costs, and which set.
next: The owner's three picks (the envelope rule, when fixtures open, counts alone or costs too) and the door; on a yes, PR 1 of six.
size: M as a train of five, plus one later
blocker: The owner's picks. PR 1's migration and verb wait for nothing else; the plan-sets PRs (#6557, #6560) are on main.
opinion: build — the Counts tab door with the status sheet as the second door, the run marked assisted and the fixtures scored against her list, fixtures open once the robot seals, counts alone first
---

# Robot fixtures (#221)

## The ask

The owner, 2026-10-30: *"right now we like how the robots are showing the estimator their bid at the end just before
the estimator bids… the robots' ability to mark up a set of plans and find the costs of parts has been reasonable and
accurate enough that we are considering offering to our estimators the ability to load in a set of plans and have the
robots pull out and bid only the fixtures to help speed up their bidding… for this to work we would have to offer an
augment to our current flow that is not invasive… when presenting to the estimator the plans we need to make it easy
for the estimator to review all of the text in the plans related to those fixtures. I was thinking we make a new
modal in bids or tab in Robots in bids where an estimator can see only the fixtures from the plans and choose if they
want them added to her plans while she is bidding. these items would need to look different such as a lightly shaded
row so while the estimator is bidding she knows that they were added from the robots and not her… help me deeply
think about what we could build and then after coming up with a plan come up with mockups that both expose to the
estimator these tools as well as what stage the bid is in when it comes to being scanned and audited by robots."*

The repo is public, so every bid, name, tag and count in this folder and in the mock-up is invented.

## What exists today, and what this rides on

- **The shadow.** A round (`docs/twins/kickoffs/rounds-operator.md`, punch list #142) claims an unsent plumbing bid with
  readable plans, files the plans, reads every sheet into a substrate (`put_substrate` → `bids_plan_substrates`: the
  sheet index, the schedules as tables with tag, description, make, model and connections, the notes with flags, and
  a reconciliation per tag of the schedule's count, the plan symbols and the riser), sends every page's text layer
  (`put_plan_text` → `bids_plan_pages`), counts in CountTooling (`ct_finish_takeoff`), pastes its counts onto its own
  ZZ shell (`paste_counts`), locks a sealed total (`lock_shadow`), and seeds its audit questions. The seal is API-enforced:
  nobody reads the number before the estimator sends. When she sends with a value, the trigger scores the run and the
  envelope opens for her (v2.3222).
- **What a person sees of it.** The Robot icon's ring on the Bid Board fills one of seven segments per step
  (`robotProgress.ts` over `robot_progress()`, v2.5732); its sheet (`RobotStatusSheet`) draws the same steps as a bar
  with *Read the run* and *Leave this one to me*; the Robot Board mirrors every live bid with its run's state; the Plans
  panel (`BidPlansPanel`, v2.5736) searches the page text, shows the robot's schedules as tables and the notes with
  flags, opens any sheet in `PdfPageCanvas`, and takes a question to the robot once its shadow is sealed (v2.5737). Its
  footer promises *Counts come after you send.*
- **How counts land and where they come from.** A count row is `bids_count_rows` on the active version. Since v2.5517
  a bid keeps one `bid_count_sources` row per CountTooling project (link, token, name, who imported) and each row's
  `source_shares` says which project's count it carries; the Counts sheet draws a *From* pill per row and a *From*
  tile with a filter (v2.5520). A paste onto a sheet with rows goes through the import review (`countsImportReview.ts`,
  `CountsImportReviewModal`): Changed · New · Missing · Same, a tick per row, *Apply N changes*, the toast's Undo.
- **A robot that writes rows a person confirms.** The submittal robot's `read_schedule` reads the fixture schedule and
  writes `bid_specified_products` as `source = 'robot'`, unconfirmed, and the office confirms each row on the tab
  (`docs/twins/submittals.md`). The shape to copy: the robot writes, the person picks, nothing is applied by itself.
- **Plan sets on a bid** (v2.6168 and v2.6169, 2026-10-30): a bid may carry several named sets; `bids.plans_link`
  stays *the set the robot reads*, `planSetsForBid` names it, and the Bid Board offers the sets by name.

## The seven decisions

### 1. The sealed envelope

Today the shadow's worth is that two numbers are made apart and the score teaches both sides. The moment the
estimator takes the robot's fixtures into her count before she sends, her number has read the robot's counts, and
the dollar score on that bid measures something else: how far the robot's prices and footage sit from a count it
half wrote. It is not a lie, but it is not the gate's number either.

**Decision.** Three things, all plain:

- **The run reads *assisted*.** The first time a robot fixture lands on her count, the RPC stamps
  `twin_shadow_runs.assisted_at` and `assist_kind = 'fixtures'`. The run keeps its sealed total and still scores at
  send, so the Robot Board row and the envelope still open with the delta, but with an **assisted** chip, and the
  Scoreboard counts it beside the practice-teacher runs, never in a job type's *N of 5 in a row*
  (`confidenceBoard.ts` leaves `assisted_at` rows out of the standard runs the way it leaves out practice teachers;
  `score_shadows`' per-axis stats do the same). Undo on the toast puts the rows back but leaves the stamp: she saw
  them.
- **The fixtures are scored against her final list instead.** At send the same trigger that scores the dollars
  writes a *fixtures score* on the pull: of the robot's N fixtures, how many she took as they were, how many she took
  and changed, how many she left out, and how many rows she has that the robot never found (name-matched the way
  the takeoff book matches, `takeoffBookMatch.ts`, never fuzzy). *Fixtures: 19 of 23 taken, 2 changed, 2 left, 3 the
  robot missed.* That is the honest measure of the augment, and the left and missed rows seed the audit's questions
  so the robot learns fixture reading, which is the one thing the owner wants it to get better at.
- **The pure shadow stays for every bid she does not touch the tool on.** Nothing in the run, the score, the gate or
  the envelope changes for them. The door is only drawn when fixtures are ready, and an estimator who never presses
  it bids as she does today.

*The alternative, kept for the owner:* drop the dollar score on an assisted bid entirely and show the fixtures score
alone. Rejected because the envelope at send is the part the owner said they like, and an assisted delta still says
something about footage, travel and price.

### 2. Non-invasive: where the door lives

| Door | For it | Against it |
| --- | --- | --- |
| **A · A button on the Counts tab** beside *Import from /Tooling*, drawn only when fixtures are ready: *Robot fixtures · 23* | It is where she counts; the import review is the precedent on the same tab; the shaded rows land on the sheet under it; an estimator who ignores it sees one button, or none | The Counts head is dense already |
| **B · The Robot status sheet** (the icon's tap): *Fixtures ready · 23 · Review them* | The ring already says the stage; one place for everything the robot does on the bid; estimators check the board on a phone | The icon lives on the Bid Board, not where she counts; a sheet opening a window |
| **C · A new lens under 🤖 Robots** (*Fixtures*): every bid with fixtures ready | Fits the group's pattern | Far from the bid; the group is the program's view and estimators would have to learn a lens; the least non-invasive |
| **D · A fold in the Plans panel** (it already shows the schedules and the notes and has Open sheet) | All the backing text is already there | The panel is a reading tool, 460 px wide, and its footer promises *Counts come after you send*; a write flow inside it breaks that promise for every reader |

**Decision: A, with B as the second door onto the same window.** One component, `RobotFixturesWindow`, opened from the
Counts tab's button and from the status sheet's button. C is the owner's alternative if they want a desk for it; D is
rejected, but the window borrows the panel's `PdfPageCanvas` viewer for *Open sheet*. The Plans panel's footer gains
one clause only when the bid has fixtures ready: *The robot's fixtures are on the Counts tab.*

### 3. What the robot hands over

The owner's words: *make it easy for the estimator to review all of the text in the plans related to those fixtures.*
A fixture row has to carry its evidence, not just its count.

**Per fixture:** the tag (*WC-1*), the name the book knows (*Water closet, floor mount, flush valve*), the schedule
row (description, maker, model, connections), the count in all and **per sheet** (*P-201 · 3, P-202 · 2*), the
**backing text**: the schedule row as printed with its sheet, every note line that names the tag with its flags
(exclusion, scope, coordination), the legend entry, and the callouts around the tag on each plan sheet (the text
layer's lines near the tag); the robot's **check**: the three voices agree, or not (*schedule 5 · drawn 5 · riser 5*
from the reconciliation), its confidence as *sure* or *want a look* (the submittal robot's 0.7 line), and one remark
in its own words (*The schedule lists WC-1 with no count. Five are drawn on P-201 and P-202.*). Each backing line
opens its sheet.

**A verb or a read?** The substrate already holds the schedule rows, the notes and a per-tag reconciliation, and the
page text holds the callouts, so a kernel could derive most of a pull today. But the substrate's reconciliation has
totals, not counts per sheet, schedules often carry no quantity column at all (`SUBSTRATE.md`, note 8), and the
robot's real count lives in its CountTooling pins and its shell's count rows. The robot has every piece in hand at
the end of STG-3 and nothing today asks it to write them down together.

**Decision: a new twin-mcp verb, `put_fixtures(bid, fixtures)`, with the substrate as the fallback read.** The round
calls it once after `ct_finish_takeoff`, before `paste_counts`: one entry per fixture tag with the fields above and
its CountTooling pin ids, capped at 400 rows, landing on the **human bid** the shell is paired to (the way
`put_plan_text` does) in two new tables, `bid_fixture_pulls` (one per read: the set it read, when, the sheet count,
the check's summary) and `bid_fixture_pull_rows`. A `[pipeline STG-3b]` stamp on the shell's ledger; the rounds and
Code kickoffs gain the line; briefs regenerated, `twin-mcp` and `twin-setup` deployed. For a bid the robot read before
the verb existed, the kernel `robotFixtures.ts` derives a pull from the substrate and the page text and the window
says so: *From the robot's read of Oct 22. Counts are the set's totals, not per sheet.*

### 4. Choosing and adding

- **The window** (`RobotFixturesWindow`, full-screen on a phone, a wide window at a desk): the set line (decision 7),
  then the rows in the import review's buckets against her sheet: **New** (not on her count → Add), **On your sheet**
  (a row of hers with the same name, the robot's count beside hers → Update, which keeps her parts and prices; starts
  unticked), **Same** (folded). The robot never removes a row of hers: there is no Missing bucket. Each row: a tick,
  the tag, the name, the count with its unit, the sheets, a *sure* or *want a look* chip; the row opens to the
  backing text, each line with **Open sheet**. *Sure* rows in New start ticked; *want a look* rows start unticked.
- **The button** names its count from `batchWords` (`src/lib/batchWords.ts`): *Add 12 fixtures*, *Add 10 · update 2*,
  dead at nothing ticked reading *Add fixtures*. The foot says what happens: *12 rows land on your count, shaded.
  Your rows stay as they are.*
- **Landing** is one RPC, `take_robot_fixtures(pull_row_ids, bid_version_id)`, in one transaction: it makes sure the
  bid has a `bid_count_sources` row for the robot (the robot's CountTooling project, its view link, `source_kind =
  'robot'`, a new column with the default `'counttooling'`), inserts the count rows on the active version with
  `source_shares = {"<robot source id>": count}`, `kind = 'fixture'`, the sheets as `page`, stamps each pull row
  `taken_at`, `taken_by`, `taken_as` (*added* or *updated*) and its `count_row_id`, stamps the run assisted, and
  leaves a `[robot fixtures] took 12 of 23` note on the bid's ledger. Because the robot is a count source, every
  surface that reads shares works unchanged: the *From* pill reads **Robot**, the *From* tile adds *Robot · 12* with
  its filter, the share arithmetic and the import's recopy logic hold, and `clone_count_rows_to_bid_version` carries
  the shares to a new version.
- **The shade** is the share: a row whose shares name a robot source draws on `var(--bg-blue-tint)` with a 3 px left
  rule in the robot's blue (`ROBOT_STATE_COLOR.robot`), on the Counts sheet in every view and on the Takeoff sheet
  (`TakeoffCostRailView`, `TakeoffFocusView`'s rail dots), for the life of the bid. Dark mode reads the same tokens.
- **A shaded row she edits stays shaded.** The share keeps the robot's number; her edit changes the count; the pill
  reads *Robot 5 → yours 6* and the hover says the robot's count and when she changed it. The row is *robot, then
  yours*, which is exactly what the owner asked to be able to see. Deleting the row is hers as any row is. A
  **Make it mine** door (drop the robot's share) is not drawn: the shade is the record.
- **Undo** on the toast (`countsImportUndo.ts`'s shape) calls `untake_robot_fixtures(pull_id)`: it deletes the rows
  it inserted that she has not touched, puts updated rows back, clears the taken stamps, drops the robot source when
  no row carries it, and leaves the assisted stamp with the note *she saw them*.
- **A later read** (an addendum, a re-read) makes a new pull; the window opens on it showing only what is new against
  her sheet, in the same buckets, with rows she took earlier folded under *Already on your count*.

### 5. The stage

The owner's words: *what stage the bid is in when it comes to being scanned and audited by robots.* The ring's seven
segments are the robot's run; the owner's strip is the bid's standing with the robots, her steps included.

**The seven stops** (`robotStage.ts`, pure, one shape for every surface, fed from facts the rounds already stamp plus
the pull): **Plans filed** (`plans_filed`, and the probe read them) → **Robot read the set** (`read_at`: substrate
and page text) → **Fixtures ready · 23** (the pull landed, and the run is sealed: decision on timing below) →
**Checked** (the robot's own check of its fixtures: the three voices, *21 agree · 2 to look at*; the owner's
*audited*) → **Sealed** (`locked_at`) → **Sent** (`bid_date_sent`) → **Scored** (`scored_at`, with the delta, or the
fixtures score on an assisted bid). The lit stop carries one plain sentence (*The robot's fixtures are ready. 23
found, 21 sure.*); an **assisted** chip joins the strip once she takes any.

**When do fixtures open?** The robot writes them at the end of counting, minutes before it prices and seals in the
same round. Opening them at *counted* would hand her a list the robot may still amend at STG-5 (the book's names)
and would open before the robot's own number exists in the ledger. **Decision: Fixtures ready lights once the run
is sealed**, the same gate the Plans panel's *Ask the robot to look* uses (v2.5737), so the two robot doors on a bid
open at the same moment. Before that the stop reads *The robot is counting. Its fixtures open when it seals its
number, usually within the hour.* The owner's alternative: open at *counted* so she never waits.

**Where it lives.** Three places drawn in the mock-up:

1. **Inline on the Counts tab head**, folded to one line like the bid flow's inline pill (`BidFlowStrip` inline,
   v2.3241): the ring, *Robot · fixtures ready · 23*, a chevron that unfolds the seven stops. **Recommended**: it is
   where she bids.
2. **The Robot status sheet**, the strip in full at the top in place of the first two timeline rows, with the seven-step
   bar kept under *Reading the sheets* while the robot works. **Recommended too**: it is the phone's reading, one tap
   from the Bid Board.
3. **A hairline under the Bid Board row**, beside the bid flow's hairline, with the ring's key gaining one sentence.
   The owner's alternative; not recommended, since two hairlines on a row read as one.

The ring on the icon stays as it is: its seven segments are finer than the strip and already live.

### 6. Costs

The owner said *bid only the fixtures*. The robot's prices come from its own book (🤖 Robot Default); hers come
from her takeoff book and her price book. The moment a robot fixture lands as a count row, **her** books price it:
*Fill from book* on the Takeoff expands her assemblies onto it, and the Workbench prices it from her book. That is
the right augment: the robot finds the fixtures, her books cost them. A robot cost riding along would anchor her
price before send and would need a map from the robot's book to hers.

**Decision: counts alone first.** The robot's cost per fixture is already visible after send in the comparison modal
and the audit card (`robotBidComparison.ts`, `takeoffDiff.ts`), which is where a cost comparison belongs. A shaded
takeoff line with the robot's cost is listed under *Later*, for the owner to call once the counts have run a month.

### 7. Which plans

The pull records `plan_link` (the bid's `plans_link` at read time) and `sheet_count`; the window's set line names the
set through `planSetsForBid` (`samePlanLink`): *From the set the robot read: Issued set · Oct 2 · 31 sheets · read
Thu 2:14 PM.* When the bid's robot set has moved since (an addendum made the robot's set on Edit Bid), the line says
*You changed the robot's set since. These fixtures are from Issued set.* with **Read the new set**, a request the
round works like a plan question (`next_fixture_read`, one per round, writing a new pull): a later PR, since a sealed
run cannot be re-claimed (`shadowEligibility.ts`: one live run per bid).

## Data model and verbs

New, all in PR 1's migration (`SET lock_timeout = '3s';`, idempotent, the three house calls after each CREATE TABLE):

- `bid_fixture_pulls`: `id`, `bid_id` (the human bid), `shell_bid_id`, `shadow_run_id`, `plan_link`, `sheet_count`,
  `source` (`robot` · `derived`), `check_summary jsonb` (`{agree, conflict, unverifiable}`), `read_at`, `created_at`;
  one bid may hold several (a re-read).
- `bid_fixture_pull_rows`: `id`, `pull_id`, `tag`, `name`, `description`, `manufacturer`, `model`,
  `connections jsonb`, `count numeric`, `unit`, `per_sheet jsonb` (`[{sheet, page, count}]`), `backing jsonb`
  (`[{kind: schedule|note|legend|callout, sheet, page, text, flags[]}]`), `confidence numeric`, `agreement text`,
  `remark text`, `ct_pin_ids jsonb`, `sequence_order`, and the take: `taken_at`, `taken_by`, `taken_as`
  (`added` · `updated`), `count_row_id`, `left_at`. RLS: read by `can_access_bid_for_pricing(bid_id)`; the robot
  writes through the service role (the verb); estimator and up update the take columns through the RPC only.
- `bid_count_sources.source_kind text NOT NULL DEFAULT 'counttooling' CHECK IN ('counttooling', 'robot')`.
- `twin_shadow_runs.assisted_at timestamptz`, `assist_kind text CHECK IN ('fixtures')`, `fixtures_score jsonb`
  (`{found, taken, changed, left, missed}`), written by `take_robot_fixtures` and by `score_locked_shadows` at send.
- `robot_progress()` gains `fixtures_at`, `fixtures_found`, `fixtures_sure`, `fixtures_taken`, `assisted_at`; the
  shell's `[pipeline STG-3b]` stamp is the fact.
- RPCs, SECURITY DEFINER for the bid roles: `take_robot_fixtures(p_row_ids uuid[], p_bid_version_id uuid)` and
  `untake_robot_fixtures(p_pull_id uuid)`; both refuse on a sent bid (*the bid is sent, the count is the record*).
- twin-mcp 1.9.0: `put_fixtures(bid, fixtures)` (fenced to the twin's shell, lands on the paired human bid, 400 rows,
  replaces the shell's earlier pull, `[pipeline STG-3b]`); the kickoffs' STG-3 line; `get_work_state` grows
  `fixtures_pull`. Later: `next_fixture_read`.

Kernels, pure with tests: `src/lib/bids/robotFixtures.ts` (the pull as window rows, the buckets against her sheet
through `countsImportReview`'s pairing, the derived read from a substrate, the words, every sentence under
`plainWordsFailures`), `src/lib/bids/robotStage.ts` (the seven stops from a `robot_progress` row and the bid, the
lit sentence, the inline line), `robotFixtureShade.ts` (is this row the robot's, and the pill's words).

## Where it plugs in

- `BidsCountsTab.tsx`: the button beside *Import from /Tooling* (behind `fixturesReady`), the inline strip on the
  head, the shade on `sheetRow`, the pill words in `countRowFrom` when the source is a robot, the *From* tile's
  robot entry; `insertCountRows` is not touched, the RPC writes.
- `RobotStatusSheet.tsx`: the strip at the top, **Fixtures ready · 23 · Review them**; `useBidRobotLayer` hands the
  window opener through the overlays (`BidsRobotOverlays`).
- `BidsTakeoffTab.tsx` and the two views: the shade and a **Robot** chip beside the fixture name, as the **ALT** mark
  sits.
- `robotMirror.ts` and `BidsRobotMirrorTab.tsx`: the assisted chip and the fixtures score on a row;
  `confidenceBoard.ts`, `robotScoreboard.ts`: assisted runs beside practice runs; `RobotEnvelopeModal`: the chip.
- `BidPlansPanel.tsx`: the footer's one clause when fixtures are ready.
- `RobotIconKeyModal.tsx`: one sentence on the assisted chip. `dashboardNeedsYou.ts`: *The robot's fixtures are
  ready on b641* for the bid's estimator (optional, PR 4).
- Docs that change: `BIDS_SYSTEM.md` (Counts tab, the Robots group), `GLOSSARY.md` (Robot fixtures, assisted),
  `EDGE_FUNCTIONS.md` → twin-mcp, `docs/twins/HANDOFF.md`, `docs/migrations/`, `ACCESS_CONTROL.md` (the RPCs), the
  guide *let the robots shadow a bid* gains a section and a new guide *add the robot's fixtures to your count*.

## The plan

| PR | What | Size |
| --- | --- | --- |
| 1 | The ground: the migration above, `put_fixtures` and the kickoffs' line, `robot_progress()`'s columns, `take_robot_fixtures` and its undo, `score_locked_shadows` writing the fixtures score. Docs: migrations, EDGE_FUNCTIONS, HANDOFF. Deploy: `db push`, then `twin-mcp` and `twin-setup`. | M |
| 2 | The kernels: `robotFixtures.ts`, `robotStage.ts`, `robotFixtureShade.ts`, their tests, the plain-words tests. No surface. | S |
| 3 | The window and the doors: `RobotFixturesWindow` (buckets, ticks, backing text, Open sheet over `PdfPageCanvas`, *Add N fixtures*, the foot), the Counts tab button, the status sheet button, the shade and the pill on Counts and on the Takeoff, Undo. Guide *add the robot's fixtures to your count*. | M |
| 4 | The stage: the inline strip on the Counts head, the strip on the status sheet, the Plans panel's clause, the key's sentence, the Needs You line. | S |
| 5 | Assisted: the chip and the fixtures score on the Robot Board row, the envelope and the Scoreboard; the left and missed rows seeding the audit's questions. | S |
| later | **Read the new set** (`next_fixture_read`); the robot's pins drawn on *Open sheet*; a shaded takeoff line with the robot's cost after send; a *Fixtures* lens under 🤖 Robots if the owner wants a desk. | S each |

## How to verify

- **PR 1.** On the dev server with the twin connector, run one round on a ZZ Test bid with plans (`/bid b<ZZ>`):
  the shell's ledger carries `[pipeline STG-3b]`, `bid_fixture_pulls` has one row on the human bid with
  `bid_fixture_pull_rows` under it, `robot_progress()` returns `fixtures_at`. Call `take_robot_fixtures` as the dev on
  two rows: two count rows land on the active version with the robot's share, `bid_count_sources` has a `robot` row,
  `twin_shadow_runs.assisted_at` is set, the ledger note reads *took 2 of N*. `untake_robot_fixtures` puts it back and
  leaves `assisted_at`. `npx vitest run src/lib/twins`.
- **PR 2.** `npx vitest run src/lib/bids/robotFixtures src/lib/bids/robotStage`.
- **PR 3.** As the estimator sample (`/dev-login?as=1&to=/bids?tab=counts&bidId=<ZZ>`): the button reads *Robot
  fixtures · N* only on a bid with a sealed run and a pull; the window's New rows start ticked where sure; untick one;
  *Add N fixtures* names the count; after the press the rows are shaded on Counts in List, By plan page and By group,
  the *From* pill reads *Robot*, the tile filters; edit a shaded count and the pill reads *Robot 5 → yours 6*; the
  Takeoff draws the shade and the chip; Undo on the toast removes the rows. At phone width the window is full screen
  and every row's backing text folds. A bid with no pull draws no button.
- **PR 4.** The inline strip's lit stop and sentence match the status sheet's; the Plans panel's footer carries the
  clause only on a bid with fixtures ready.
- **PR 5.** Send the ZZ bid with a value: the Robot Board row reads *assisted* with the fixtures score; the Scoreboard
  counts it with the practice runs, not in *N of 5 in a row*.
- Every sentence a first-timer reads passes `plainWordsFailures` under test; `npm run check:batch-words`,
  `check:empty-words`, `check:error-words` and `theme-tokenize --check` pass.

## Open questions for the owner

1. **The envelope.** On a bid she took fixtures on, keep the dollar score as *assisted* and out of the gate, with the
   fixtures scored against her list (recommended), or drop the dollar score on that bid and show the fixtures score
   alone?
2. **When fixtures open.** Once the robot seals its number, usually within the hour of the plans landing
   (recommended, one gate with *Ask the robot to look*), or the moment it finishes counting, so she never waits?
3. **Costs.** Counts alone first, her books pricing the robot's fixtures (recommended), or the robot's cost riding
   along on the Takeoff as a shaded line from day one?
4. **The door.** The Counts tab button with the status sheet as the second door (recommended), or a *Fixtures* lens
   under 🤖 Robots as well?
