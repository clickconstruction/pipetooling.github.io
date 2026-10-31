---
name: "Robot fixtures: the robot pulls the fixtures off the plans, the estimator picks which to add to her count"
number: 221
group: ready
status: proposed 2026-10-30 · the owner's picks the same day (keep the dollar score, fixtures open at the seal, a count and a price from day one, set aside and never delete) · PR 1 (v2.6180, the ground) and PR 2 (v2.6181, the kernels) on main 2026-10-31, migration pushed, twin-mcp 1.9.0 deployed · PR 3 (v2.6188, the window) and PR 3b (v2.6225, the Pricing tab and the status sheet's door) on main 2026-10-31 · PR 4 (the stage) in flight
mockup: to-dos/robot-fixtures/mockup.html
summary: >
  The robots already read every plumbing bid's plans, count the fixtures, price them on their own book and seal a
  number nobody sees until the estimator sends. The owner (2026-10-30) wants the read to help her while she bids:
  load a set, have the robot pull out ONLY the fixtures with the text on the plans that backs each one and the
  price it gave each, review them, and add the ones she wants to her own count, drawn shaded so she always knows
  which came from the robot. This folder decides what that does to the sealed envelope (the run reads assisted and
  leaves the gate, keeps its dollar score, and the fixtures are scored against her final list too), where the door
  lives so an estimator who ignores it sees nothing new (a button on the Counts tab beside Import from /Tooling,
  the same window from the Robot status sheet), what the robot hands over (a new twin-mcp verb, put_fixtures, with
  its price per fixture and the substrate as the fallback read), how a row lands (a count row whose share names
  the robot, priced by her book first and by the robot where her book has none), how a row leaves (set aside with
  her reason, never deleted), the stage strip (Plans filed → Read → Fixtures ready → Checked → Sealed → Sent →
  Scored), and which set.
next: PR 4 the stage strip, then PR 5 assisted; then the recorded guide for the estimator on a bid with a real pull.
size: M as a train of five, plus one later
blocker: Nothing. The owner's picks are in (2026-10-30); the plan-sets PRs (#6557, #6560) are on main.
opinion: build — the Counts tab door with the status sheet as the second door, the run marked assisted with its dollar score kept and the fixtures scored against her list, fixtures open once the robot seals, her book first and the robot's price where her book has none, set aside and never delete
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

**The owner's picks, the same day**, on the three questions the first pass left open: *"keep the assisted dollar,
once the robot seals that way we know the bid is complete and all errors have been checked, The purpose of fixtures
is to both have a count and price"*, and one more case to design: *"cases where she might want to hide instead of
delete the fixtures you have proposed"*. Then: *"please build it."* The estimator is the validator of its use; the
owner will not check the work before it reaches her, so the mock-up opens with what she should judge.

The repo is public, so every bid, name, tag, count and price in this folder and in the mock-up is invented.

## What the estimator judges

She will decide whether this is used. The mock-up's first box asks her five things, and the build is held to them:

1. **Is the list what she would have counted?** The robot's fixtures against hers, tag by tag. A fixture she would
   never take (by others, existing, an alternate) must start unticked with the reason shown, not hidden in a row.
2. **Does the text under a row answer *why*?** The schedule row, every note that names the tag with its flag, the
   callouts on each sheet, the robot's own check of the three voices, and the sheet one press away with the robot's
   pins on it. If she has to open the PDF herself to believe a count, the window has failed.
3. **Does the price read as hers?** Her book prices every row it knows. The robot's price fills only the rows her
   book cannot, marked, and shows beside hers everywhere as a reference she can ignore.
4. **After an hour of bidding, can she still tell the robot's rows from hers at a glance?** The shade, the rule at
   the left and the Robot pill, in every view, for the life of the bid.
5. **Does the one line on the Counts tab say what she needs to know about the robot?** Where it is, when its
   fixtures open, how many she took.

What would make her stop using it, and what the design does about each: rows paired to hers by name alone, so a
fixture she typed as *WC-1* reads as New (pairing goes by tag first, decision 4); a count she disagrees with that she
can only delete (set aside with a reason, decision 8); a list that changes under her while the robot is still
working (fixtures open once the run is sealed, decision 5); a price that is not hers (her book first, decision 6);
having to poll for the robot (the Needs You line and the strip, decision 5).

## What exists today, and what this rides on

- **The shadow.** A round (`docs/twins/kickoffs/rounds-operator.md`, punch list #142) claims an unsent plumbing bid with
  readable plans, files the plans (STG-1), reads every sheet into a substrate (STG-2, `put_substrate` →
  `bids_plan_substrates`: the sheet index, the schedules as tables with tag, description, make, model and
  connections, the notes with flags, and a reconciliation per tag of the schedule's count, the plan symbols and the
  riser), sends every page's text layer (`put_plan_text` → `bids_plan_pages`), counts in CountTooling (STG-3,
  `ct_finish_takeoff`), prices every row on the 🤖 Robot Default **price book** and pastes the priced rows onto its
  own ZZ shell (STG-5, `get_robot_book` then `paste_counts`: each row names a `book_entry`, and the entry's
  `total_price` is the robot's unit price for that fixture), locks a sealed total (`lock_shadow`), and seeds its audit
  questions. The seal is API-enforced: nobody reads the number before the estimator sends. When she sends with a
  value, the trigger scores the run and the envelope opens for her (v2.3222).
- **What a person sees of it.** The Robot icon's ring on the Bid Board fills one of seven segments per step
  (`robotProgress.ts` over `robot_progress()`, v2.5732); its sheet (`RobotStatusSheet`) draws the same steps as a bar
  with *Read the run* and *Leave this one to me*; the Robot Board mirrors every live bid with its run's state; the Plans
  panel (`BidPlansPanel`, v2.5736) searches the page text, shows the robot's schedules as tables and the notes with
  flags, opens any sheet in `PdfPageCanvas`, and takes a question to the robot once its shadow is sealed (v2.5737). Its
  footer promises *Counts come after you send.*
- **How counts land and where they come from.** A count row is `bids_count_rows` on the active version (`fixture`,
  `count`, `unit`, `page`, `group_tag`, `source_shares`). Since v2.5517 a bid keeps one `bid_count_sources` row per
  CountTooling project (link, token, name, who imported) and each row's `source_shares` says which project's count it
  carries; the Counts sheet draws a *From* pill per row and a *From* tile with a filter (v2.5520). A paste onto a sheet
  with rows goes through the import review (`countsImportReview.ts`, `CountsImportReviewModal`): Changed · New ·
  Missing · Same, a tick per row, *Apply N changes*, the toast's Undo.
- **How her price lands on a row.** The Pricing tab prices a count row from the bid's active price book version:
  an explicit `bid_pricing_assignments` row wins, else the entry whose fixture type's name equals the row's fixture,
  case-insensitively (`resolvePricingEntry.ts`); a row with no entry can carry a per-row custom price
  (`bid_count_row_custom_prices`: bid, count row, version, unit price). Fixture types are shared across books, so a
  row named for a type her book has an entry for prices itself.
- **Hiding that exists today.** `bid_count_row_submission_hides` hides a priced line from the customer's pricing
  grid while its revenue stays in the total. It is a printing choice, not the owner's case here, and this design
  does not touch it.
- **A robot that writes rows a person confirms.** The submittal robot's `read_schedule` reads the fixture schedule and
  writes `bid_specified_products` as `source = 'robot'`, unconfirmed, and the office confirms each row on the tab
  (`docs/twins/submittals.md`). The shape to copy: the robot writes, the person picks, nothing is applied by itself.
- **Plan sets on a bid** (v2.6168 and v2.6169, 2026-10-30): a bid may carry several named sets; `bids.plans_link`
  stays *the set the robot reads*, `planSetsForBid` names it, and the Bid Board offers the sets by name.

## The eight decisions

### 1. The sealed envelope

Today the shadow's worth is that two numbers are made apart and the score teaches both sides. The moment the
estimator takes the robot's fixtures, with their prices, into her count before she sends, her number has read part of
the robot's work, and the dollar score on that bid measures something else: how far the robot's footage, travel and
the rest sit from a count it half wrote.

**Decision, with the owner's pick (2026-10-30: *keep the assisted dollar*).** Three things, all plain:

- **The run reads *assisted* and keeps its dollar score.** The first time a robot fixture lands on her count, the
  RPC stamps `twin_shadow_runs.assisted_at` and `assist_kind = 'fixtures'`. The run keeps its sealed total and still
  scores at send, so the Robot Board row and the envelope still open with the delta, with an **assisted** chip. The
  Scoreboard counts it beside the practice-teacher runs, never in a job type's *N of 5 in a row*
  (`confidenceBoard.ts` leaves `assisted_at` rows out of the standard runs the way it leaves out practice teachers;
  `score_shadows`' per-axis stats do the same). Undo on the toast puts the rows back but leaves the stamp: she saw
  them.
- **She sees the robot's price per fixture, never its sealed total.** The fixture prices are a part of the robot's
  bid; its total, with the footage, the travel and the rest, stays sealed until she sends, as today.
- **The fixtures are scored against her final list too.** At send the same trigger that scores the dollars writes a
  *fixtures score* on the pull: of the robot's N fixtures, how many she took as they were, how many she took and
  changed, how many she set aside and with what reasons, and how many rows she has that the robot never found
  (paired by tag, then by the takeoff book's name match, never fuzzy). *Fixtures: 19 of 23 taken, 2 changed, 2 set
  aside, 3 the robot missed.* That is the honest measure of the augment, and the set-aside and missed rows seed the
  audit's questions, so the robot learns fixture reading, which is the one thing the owner wants it to get better at.
- **The pure shadow stays for every bid she does not touch the tool on.** Nothing in the run, the score, the gate or
  the envelope changes for them. The door is only drawn when fixtures are ready, and an estimator who never presses
  it bids as she does today.

*The alternative, dropped by the owner:* drop the dollar score on an assisted bid and show the fixtures score alone.

### 2. Non-invasive: where the door lives

| Door | For it | Against it |
| --- | --- | --- |
| **A · A button on the Counts tab** beside *Import from /Tooling*, drawn only when fixtures are ready: *Robot fixtures · 23* | It is where she counts; the import review is the precedent on the same tab; the shaded rows land on the sheet under it; an estimator who ignores it sees one button, or none | The Counts head is dense already |
| **B · The Robot status sheet** (the icon's tap): *Fixtures ready · 23 · Review them* | The ring already says the stage; one place for everything the robot does on the bid; estimators check the board on a phone | The icon lives on the Bid Board, not where she counts; a sheet opening a window |
| **C · A new lens under 🤖 Robots** (*Fixtures*): every bid with fixtures ready | Fits the group's pattern | Far from the bid; the group is the program's view and estimators would have to learn a lens; the least non-invasive |
| **D · A fold in the Plans panel** (it already shows the schedules and the notes and has Open sheet) | All the backing text is already there | The panel is a reading tool, 460 px wide, and its footer promises *Counts come after you send*; a write flow inside it breaks that promise for every reader |
| **E · A Robot column on her Counts sheet** (the robot's count beside hers on every row, a tick inline, no window) | She never leaves her sheet; the pairing is visible row by row | The backing text needs room a column does not have, and on a phone a column does not fit; her sheet would show rows she has not taken as if they were hers |

**Decision: A, with B as the second door onto the same window.** One component, `RobotFixturesWindow`, opened from the
Counts tab's button and from the status sheet's button. C is the owner's alternative if they want a desk for it; D is
rejected, but the window borrows the panel's `PdfPageCanvas` viewer for *Open sheet*. E was weighed in the second pass
and kept out: the window is where she reviews, and after she takes rows the sheet's shade carries the record. The Plans
panel's footer gains one clause only when the bid has fixtures ready: *The robot's fixtures are on the Counts tab.*

### 3. What the robot hands over

The owner's words: *make it easy for the estimator to review all of the text in the plans related to those fixtures*,
and *the purpose of fixtures is to both have a count and price*. A fixture row has to carry its evidence and its price.

**Per fixture:** the tag (*WC-1*), the name the book knows (*Water closet, floor mount, flush valve*), the schedule
row (description, maker, model, connections), the count in all and **per sheet** (*P-201 · 3, P-202 · 2*) with the
robot's **pins** on each sheet (CountTooling's positions, so *Open sheet* can draw where it counted), the **backing
text**: the schedule row as printed with its sheet, every note line that names the tag with its flags (exclusion,
scope, by others, existing, coordination), the legend entry, and the callouts around the tag on each plan sheet (the
text layer's lines near the tag); the robot's **check**: the three voices agree, or not (*schedule 5 · drawn 5 · riser
5* from the reconciliation), its confidence as *sure* or *want a look* (the submittal robot's 0.7 line), and one
remark in its own words (*The schedule lists WC-1 with no count. Five are drawn on P-201 and P-202.*); and its
**price**: the 🤖 Robot Default price book entry it priced the fixture with and the unit price at read time. Each
backing line opens its sheet.

**A verb or a read?** The substrate already holds the schedule rows, the notes and a per-tag reconciliation, and the
page text holds the callouts, so a kernel could derive most of a pull today. But the substrate's reconciliation has
totals, not counts per sheet, schedules often carry no quantity column at all (`SUBSTRATE.md`, note 8), the pins and
the price live only in the robot's CountTooling project and its shell, and nothing today asks the robot to write them
down together.

**Decision: a new twin-mcp verb, `put_fixtures(bid, fixtures)`, with the substrate as the fallback read.** The round
calls it once after `paste_counts` and before `lock_shadow`, when every row has its book entry and price: one entry
per fixture tag with the fields above, capped at 400 rows, landing on the **human bid** the shell is paired to (the
way `put_plan_text` does) in two new tables, `bid_fixture_pulls` (one per read: the set it read, when, the sheet
count, the check's summary, the robot's total for the fixtures) and `bid_fixture_pull_rows`. A `[pipeline STG-5b]`
stamp on the shell's ledger; the rounds and Code kickoffs gain the line; briefs regenerated, `twin-mcp` and
`twin-setup` deployed. For a bid the robot read before the verb existed, the kernel `robotFixtures.ts` derives a pull
from the substrate and the page text, with no price and no pins, and the window says so: *From the robot's read of
Oct 22. Counts are the set's totals, not per sheet. No prices.*

### 4. Choosing and adding

- **The window** (`RobotFixturesWindow`, full-screen on a phone, a wide window at a desk): the set line (decision 7)
  with the robot's fixture total, then the rows in the import review's buckets against her sheet: **New** (not on her
  count → Add), **On your count** (a row of hers paired to it, the robot's count beside hers → Update, which keeps her
  parts and prices; starts unticked), **Same** (folded), and **Set aside** (decision 8, folded, with her reasons).
  The robot never removes a row of hers: there is no Missing bucket. Each row: a tick, the tag, the name, the count
  with its unit, the sheets, the robot's price each, a *sure* or *want a look* chip, and a scope chip where the plans
  give the fixture away (*by others*, *existing*, *alternate*); the row opens to the backing text, each line with
  **Open sheet**, the viewer drawing the robot's pins.
- **Pairing her rows to the robot's goes by tag first.** A row of hers whose name carries the tag (*WC-1*, *Water
  closet (WC-1)*; `takeoffFixtureKey`'s tag pattern) pairs to the robot's row with that tag; then the takeoff book's
  name match (`takeoffBookMatch.ts`: the exact normalized name, then the tag-stripped key); never fuzzy. Estimators
  type tags, and a pairing that misses makes every robot row New, which is the fastest way to lose her.
- **What starts ticked.** *Sure* rows in New with no scope chip. *Want a look* rows and rows with a scope chip start
  unticked, and the chip says why in two words. On your count starts on *Keep mine*.
- **The button** names its count from `batchWords` (`src/lib/batchWords.ts`): *Add 14 fixtures*, *Add 14 · update 1*,
  dead at nothing ticked reading *Add fixtures*. The foot says what happens, with the price: *14 rows land on your
  count, shaded, $11,340 at the robot's prices. Your book prices the ones it knows. The robot's price fills the rest,
  marked. Your 6 rows stay as they are.*
- **Landing** is one RPC, `take_robot_fixtures(pull_row_ids, bid_version_id)`, in one transaction: it makes sure the
  bid has a `bid_count_sources` row for the robot (the robot's CountTooling project, its view link, `source_kind =
  'robot'`, a new column with the default `'counttooling'`), inserts the count rows on the active version with
  `source_shares = {"<robot source id>": count}`, `fixture` = the robot's book name (so her book prices it by name),
  `plan_tag` = the robot's tag (a new nullable column on `bids_count_rows`, drawn as the chip), the sheets as `page`,
  prices each row by decision 6, stamps each pull row `taken_at`, `taken_by`, `taken_as` (*added* or *updated*) and
  its `count_row_id`, stamps the run assisted, and leaves a `[robot fixtures] took 14 of 23` note on the bid's
  ledger. Because the robot is a count source, every surface that reads shares works unchanged: the *From* pill reads
  **Robot**, the *From* tile adds *Robot · 14* with its filter, the share arithmetic and the import's recopy logic
  hold (a later /Tooling import never proposes the robot's rows as Missing, since they carry the robot's share and
  not the project's), and `clone_count_rows_to_bid_version` carries the shares to a new version.
- **The shade** is the share: a row whose shares name a robot source draws on `var(--bg-blue-tint)` with a 3 px left
  rule in the robot's blue (`ROBOT_STATE_COLOR.robot`), on the Counts sheet in every view, on the Pricing tab and on
  the Takeoff sheet (`TakeoffCostRailView`, `TakeoffFocusView`'s rail dots), for the life of the bid. Dark mode reads
  the same tokens.
- **A shaded row she edits stays shaded.** The share keeps the robot's number; her edit changes the count; the pill
  reads *Robot 5 → yours 6* and the hover says the robot's count and when she changed it. The row is *robot, then
  yours*, which is exactly what the owner asked to be able to see. A **Make it mine** door (drop the robot's share) is
  not drawn: the shade is the record.
- **Undo** on the toast (`countsImportUndo.ts`'s shape) calls `untake_robot_fixtures(pull_id)`: it deletes the rows
  it inserted that she has not touched, puts updated rows back, clears the taken stamps, drops the robot source when
  no row carries it, and leaves the assisted stamp with the note *she saw them*.
- **A later read** (an addendum, a re-read) makes a new pull; the window opens on it showing only what is new against
  her sheet, in the same buckets, with rows she took earlier folded under *On your count from the robot* and rows she
  set aside staying set aside.

### 5. The stage

The owner's words: *what stage the bid is in when it comes to being scanned and audited by robots.* The ring's seven
segments are the robot's run; the owner's strip is the bid's standing with the robots, her steps included.

**The seven stops** (`robotStage.ts`, pure, one shape for every surface, fed from facts the rounds already stamp plus
the pull): **Plans filed** (`plans_filed`, and the probe read them) → **Robot read the set** (`read_at`: substrate
and page text) → **Fixtures ready · 23** (the pull landed, and the run is sealed) → **Checked** (the robot's own check
of its fixtures: the three voices, *21 agree · 2 to look at*; the owner's *audited*) → **Sealed** (`locked_at`) →
**Sent** (`bid_date_sent`) → **Scored** (`scored_at`, with the delta and the fixtures score on an assisted bid). The
lit stop carries one plain sentence (*The robot's fixtures are ready. 23 found, 21 sure.*); an **assisted** chip joins
the strip once she takes any. A run that cannot read the set lights no stop past Plans filed and says why in the
need's words (`robotRowState.ts`).

**When do fixtures open? The owner's pick (2026-10-30): once the robot seals.** *"that way we know the bid is complete
and all errors have been checked."* The robot writes the pull at the end of pricing, minutes before it seals in the
same round, so **Fixtures ready lights once the run is sealed**, the same gate the Plans panel's *Ask the robot to
look* uses (v2.5737): the two robot doors on a bid open at the same moment, and the list never changes under her.
Before that the stop reads *The robot is counting. Its fixtures open when it seals its number, usually within the
hour.* When they open, the bid's estimator gets a Needs You line (*The robot's fixtures are ready on b641*,
`dashboardNeedsYou.ts`) so she never polls.

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

### 6. The price

**The owner's pick (2026-10-30): a count and a price from day one.** *"The purpose of fixtures is to both have a
count and price."* The first pass had counts alone; it is dropped.

The robot priced each fixture from the 🤖 Robot Default price book, one unit price per fixture, and that number rides
on the pull row. Her price book prices a row by name. So:

- **Her book first.** A robot row lands named for the fixture type the robot priced, and her active price book prices
  it the way it prices any row: an entry of hers for that type wins by name. Nothing of the robot's touches a row her
  book knows.
- **The robot's price where her book has none.** For a landed row with no entry in her book, the RPC writes the
  robot's unit price as the row's custom price (`bid_count_row_custom_prices` on the active version) and marks the
  pull row `priced_as = 'robot'` with the custom price's id. The Pricing tab draws the *robot's price* chip on that
  row and a **Use my book** door that hands the row to her book the day she adds the entry. When the bid has no active
  price book version yet, the price waits on the pull row and the Pricing tab's counted door, *Price 3 robot rows at
  the robot's prices*, lands it later.
- **The robot's price beside hers on every robot row**, in grey, from the pull row: *robot $412* next to her $398, on
  the Pricing tab and in the window. A reference she can ignore, never a default she has to undo.
- **The Takeoff is her parts.** The robot has no parts list for a plumbing fixture, so the Takeoff gains only the
  shade and the Robot chip; *Fill from book* expands her assemblies as today, and a row her takeoff book does not know
  reads as it reads today.

### 7. Which plans

The pull records `plan_link` (the bid's `plans_link` at read time) and `sheet_count`; the window's set line names the
set through `planSetsForBid` (`samePlanLink`): *From the set the robot read: Issued set · Oct 2 · 31 sheets · read
Thu 2:14 PM.* When the bid's robot set has moved since (an addendum made the robot's set on Edit Bid), the line says
*You changed the robot's set since. These fixtures are from Issued set.* with **Read the new set**, a request the
round works like a plan question (`next_fixture_read`, one per round, writing a new pull): a later PR, since a sealed
run cannot be re-claimed (`shadowEligibility.ts`: one live run per bid).

### 8. Set aside, never delete

The owner's case: *she might want to hide instead of delete the fixtures the robot proposed*. Three reasons it is the
only way a robot fixture leaves her count:

- **The record.** At send the fixtures score reads the set-aside rows and their reasons, and the audit's questions
  are seeded from them. A deleted row teaches nothing.
- **Her mind changes.** An addendum, a call from the GC, a second look at the sheet: *Put back* is one press, and the
  fixture never shows as New again, because the pull row is still there.
- **A fixture is not a count row until she takes it.** A robot fixture she does not want was never on her count; what
  she sets aside is the robot's proposal, and the proposal is kept.

**Decision.**

- In the window, every bucket's segment reads *Add · Set aside* (or *Keep · Set aside* on rows she took), and a
  set-aside row moves to the **Set aside · N** bucket with a reason chip she picks from a short list, optional, one
  tap: *by others · existing · alternate · wrong count · not sure · other*. The pull row carries `set_aside_at`,
  `set_aside_by`, `set_aside_reason`. **Put back** on the row clears them.
- On the Counts sheet, a shaded row's trash can reads **Set aside** and does the same: `set_aside_robot_fixtures`
  removes the count row through the ledger (so History's Put back holds it too), returns the pull row to set aside
  with her reason, and the fixture waits in the window and under the sheet's fold line, *Robot · 2 set aside · Show*,
  drawn as ghost rows out of the totals with **Put back**.
- A row she took and edited can be set aside too; her edit is kept on the pull row (`taken_count`) so Put back
  restores her number, not the robot's.
- Undo on the toast is unchanged: it returns taken rows to untaken, never to set aside.
- The sheet's *hide from the customer's list* stays what it is and is not offered on robot rows any differently.

## Data model and verbs

New, all in PR 1's migration (`SET lock_timeout = '3s';`, idempotent, the three house calls after each CREATE TABLE):

- `bid_fixture_pulls`: `id`, `bid_id` (the human bid), `shell_bid_id`, `shadow_run_id`, `plan_link`, `sheet_count`,
  `source` (`robot` · `derived`), `check_summary jsonb` (`{agree, conflict, unverifiable}`), `robot_total numeric`,
  `read_at`, `created_at`; one bid may hold several (a re-read).
- `bid_fixture_pull_rows`: `id`, `pull_id`, `tag`, `name`, `description`, `manufacturer`, `model`,
  `connections jsonb`, `count numeric`, `unit`, `per_sheet jsonb` (`[{sheet, page, count, pins: [{x, y}]}]`),
  `backing jsonb` (`[{kind: schedule|note|legend|callout, sheet, page, text, flags[]}]`), `scope_flag text`
  (`by_others` · `existing` · `alternate` · null), `confidence numeric`, `agreement text`, `remark text`,
  `ct_pin_ids jsonb`, `robot_book_entry text`, `robot_unit_price numeric(10,2)`, `sequence_order`; the take:
  `taken_at`, `taken_by`, `taken_as` (`added` · `updated`), `taken_count numeric`, `count_row_id`, `priced_as`
  (`her_book` · `robot` · `unpriced`), `custom_price_id`; the set-aside: `set_aside_at`, `set_aside_by`,
  `set_aside_reason text`. RLS: read by `can_access_bid_for_pricing(bid_id)`; the robot writes through the service
  role (the verb); estimator and up change the take and set-aside columns through the RPCs only.
- `bids_count_rows.plan_tag text` (nullable, the robot's tag on a landed row; a hand-typed row keeps null).
- `bid_count_sources.source_kind text NOT NULL DEFAULT 'counttooling' CHECK IN ('counttooling', 'robot')`.
- `twin_shadow_runs.assisted_at timestamptz`, `assist_kind text CHECK IN ('fixtures')`, `fixtures_score jsonb`
  (`{found, taken, changed, set_aside, reasons: {…}, missed}`), written by `take_robot_fixtures` and by
  `score_locked_shadows` at send.
- `robot_progress()` gains `fixtures_at`, `fixtures_found`, `fixtures_sure`, `fixtures_taken`, `fixtures_set_aside`,
  `assisted_at`; the shell's `[pipeline STG-5b]` stamp is the fact.
- RPCs, SECURITY DEFINER for the bid roles, all refusing on a sent bid (*the bid is sent, the count is the record*):
  `take_robot_fixtures(p_row_ids uuid[], p_bid_version_id uuid)`, `untake_robot_fixtures(p_pull_id uuid)`,
  `set_aside_robot_fixtures(p_row_ids uuid[], p_reason text)`, `put_back_robot_fixtures(p_row_ids uuid[])`,
  `price_robot_fixtures(p_bid_id uuid, p_price_book_version_id uuid)`.
- twin-mcp 1.9.0: `put_fixtures(bid, fixtures)` (fenced to the twin's shell, lands on the paired human bid, 400 rows,
  replaces the shell's earlier pull, `[pipeline STG-5b]`); the kickoffs' STG-5 line; `get_work_state` grows
  `fixtures_pull`. Later: `next_fixture_read`.

Kernels, pure with tests: `src/lib/bids/robotFixtures.ts` (the pull as window rows, the pairing by tag then name,
the buckets against her sheet, what starts ticked, the derived read from a substrate, the price lines, the words,
every sentence under `plainWordsFailures`), `src/lib/bids/robotStage.ts` (the seven stops from a `robot_progress`
row and the bid, the lit sentence, the inline line), `robotFixtureShade.ts` (is this row the robot's, the pill's
words, the set-aside fold's words).

## Where it plugs in

- `BidsCountsTab.tsx`: the button beside *Import from /Tooling* (behind `fixturesReady`), the inline strip on the
  head, the shade on `sheetRow`, the pill words in `countRowFrom` when the source is a robot, the *From* tile's
  robot entry, the trash can reading *Set aside* on a robot row, the set-aside fold line and ghost rows;
  `insertCountRows` is not touched, the RPC writes.
- `BidsPricingTab.tsx`: the shade, the *robot's price* chip and *Use my book* on a robot-priced row, the grey
  *robot $412* reference on every robot row, the counted door *Price N robot rows at the robot's prices*.
- `RobotStatusSheet.tsx`: the strip at the top, **Fixtures ready · 23 · Review them**; `useBidRobotLayer` hands the
  window opener through the overlays (`BidsRobotOverlays`).
- `BidsTakeoffTab.tsx` and the two views: the shade and a **Robot** chip beside the fixture name, as the **ALT** mark
  sits.
- `robotMirror.ts` and `BidsRobotMirrorTab.tsx`: the assisted chip and the fixtures score on a row;
  `confidenceBoard.ts`, `robotScoreboard.ts`: assisted runs beside practice runs; `RobotEnvelopeModal`: the chip.
- `BidPlansPanel.tsx`: the footer's one clause when fixtures are ready. `PdfPageCanvas`: a pins overlay.
- `RobotIconKeyModal.tsx`: one sentence on the assisted chip. `dashboardNeedsYou.ts`: *The robot's fixtures are
  ready on b641* for the bid's estimator.
- Docs that change: `BIDS_SYSTEM.md` (Counts tab, Pricing tab, the Robots group), `GLOSSARY.md` (Robot fixtures,
  assisted, set aside), `EDGE_FUNCTIONS.md` → twin-mcp, `docs/twins/HANDOFF.md`, `docs/migrations/`,
  `ACCESS_CONTROL.md` (the RPCs), the guide *let the robots shadow a bid* gains a section and a new guide *add the
  robot's fixtures to your count*.

## The plan

| PR | What | Size |
| --- | --- | --- |
| 1 | The ground: the migration above, `put_fixtures` and the kickoffs' line, `robot_progress()`'s columns, the five RPCs, `score_locked_shadows` writing the fixtures score. Docs: migrations, EDGE_FUNCTIONS, HANDOFF. Deploy: `db push`, then `twin-mcp` and `twin-setup`. | M |
| 2 | The kernels: `robotFixtures.ts` (pairing by tag, buckets, ticks, prices, words), `robotStage.ts`, `robotFixtureShade.ts`, their tests, the plain-words tests. No surface. | S |
| 3 | The window and the doors: `RobotFixturesWindow` (buckets, ticks, scope chips, backing text, Open sheet over `PdfPageCanvas` with the pins, *Add N fixtures* with the price line, the Set aside bucket and reasons, Put back), the Counts tab button, the status sheet button, the shade and the pill on Counts, Pricing and the Takeoff, the trash can as Set aside, the fold line, the Pricing tab's chip, reference and doors, Undo. Guide *add the robot's fixtures to your count*. | L |
| 4 | The stage: the inline strip on the Counts head, the strip on the status sheet, the Plans panel's clause, the key's sentence, the Needs You line. | S |
| 5 | Assisted: the chip and the fixtures score on the Robot Board row, the envelope and the Scoreboard; the set-aside and missed rows seeding the audit's questions; the set line's record (*On the last 12 bids you kept 91 of 100 robot fixtures*). | S |
| later | **Read the new set** (`next_fixture_read`); equipment schedule rows as their own folded group (the owner said *only the fixtures*); a *Fixtures* lens under 🤖 Robots if the owner wants a desk. | S each |

## How to verify

- **PR 1.** On the dev server with the twin connector, run one round on a ZZ Test bid with plans (`/bid b<ZZ>`):
  the shell's ledger carries `[pipeline STG-5b]`, `bid_fixture_pulls` has one row on the human bid with
  `bid_fixture_pull_rows` under it, each with `robot_unit_price`, `robot_progress()` returns `fixtures_at`. Call
  `take_robot_fixtures` as the dev on two rows: two count rows land on the active version with the robot's share and
  `plan_tag`, one priced by the ZZ bid's book by name and one carrying a custom price, `bid_count_sources` has a
  `robot` row, `twin_shadow_runs.assisted_at` is set, the ledger note reads *took 2 of N*. `set_aside_robot_fixtures`
  on one removes its count row and stamps the reason; `put_back_robot_fixtures` returns it; `untake_robot_fixtures`
  puts the rest back and leaves `assisted_at`. `npx vitest run src/lib/twins`.
- **PR 2.** `npx vitest run src/lib/bids/robotFixtures src/lib/bids/robotStage`: a row of hers named *WC-1* pairs
  to the robot's WC-1; *Water closet (WC-1)* pairs; *Toilet* pairs only through the book's alias; a by-others row
  starts unticked.
- **PR 3.** As the estimator sample (`/dev-login?as=1&to=/bids?tab=counts&bidId=<ZZ>`): the button reads *Robot
  fixtures · N* only on a bid with a sealed run and a pull; the window's New rows start ticked where sure and
  unflagged; untick one; *Add N fixtures* names the count and the foot the price; after the press the rows are shaded
  on Counts in List, By plan page and By group, the *From* pill reads *Robot*, the tile filters; the Pricing tab
  prices a row her book knows by her book and marks one it does not with the robot's price; edit a shaded count and
  the pill reads *Robot 5 → yours 6*; the trash can on a shaded row reads Set aside and the fold line shows it with
  Put back; the Takeoff draws the shade and the chip; Undo on the toast removes the rows. At phone width the window
  is full screen and every row's backing text folds. A bid with no pull draws no button.
- **PR 4.** The inline strip's lit stop and sentence match the status sheet's; the Plans panel's footer carries the
  clause only on a bid with fixtures ready; the Needs You line appears for the bid's estimator the moment the run
  seals with a pull.
- **PR 5.** Send the ZZ bid with a value: the Robot Board row reads *assisted* with the fixtures score and its
  reasons; the Scoreboard counts it with the practice runs, not in *N of 5 in a row*.
- Every sentence a first-timer reads passes `plainWordsFailures` under test; `npm run check:batch-words`,
  `check:empty-words`, `check:error-words` and `theme-tokenize --check` pass.

## Settled by the owner, 2026-10-30

1. **The envelope.** Keep the dollar score on an assisted bid, out of the gate, with the fixtures score beside it.
2. **When fixtures open.** Once the robot seals its number: *that way we know the bid is complete and all errors have
   been checked.*
3. **The price.** A count and a price from day one: her book first, the robot's price where her book has none, the
   robot's price beside hers everywhere.
4. **Hide, not delete.** Set aside with a reason; Put back; never deleted.

## Still open, with the default the build takes

- **The door.** The Counts tab button with the status sheet as the second door. A *Fixtures* lens under 🤖 Robots is
  the owner's call later.
- **Equipment.** The pull covers the fixture schedule and the drawn fixture tags; water heaters, interceptors and
  backflow preventers on an equipment schedule come as their own folded group in a later PR.
- **The reasons list** for Set aside: *by others · existing · alternate · wrong count · not sure · other*. The
  estimator may want other words; the list is one constant.
