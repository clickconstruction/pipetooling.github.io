# Development page — design spike (punch list #208, 2026-10-28)

A working prototype of draft 3's Development page, filled with the real site (the one the owner
named, 13 bids and 30 jobs at one address, 9 of the jobs tagged and no bid), so the owner can walk it
before PR 2 is cut and we learn what to add and what he likes. The spike ships nothing: no PR, no
release note, no migration. This note names the real site and never its customer, GC, people or
amounts; the screenshots show them, so they live outside the repo (the session's shared notes
folder), not here.

## Where it is

- Picking it up on another computer: [`SPIKE_HANDOFF.md`](./SPIKE_HANDOFF.md).

- Branch `claude/objective-williams-960014` (worktree `.claude/worktrees/wifi-frequency-check-c7aabd`).
- Open it on the dev server as the dev: `/dev-login?as=1&to=/developments/7d7b2580-3301-42bd-af10-85d75b941918`.
  With `?all=1` on the page's path the address matches draw from the first paint
  (`/developments/<id>?all=1`); without it, press **Show the 34 here** on the *not in it* line.
- The ZZ fixture: `/developments/be4449ca-64b4-4c42-8b89-21e0f0426989` holds bid B398 and the job it
  became, one paired row, two closed questions, so the paired shape and the Questions card can be seen
  without the real site.

## What is built

| Piece | File | Reads |
|---|---|---|
| The page, the head, the counts, the *not in it* line, the toggle | `src/pages/DevelopmentPage.tsx` | — |
| The reads, under the dev's own policies | `src/lib/developments/fetchDevelopmentPage.ts` | `developments`, `bids`, `jobs_ledger` (by `development_id`, then an `ilike` on the members' street words narrowed to exact `normalizeAddressKey` matches), both request tables and their notes, `bids_submission_entries`, `bid_changes` (plans columns), `job_status_events`, `jobs_ledger_invoices`, `jobs_ledger_payments`, `jobs_ledger_thread_notes`, `jobs_ledger_team_members`, `users` (names), `customers` |
| Members, counts, people, the bid's status word, the pulse words | `src/lib/developments/overview.ts` | pure |
| The Pieces rows (the pairing by `bid_id`, the done fold, the Waiting cell) | `src/lib/developments/pieces.ts` | pure |
| The What changed lines and where the *since* line sits | `src/lib/developments/whatChanged.ts` | pure |
| The plan sets, newest first, who carries an older one or none | `src/lib/developments/plans.ts` | pure |
| *You last looked* and the toggle, on the device | `src/lib/developments/sinceYouLooked.ts` | `localStorage` |
| The jump strip (Messages' strip over four cards) | `src/components/developments/DevelopmentJumpStrip.tsx` | — |
| The Pieces table, cards at phone width | `src/components/developments/DevelopmentPieces.tsx` | — |
| The feed, the Plans card, the Questions card, the shared bits | `src/components/developments/DevelopmentFeed.tsx`, `DevelopmentSideCards.tsx`, `developmentPageBits.tsx` | — |
| The route | `src/App.tsx` (`developments/:id`) | — |
| The doors: the Bid window's house line and the Job window's house line open the page | `src/components/bids/BidPreviewModal.tsx`, `src/components/jobs/DetailJobModal.tsx` (+ `development_id` on `LimitedJobDetailSnapshot`) | — |

Not built: the pulse on the house lines (they read *name · Open ›*), the Ask (a toast says PR 4), *Put
the N in* (a toast says PR 3), the Pipeline chip's door, the GC Review and Settings doors, the search
box door (the doors list is static; a development by name needs a dynamic finder), the estimator's
read (PR 6), unit tests on the kernels, a help guide. `layoutRouteAccess.ts` needed no change for the
office set (every path is theirs); the estimator's list gains `/developments` in PR 6.

Walked on the dev server (port 5192, the pane hidden, driven by `read_page` and JS clicks): the head,
the counts, the strip, the toggle both ways, **Mark as looked** (the line moves to now, the strip's
count reads 0), the Pieces table and its done fold, the Plans card, the Questions card on the ZZ
fixture, both doors (the window closes and the page opens), and the phone width at 375 (no sideways
scroll, the table becomes cards with *Show the other 17 pieces*, the strip reads as one line, the
counts 2-up). Typecheck clean (`error TS` grep). Lint and the test suite not run.

## The counts, against the boards

| Where | Bids | Jobs |
|---|---|---|
| The head, toggle off (members by `development_id`) | 0 | 9 |
| The Pipeline's house filter (members by `development_id`) | — | 9 |
| The Bid Board's house filter (since v2.6019) | 0 | — |
| The head, toggle on (members plus the address matches) | 13 | 30 |
| The Bid Board searched by the address | 13 | — |
| The Pipeline searched by the address | — | 30 |

The survey counted 29 jobs; a 30th was made the morning of the spike, with a plans folder on it, and
it is the only piece on the site with a plan set. The toggle-on head is the site; the toggle-off head
is what the development row knows. PR 3's one press closes that gap.

## What the real rows made us add that the mock-up lacked

1. **A fifth bid status: *off the board*.** Every one of the 13 bids was archived off the working
   board with no outcome and no send (`working_board_archived_at` set, `outcome` and `bid_date_sent`
   null). The mock-up drew won · lost · sent · working. The spike's `bidStatusWord` adds *off the
   board* (grey, outlined) and the head's Bids tile says *13 off the board*. The Bid Board's *Not yet
   won or lost* counts only **sent** bids, so its pending count (0) and the head's *not yet decided*
   (13, undecided = not won or lost) disagree; PR 2 picks one word and one rule.
2. **The piece's name is the job's name, and twelve of the thirty jobs are named after the
   customer.** On the Pieces table those rows read as the same word three times over, told apart by
   number and money alone; the bids carry the site's words in every name. The mock-up assumed names
   like *Septic system*. Open: a piece name of its own on bids and jobs (the README left it for later),
   or the Pieces cell showing the number first and the name muted.
3. ***Not in it* is 34, not 3.** 21 jobs and 13 bids. The line and its one press are the right size;
   the per-record *Put it in* on Edit Bid and Edit Job would be 34 edits. The spike's toggle
   (*Show the 34 here*, on the device) stands in for PR 3 and might be worth keeping after it as a
   preview before the press.
4. **The feed is 211 lines for the full site, 102 for the 9 members**, and stage events dominate: one
   person's bulk re-stage of three jobs on one August night made nine lines in two seconds, and a
   February billing pass made twenty. PR 5 should fold same-actor, same-minute stage moves into one
   line (*3 jobs moved Billed → Waiting*).
5. **The office uses the job note as an assignment stamp.** Nine of the ten newest lines are one-word
   notes (a first name) on nine jobs in one minute. As feed lines they are noise. Options: hide notes
   under four words, draw them as one grouped line, or leave notes out of *since you looked*'s count.
6. **Plans read as true and useless.** No bid carries `plans_link` or `design_drawing_plan_date`;
   `bid_changes` has no rows for these bids (the ledger postdates them); the one set is today's job's
   folder with no date, so the card says *the newest set is the one filed Oct 28 · 42 on an older one
   or none* and offers *Ask the estimators about the 42*. The line should draw only when the newest set
   has a date, and read *No set is dated on this site* otherwise.
7. ***On site* reads the team-members table, which is everyone ever added to the job**, office
   people included; the working job lists six names. The schedule (`job_schedule_blocks`, the last
   seven days) is the right source for *on site since*; team members for *who to call*.
8. **GC contact is empty**: one bid has a one-letter contact name (the kernel ignores names under two
   letters), the rest none, and the development row has no GC. Estimating fills from the bids'
   estimators (two names). The head's people line needs a *none yet · add one* door rather than three
   greys.
9. **Money says little here.** One bid has a value; no bid was sent; no invoice rows are readable for
   these jobs (the paid ones were imported with payments only), so *Open on bills* is $0 and *Bid,
   not yet decided* is one bid's price. The tiles are right and quiet. The Done fold reads *20 paid
   jobs* with the money inside the fold, which is the one place the site's size shows.
10. **No question exists anywhere on the site**, so the Waiting tile, the Waiting column and the
    Questions card are all empty states on the real site; the ZZ fixture shows them filled (two closed
    asks with their answers). PR 4 is what makes the page's first question real.
11. **The two boards take no development from the URL.** The Pieces header's *Bid Board* and
    *Pipeline* links open the boards unfiltered. PR 2 adds `?development=<id>` to both (the Pipeline's
    `stagesDeepLinks`, the Bid Board's params) so the header's door lands filtered.
12. **The address has two spellings on the site** (*Sc* and *SC*); the key matches both and the head
    prints the majority spelling. The street-word `ilike` (`%gun%dog%`) brought back exactly the 43 and
    nothing else; a short street name (*Main*) would bring back more rows for the key to drop, which
    is fine under the 500-row cap but worth a tripwire.
13. **Two of the thirteen bids have no customer**; the head takes the majority customer of the pieces.
    The development's own `gc_customer_id` is null here; when set it leads.
14. **The first look.** With no stamp the feed's header says *211 lines · first look* and nothing is
    counted new; the first **Mark as looked** starts the count. The alternative (everything is new on
    the first look) would open the page with 211 new lines, which reads as a wall. Kept as drawn.
15. **dev-mcp does not know `bids.development_id` yet** (its catalog regenerates with the pending types
    chore), so the fixture's bid could not be read by that filter; the page reads it fine.

## What reads wrong or thin on the real site (to fix in PR 2)

- *today ago* on the since line (fixed in the spike: *today* drops the *ago*).
- The Waiting tile's sub-line *on the estimators or Dispatch* under *Nothing* reads as a sentence
  fragment; *nothing asked* is enough.
- The Plans card's *No set* row lists 42 pieces (12 shown, *and 30 more*); on a site this size the row
  should say *42 pieces carry no set* and stop.
- The Pieces table at desk width wraps the long bid names (*… BESS BUILDING gas lines*) over three
  lines; a `max-width` and an ellipsis with the full name on hover, or the number first.
- The feed's *New job* and *New bid* lines for the 20 imported jobs all carry the import day (one
  August morning), which is when the rows were made, not when the work happened; `last_work_date` is
  the better stamp for an imported paid job.

## What the owner said as he walked it

Walked 2026-10-28 on the dev server with the address matches drawn. His words, verbatim.

- **likes**: the Pieces idea. *"I like the idea of the pieces section, but they all fulfill
  different things. So bids should be turned into jobs, for example, and we should kind of see them
  paired together."*
- **does not like**: on the real site nothing pairs (`bid_id` is null on all 30 jobs), so the table
  reads as two lists on one grid; and the column headers are too small: *"the titles of Piece / Bid /
  Job / Plans / Waiting on should all be large, like on the bids tab"* (done in the spike: the Pieces
  headers now match the Bids tab's; a second pass the same day, *"I don't like how little the titles
  are and how big the text is here"*, put the titles above the rows: titles 0.82rem bold, the rows
  0.78rem with 0.72rem sub-lines, the Bid Board's density).
- **asked for**: a tool on the page to pair a bid with a job, and one bid with several jobs:
  *"How can I offer A tool to more easily connect bids and jobs?"*; and unpairing as easy as
  pairing: *"I realize if a bid and a job are connected I may need to separate them later, We should
  try and make that easy too."* The lead is answering with a design (a pairing mode on the Pieces
  card: the unpaired bids and jobs side by side, suggestions by shared name words first, one press a
  pair writing `jobs_ledger.bid_id`, a counted press for the agreed suggestions, Unpair with Undo on a
  paired row, New Job from a won bid as the forward path; Edit Job's Disconnect already unpairs one at
  a time). Not built in the spike until he says go.

## Pairing bids with jobs (the owner's ask, built after the walk)

**The ask.** *A tool to more easily connect bids and jobs*, and *if connected I may need to separate
them later, make that easy too*. A pair is `jobs_ledger.bid_id`, the link Edit Job's *Disconnect bid*
already clears; one bid may take several jobs; pairing writes that column and nothing else.

**Mock-ups first.** The owner asked for mock-ups and a *best we can do* pass before the prototype
took it ([`pairing-mockup.html`](./pairing-mockup.html), made-up data): **A** a pair mode that swaps
the table for two columns (built first as the running candidate), **B** pairing in the row (the gap
in the row is the tool, Unpair in the same cell), **C** a review deck. The pass recommended B with
A's strip. **The owner's pick, verbatim:** *"I like the idea of pair mode, I think there should be
sometime to toggle it on and off and when on it should look like B"*.

**What is built (the pick).** **Pair bids with jobs** on the Pieces header toggles the mode; the
table stays. With it on: a strip above the table lists the likely pairs by name as line items (the
owner's second ask on the walk: *"in the four likely pairs by name, I would like to see the items as
line items"*), each with the bid, the job, why, its own **Pair** and *not this*, under **Pair the N**
and **Not these**; every gap cell has one shape (*"when a user goes to pair bids with jobs I don't like how
this looks, I think it could look more uniform"*): the first row the likely one by name with Pair
and *not this*, or the quiet empty words, the second row the two actions as matching small presses
in the same place on every row, the name cut with an ellipsis so the row never wraps, and both
rows' presses on the cell's right edge (*"maybe we should make pair and not this aligned right and
became and make this job also aligned right"*), then Pair and *not this* moved down to the actions row
(*"maybe we should put pair and not this on the second line with became and make this job"*) and
all four drawn as the same small press, Pair the only filled one (*"now that all four of those
things are on the second line, maybe we should make them look more uniform"*); and the piece cell
took the same two rows, the name above and the *not in Gun Dog* chip below (*"Perhaps we should
move the not-in-gundog to the second line as well"*); and the four presses got the
owner's words (*"I don't like the words of became… / make the job / not this / Pair"*): **Pick the
job…** / **Pick the bid…**, **New job from bid** / **New bid from job** (the app's own door's name, cut for
the cell), **Not a match**, **Pair JP956** (the verb and its object, the house rule for a press that writes;
the strip's wider rows say *Pair BP161 with JP956*), and the chips *likely match* / *possible match*, offered beside *Choose a job…*, *Link a
job…*, *Create the job*, *Skip*, *Wrong pair*, *Link*, *Match*; the four presses then went
down a size (20px tall, 0.66rem) and the Bid and Job columns took their share of the table (27% and
33%) so four presses fit one row (*"What if we made the words and boxes smaller?"*); an unpaired job's Bid cell reads *no bid here ·* the likely bid with its chip
(*likely* / *maybe*), **Pair**, *not this*, and *came from… ▾*; an unpaired bid's Job cell reads *no
job yet ·* the likely job, **Pair**, *became… ▾*; a paired row's bid cell has **Unpair**, whose toast
offers **Put it back**. The picker is a sheet in the cell with a search line, the site's unpaired bids
(the likely one first and marked), the bids that already have a job (*→ J… · a second job*), and *It
came from no bid · hide this* (on the device). **Mark the N paired bids won** is a counted press on
the header, never automatic, drawn only while a paired bid has no outcome. **Done pairing** turns the
mode off and the table reads as before. Kernel `src/lib/developments/pairing.ts` (words minus the
site's, then the same value, then the bid's date before the job's); writes
`src/lib/developments/pairingWrites.ts` (one update per pair, the updated id read back so a policy's
refusal is an error); cells `src/components/developments/DevelopmentPairCells.tsx`.

**On the real site** (read only, nothing pressed): the kernel yields **4 likely pairs** from the
names, one *likely* (two shared words) and three *maybe* (one shared word each), and 13 bids and 30
jobs for the picker. The names share few words, so most pairing there is the picker, as the pass
said. The site's own words (the development's name, the street, the customer) are dropped before
scoring, which is why the fixture's pair reads *same value · bid first* and not a shared word.

**Walked on the ZZ fixture** (the only writes): Unpair → two rows with *1 likely pair by name* and
the toast → **Put it back** → paired; Unpair → the row's **Pair** → paired; Unpair → *came from… ▾*
→ the sheet lists the bid, *likely* → pick → paired. `bid_id` read back through dev-mcp as the
fixture's bid after the walk. Phone width 375 in the mode: no sideways scroll.

**To fix in the PR.** The unpair toast outlives a re-pair, so **Put it back** can show after the
pair is already back (harmless, the same id; dismiss it on the next write). The *won* press has no
confirm window and moves bids on the Bid Board; a confirm with `confirmLabel` is the house rule for
a counted write. The picker closes on an outside press but not on Tab away. A job that came from two
bids has one link.

**Backfill: the missing half of a pair (the owner's next ask).** *"Should we also make it easy for a
user to create a bid or create a job and then in the act of doing so have a modal pop-up where they
can backfill it with information."* Mock-ups first, as he asked ([`backfill-mockup.html`](./backfill-mockup.html)):
**A** the full form prefilled (how New Job from a bid works today), **B** a backfill sheet in the row
with the few guessed facts on top and the rest copied silently, **C** one press with no sheet. The
pass picked B: the word was *backfill*, so the sheet's job is to show what the app is guessing (the
value, the day, who) before the record lands. Built in pair mode beside *came from…* and *became…*:
**make the bid** opens the sheet *Make the bid J… came from* (name from the job, won for the job's
revenue, won on the job's last work day, the job's account man as estimator, the customer, address,
development and trade copied as is), and **Make the bid and pair it** inserts the bid born won with a
note saying where it came from, the number from the database, and writes the job's link in the same
press; the toast offers **Undo**, which unpairs and deletes the bid. **make the job** opens New Job
from this bid, prefilled, which pairs on save (the full form, draft A, for that direction; B's sheet
for it is a PR item). Walked on the ZZ fixture: the sheet filled from the job, the bid made and
paired, Undo took it back (the row gone through dev-mcp), the row re-paired; *make the job* opened
New Job with the fixture's name and address filled, closed without saving. Writes:
`src/lib/developments/backfillWrites.ts`; sheet `src/components/developments/DevelopmentBackfillSheet.tsx`.
For the PR: the estimator should be a pick, not the job's account man by default; a backfilled bid
needs its own mark on the Bid Board (the note is the only tell today); Undo's delete is refused for
anyone but the bid's maker and a dev, and the error says so; the *Open the full form instead* link
needs a New Bid prefill that does not exist yet, so the spike leaves it out.

**Two chips that act (the owner's next ask).** *"What does not in it and off the board mean?"*, then
*"I would like to be able to click not in it or click off the board and have it add it after a
modal confirmation."* Mock-up first ([`chips-mockup.html`](./chips-mockup.html)): the two chips drawn
as presses (a dashed edge, a dotted underline, a title), the two confirm windows, the two toasts with
the way back, and the pass (a confirm because both writes land on a board or a filter other people
read; one column each; the chips' words could be *archived* and *not in Gun Dog*). Built: *not in it*
presses → *Put J… in Gun Dog?* with the house rule's `confirmLabel` (**Put it in Gun Dog**) → one
`development_id` write → the toast's **Take it out**; *off the board* presses → *Put B… back on the
board?* → **Put it back on the board** clears the two archive stamps, as the Bid window's own press
does → the toast's **Hide it again** restores them. Writes in `src/lib/developments/chipWrites.ts`;
the press chip in `developmentPageBits.tsx` (`PressChip`); the chips in `DevelopmentPieces.tsx`.
Walked on the ZZ fixture: the job taken out of the development through its Job window (Edit →
Development → None), the page then read *1 not in it* and the chip on the row; the chip's confirm
read as drawn; **Put it in** put it back and the counts followed; **Take it out** took it out; put
in again to leave the fixture as it was. **Not walked**: the *off the board* press, because no
fixture bid is both unsent and hidden from the board, and making one takes the New Bid form and a
delete; its write is the one `BidWorkingBoardArchivedModal` makes. The owner can press it on the
real site himself, where all thirteen bids carry the chip. For the PR: the chips' words (finding 1
and the pass), a Tab stop and a focus ring on the press chip, and whether *Put the N in* becomes a
loop of this write until PR 3's transaction lands.

**The confirm windows, shown not told.** The owner on the first draft's paragraphs: *"I don't like the
text… how can we offer something more show less tell?"* Redrawn in `chips-mockup.html` and built
(`DevelopmentChipConfirm.tsx`): the record as it is and as it will be, one row per fact with *now*
on the left and *after* on the right, the fact that changes lit with its before and after, the facts
that stay greyed and marked *same*, the last row the place it lands with its count (the Pipeline's
house filter 0 jobs → 1 job; the Unsent/Working board), and under the rows the line as it will read
there (the house line drawn as the Pipeline draws it; the board's card). No paragraph. The button
still carries the verb. Walked on the ZZ fixture: the job taken out through its window, the chip's
card read as drawn, **Put it in** put it back and the counts followed. The house ConfirmDialog takes a
string, so the spike draws its own window; the PR either widens the house dialog to take rows or
keeps this one as the chips' own.

**The chips' words.** The owner: *"i don't like the words 'not in it' and 'off the board', what other
words can we use?"* Offered: *not in Gun Dog* · *no development* · *at the address* · *add to Gun
Dog*, and *archived* · *hidden* · *shelved* · *never sent* · *parked*. **His pick: *not in Gun Dog*
and *archived*** (the Bid Board's own word for the list). Applied everywhere the page says them: the
chips, the head's Bids tile (*13 archived*), the *not in Gun Dog* line, the board window's row
(*archived May 12 → Unsent/Working*), the toasts. Finding 1's *off the board* reads *archived* from
here on.

**The feed folds.** The owner, on a What changed card with nothing new: *"I would like this to be
collapsable so it can be more compact or auto compact that puts 'You last looked · Oct 28 · older'"*.
Built: the lines under the since line fold by default, the since line is the press that opens and
closes them (*You last looked · Oct 28 · 102 older ▸*), so a card with nothing new is one line; the
new lines above it always show; the first look, with no stamp, keeps its newest page and *Show all*.
Finding 14 (the first look) and finding 4 (the feed's size) read with this in mind. Then: *"when
there is nothing to see perhaps we can make this compact into one line and maybe even a button that
if clicked visually expands and looks reactive"*. Built: with nothing new the card is one row, *What
changed · nothing since you looked · Oct 28* and a **Show 211 older** button whose chevron turns and
whose press shows (`.developmentFoldButton` in `index.css`); the older lines slide in under it
(`.developmentUnfold`); the since line is drawn only when there are new lines above it.
Then: *"I would like to be able to search for people or jobs or bids, and see the items I search
for and the time and date not just the date when searching, this allows me to see movement or track
down problems"*. Built: a search box in the card's header (*Search people, jobs, bids*); every word
typed must appear on the line, in the record's number and name, the verb, the words or who did it
(`filterChangeLines` in `whatChanged.ts`); the matches draw newest first, new and old alike, with the
time beside the day (*Oct 9 · 10:18 AM*); a line whose source keeps a day and not a moment (a sent
date, a paid-on day) carries `dayOnly` and shows no time; the header counts *N of 211 lines match*;
× clears. On the real site a first name finds the nine assignment notes with the minute they were
written, which is the movement he asked to see.
Then: *"When searching, I would like for the things that I have searched to be highlighted in what
is shown."* Built: the typed words are lit in every match, in the record's number and name, the
verb, the words and who did it (`splitForHighlight` in `whatChanged.ts`, longest word first so *gas
line* lights whole), on the amber the app uses for a mark.

**The strip: a review, not a flow.** The owner, on the jump strip: *"I think we should make it more
clear that this is a review process and not a flow chart where things flow through it. How could
you help me make it look like that so we can show but still tell a user in some ways."* The strip
had borrowed the Pipeline's stage bar whole, arrows and dots included. Mock-up
([`strip-mockup.html`](./strip-mockup.html)): **A** sections with no arrows and a cap *On this page*,
**B** a review of four numbered looks that tick as you scroll past them with *Review · n of 4* on
the cap, **C** a checklist the leader ticks himself. The pass picked B (A only stops telling the
wrong thing, C makes the leader do the telling). Built in `DevelopmentJumpStrip.tsx` with
`.developmentReviewStrip` in `index.css`: ① What changed ② Pieces ③ Plans ④ Questions, the number
lit while in view, a green tick once passed, the cap's title carrying the one-sentence tell, the
counts with their nouns (*0 new*, *1 set*), the newest-set tail kept, no arrows, no dots. A tick means
*looked at this visit* and resets on the next. The rule: a look is ticked once its whole card has
been on screen (its bottom edge has come up past the window's bottom), which a long card reaches
only when scrolled through and a short one at once, or once the page has scrolled past it to a
later look. The first cut ticked all four at the page's end, which fired on a jump to Plans; replaced.

**The strip, second look: no ticks, and the tail's subject (the owner's next ask).** The owner, on
the second computer, with the page open: *"in the header area I don't understand How pieces or plans
can be marked off that doesn't make sense to me"*, and *"I also don't understand the subject of "set
filed Oct 28 is the newest · 42 on an older one or none" How can we improve this area"*. He is right
on both: a tick is a mark of completion, and on *Pieces* or *Plans* it says the pieces are done; the
tail is a sentence with no subject on it, in a bar whose subject is the whole page. Mock-up first
([`strip-place-mockup.html`](./strip-place-mockup.html)): **A** *On this page*, a jump bar with the
look in view lit and nothing else (no numbers, no ticks, no score, no tail); **B** where you are and
what needs you: the numbers kept as the order, the one in view filled, never a tick, no score, the
tail gone and each look's count gaining, in amber, the thing in it that needs him with its noun (*4
likely pairs*, *42 without a set*, *1 waiting*), so the tail's one fact sits on its subject; **C**
A's bar with one muted sentence under it that follows the look in view (*Plans · The newest set is
dated Oct 20. 7 pieces carry an older one or none*). The pass recommends B (A says nothing the cards
do not; C costs a line and moves, in the one bar he asked not to move) and, straight in beside it,
the Plans card's own line reworded with its subject: *42 pieces have no plans filed* when no piece
carries an older set, *7 pieces are on an older set than Oct 20* when some do (finding 6). **His pick,
verbatim: *"B"*.** Built: `DevelopmentJumpStrip.tsx` takes `looks` (each look's plain count with its
noun and its amber *need* words) in place of `counts` and `tail`; the tick state, the score and the
tail are gone; the cap reads **Four looks** with the tell as its title (*The filled number is where
you are*); a look whose need repeats its count (*3 new*; *1 waiting* when every question is open) is
drawn once, in amber; on the phone the amber words stand in for the plain count, and the cap and the
four looks wrap as one flow (three rows at 375, 88 px, the height the strip had). The page composes
the looks: *N new* from the since line, *N likely pairs* from the pairing kernel's suggestions less
*Not these*, `plansNeedWords` in `plans.ts` (*42 without plans* when no piece has any set, *N not on
the newest* otherwise), *N waiting* from the open requests. The Plans card's line reads
`olderOrNoneLine` from the same kernel, with its subject first: *42 without plans · 42 pieces have no
plans filed. The newest set is the one filed Oct 28.*; *N on an older set · N pieces are on an older
set than Oct 20.*; or, mixed, *N not on the newest · N pieces are on an older set than Oct 20, and M
have no plans filed.* On the real site at 1400 the strip reads *Four looks · ① What changed 0 new ·
② Pieces 23 · 4 likely pairs · ③ Plans 1 set · 42 without plans · ④ Questions 0*, the filled number
following the scroll, nothing ticked. Beside it, the two grey chip literals in the pair cells that
the theme check refused became `var(--text-faint)`.

**The counts' further detail on hover (the owner's next ask).** With the strip rebuilt, the owner on
the head's five count tiles: *"I llike the idea of this section, I would like to be able to hover
over each of these cards and see a modal with further detail"*. Mock-up first
([`counts-hover-mockup.html`](./counts-hover-mockup.html)): **A** a card on hover, pinned on press, a
sheet on a phone, the records grouped by the count's own rule with the board's door in the foot; **B**
the tile a press that opens the house window with the full table; **C** a row that unfolds under the
five tiles. The pass recommended A (B is a press, not a hover, and covers the counts it explains; C
moves the page under a hover). **His pick, verbatim: *"Build A"*.** Built: the kernel
`src/lib/developments/countCards.ts` (`buildCountCard`, pure) picks each count's rows from the same
members and requests `headCounts` reads, grouped by the count's own rule: Waiting the open questions
oldest first with the lane, the age and the asker; Bids by status (sent · working · archived · won ·
lost) with the value, the estimator and the sent or archived day, the head's meta carrying *N not yet
decided* so the tile's number is explained without a second listing; Jobs by stage in the Pipeline's
order with revenue (or *$N open*), the crew and the last work day, the paid ones one folded line
(*20 paid jobs, $… all in · folded in Pieces*); Bid, not yet decided the undecided bids by price with
*not counted* on the ones with no price and a foot note that the priced ones add up to the figure;
Open on bills the billed jobs with *$N open* and *billed · paid* beside it. Eight rows a card, then
*and N more*; an empty count holds its sentence (*Nothing waiting on the estimators or Dispatch. Ask a
question in the head starts one…*). The component `DevelopmentCounts.tsx` draws the five tiles and
the behavior: the card drops under the tile 120 ms after the pointer rests and leaves 260 ms after it
goes (staying while the pointer is on the card); a press pins it until Escape or a press elsewhere
(`useCloseOnOutsideClick`), a second press on the same tile lets go; the two right-hand tiles anchor
their card to the right edge so it never leaves the page; every row's number is the record's window
and the foot is the board (the Bid Board, the Pipeline, GC Review, or the Questions card), closing the
card as it goes; the tile is a `role=button` with `aria-expanded` and `aria-haspopup=dialog`, Enter
and Space pin, a focus ring in `index.css` (`.developmentCountTile`, `.developmentCountCard`). On a
phone nothing hovers: the tap opens the card as a sheet under the tiles with ×, names wrapping, metas
dropped. The counts grid lost its `overflow: hidden` so the card can float. Walked on the real site
(reads only): Bids *13 bids on Gun Dog · by status · 13 not yet decided*, Archived · 13, eight rows,
*and 5 more*; Jobs Working · 2, Waiting · 8, *and 2 more*, the paid line; Open on bills its empty
sentence, right-anchored; pin, a row opening the Bid window, Escape; at 375 the sheet and its ×, no
sideways scroll. For the PR: the board doors land unfiltered until `?development=` exists; the card
reads the pointer's rest with timers, which a render test must fake.

**The empty Waiting card shows, not tells (the owner's next ask).** On the card's sentence, *"Nothing
waiting on the estimators or Dispatch. Ask a question in the head starts one, and it is kept here with
its answer."*, the owner: *"i don't like this, we should show instead of tell so the user knows what
they could be waiting for"*. Mock-up first ([`waiting-empty-mockup.html`](./waiting-empty-mockup.html));
waiting on his pick.

**The Pipeline's progress and pay cell, for a whole development (the owner's next ask).** With two
screenshots, the Pipeline's progress cell on one job (the percent done, the bar of paid · billed · left,
the stage count, *Left on Job*, *This bill* with billed on, expected, *Pays in ~N d*, *Lien by*,
*Approve the notice*, *Ask for a date*) and the Development page's head: *"in jobs stages we have
this view, and I would like to find a way to offer it in a way that encompasses an entire
developemnt"*. Mock-up first ([`site-progress-mockup.html`](./site-progress-mockup.html)): **A** a Money look
between Pieces and Plans (the site's bar, legend and stage counts, the open bills in the cell's dated
shape under it, tightest first); **B** the same inside the Open on bills hover card; **C** the cell
on every Pieces row with a site row above. The pass recommended A. The owner: *"I'd like a
combination of A and C, how could that look?"* Drawn three ways in
[`site-progress-ac-mockup.html`](./site-progress-ac-mockup.html): **A1** a Money look, the site's band on top
and one row per live job with the cell laid across (progress · money · dates · next), the paid
folded; **A2** the band atop Pieces and the cell in its rows; **A3** short rows that unfold the whole
cell. The pass recommended A1. The owner: *"I like A1 and would like to be able to sort or minimise
sections"* and *"can you help think through what that would look like and add it to our mockups"*.
Drawn in [`site-money-sort-mockup.html`](./site-money-sort-mockup.html): **S1** stage sections that
fold to their sums, the rows sorted inside them from the column heads with the *Sorted* chip, the band
foldable, Paid folded by default; **S2** one sortable list; **S3** a Group by and Sort by menu; and
the page's looks folding to one line each. The pass recommended S1 with the looks' fold. **His pick,
verbatim: *"Build A1 with S1"*.** Built: the kernel `src/lib/developments/siteMoney.ts` (`buildSiteMoney`,
`sortMoneyRows`, `moneyLookWords`, pure) reads the same jobs the page has plus `pct_complete`, the
invoices and the pay-speed read the Pipeline's billed rows make (`get_billed_customer_pay_speeds`,
parsed by `parsePaySpeedsRpc`, added to `fetchDevelopmentPage` as `paySpeed`, null when the read
fails); a row is the cell laid across: the job and its stage, the crew and last work, the percent and
value with the mini bar (paid · billed · done-not-billed, the tick at the percent), *$N left* with
paid under it, the dates on a billed job (billed on and its age from the newest invoice, the expected
day from `billedExpectedPayModel` with the payer's or the company's pace, the lien day from
`lienByForJob` with *kind assumed* when the property kind is not set), and Next (*Ask for a date*
when the expected day is past, *the notice · Lien desk ›* while a lien date stands). The band sums the
rows: the percent weighted by value and drawn only when every live job with a value has one on record
(else *no percent yet · N jobs have no percent on record*, as the cell's own box reads *—*), the bar,
the legend, *Left on the site* (value less paid, the Pipeline's *Left on Job* summed), the jobs by
stage and the undecided bids as a chip beside them. Sections in the Pipeline's order (Billed, Ready
to bill, Working, Waiting, Paid), each head its sums (*2 jobs · $16,000 left*, *N past due* in red,
Paid *$N all in*), a chevron folding it to that line, Paid folded by default; the band folds to one
line; the column heads sort the rows inside every section (Dates = tightest first, the default: the
shortest lien runway then the longest past expected in Billed, last work newest first elsewhere,
the number in Paid; Progress = % complete; Money = most left; Job = number) with the *Sorted: … ×*
chip on the card's head; on a phone the sections are heads over cards and an *Order:* row sets the
sort. `devicePrefs.ts` remembers the folds and the orders that are settings (tightest first, number),
never a look (% complete, most left), as the Pipeline does. The strip reads **Five looks**, ③ Money
with *$N left* and, in amber, *N bills past due*; every look's head wears the chevron (`Card`'s
`fold`) and folds to the line its chip says, remembered on the device. Walked on the real site (reads
only): the band *— done · 5 jobs have no percent on record* (the live jobs with a value and none), $… on
30 jobs, Left on the site; Working 2, Waiting 8, Paid 20 folded; Progress sorts and the chip reads *Sorted: % complete*,
× puts it back; Working folds, the band folds, Plans and Questions fold to their lines; at 375 the
Order row, the sections over cards, *most left* re-orders the cards, no sideways scroll. **Not seen
live**: a Billed section with its dates and Next, since no job on the real site or the ZZ fixture is in
Billed; the words are the kernel's and a billed ZZ job would show them. For the PR: *Ask for a date*
opens the job here (the Pipeline's press writes the ask); the notice state needs the Lien desk's
reads; the empty-words check flags six bare sentences on the branch's earlier lines.
 His head screenshot, at his screen's width, also showed the strip cutting *What changed* and
*Pieces* short (the segments shared the width equally and the name, not the amber words, gave way);
fixed straight in: `.developmentReviewStrip` segments size by content, a look's name never shrinks,
the amber words give way first with an ellipsis. Checked at 1570 and 1400: no name or meta cut.

**The undecided bids' word.** The owner: *"Bid, not yet decided"* / *"should be"* / *"Bid, undecided"*.
Straight in, everywhere the page says it: the tile's cap (*Bid, undecided*) and the Bids tile's
sub-line (*13 undecided*), the two count cards (*$… bid, undecided*; the group *Undecided*; *by status
· 13 undecided*), and the Money band's chip (*$… bid, undecided*).

**The *not in it* line shows which is the address and which is the development (the owner's next
ask).** On the line *34 not in Gun Dog · 21 jobs and 13 bids share Gun Dog Trail, Neeses, Sc and are
not in Gun Dog.*, with a dark-mode screenshot: *"I don't like how this is written, it should be clear
what is an address and what is the development"* and *"we want to show not tell"*. Mock-up first
([`not-in-line-mockup.html`](./not-in-line-mockup.html)): **A** two rows led by the head's marks, the pin
for the address with what is at it, the house for the development with what is in it and in amber
what is not, a word under each saying which is which; **B** the same with the count now → after the
press; **C** one line with the marks inline and the counts as chips. The pass recommended A. **His
pick, verbatim: *"Build C"*.** Built in the page's line: the lead reads *34 not in* 🏠 *Gun Dog* with the
head's house (`DevelopmentHouseIcon`, labelled *the development*), the counts are two chips
(`.developmentCountChip`: *21 jobs* · *13 bids*), and the rest reads *at* 📍 *Gun Dog Trail, Neeses,
Sc are not in the development.* (the pin labelled *the address*); the three presses as they were.
Walked light and dark at 1400 and at 375 (the chips and the sentence wrap under the lead, the
presses under them).


**Where else the page tells (the owner's question).** *"are there other areas we could simplfy and show
instead of tell?"* The walk's list, most worth doing first: (1) the empty Waiting card's sentence, drawn
as A in `waiting-empty-mockup.html` and not yet picked; (2) the Questions card's empty state, the same
sentence again, which can take the same two Ask presses and the three kinds; (3) the Plans card: the
*No set* row lists twelve numbers and *… and 30 more*, and the amber line is still a sentence, where a
row per set and a *42 without plans* chip that opens those pieces would show it; (4) the head's people
line: *none on the bids* under GC contact is a tell where an *add one* door would show; (5) the other
count cards' empty sentences (*Every bid is decided.*, *Nothing billed is unpaid…*), which can take the
kinds-with-state shape once the Waiting card has it; (6) the Money band's *5 jobs have no percent on
record*, which could be a press that sorts the sections by % complete and lights the five; (7) the
Pieces table's *Waiting on* column, a column of dashes on the real site, which could go when nothing
waits since the tile and the strip say so; (8) the Pieces *Done* fold, which could carry the paid sum
the Money look's Paid head carries. Left as they are: the errors (an error names its reason), the hover
tells, and the feed's lines, which are records. **The owner, verbatim: *"do all 8"*** (so 3 and 4, new
shapes, were built on the list's words without a separate mock-up, by his say-so). Built, all eight:
(1) the Waiting card's kinds (`waitingKinds` in `countCards.ts`): *Questions · none open* with the two
rows *To the estimators · a bid, its plans, its price* and *To Dispatch · a crew, a day on site*, each
with its press (the PR 4 toast for now), *Answers from the customer · no bid is out* (the sent bids as
rows when there are any, *sent, N days*), *Payments · nothing billed is unpaid* (the billed jobs with
*$N open*); with a question open, the open ones lead and the other two kinds follow; the head reads
*Nothing waiting* or *Nothing waiting on us*; a group with a state is drawn even with no rows, its
state on the cap's right; a row can be a kind with a press (`CountRow.press`) instead of a door.
(2) The Questions card's empty state draws the same kinds through `CountCardBody` with `bare`, its
meta *what a site waits on*. (3) The Plans card: the *No set* row and the amber sentence are gone;
under the table a chip row, *N sets*, a press chip *42 without plans ▸* that opens the list of those
pieces (and *N on an older set ▸* when any), *Ask the estimators about the N* on the right, nothing
else. (4) The head's *none on the bids* under GC contact reads *none yet · add one* and opens the
newest bid's window, where the contact lives (Settings' Manage developments when no bid exists);
*no estimator on the bids* reads *none yet · pick one* the same way. (5) The other count cards'
empties show kinds with state: Bids and Jobs with none in the development list the pieces at the
address not in it and a *Put the N in* row (PR 3's toast); Bid, undecided with none lists Won and
Lost; Open on bills with none lists *Ready to bill* and *Working, toward a bill* with each job's
done-not-billed figure. (6) The Money band's *N jobs have no percent on record ›* is a press: it
sorts every section by % complete and lights those rows amber until the order changes again, the
card's *Sorted ×* chip included. (7) The Pieces table draws its *Waiting on* column only while a
piece waits. (8) The Done fold reads *20 paid jobs · $… all in · Show them* (`doneFoldWords` takes
the formatter). The Money look's own empty state became a chip row (*0 jobs*). Walked on the real site
at 1400 and 375: the Waiting card and sheet, the Questions kinds, the Plans chip opening its 42, the
add-one door, the no-percent press lighting five rows and the chip clearing it, no Waiting on column,
the fold's sum. The empty-words check is clean on today's lines; five earlier sentences stay for the PR.

**The *not in it* line's chips open their details (the owner's next ask).** On the line *34 not in* 🏠
*Gun Dog* · *21 jobs* · *13 bids* · *at* 📍 *…*, with a dark-mode screenshot: *"I would like to be able
to hover over 21 jobs and 13 bids and see the details"*. Mock-up first
([`not-in-hover-mockup.html`](./not-in-hover-mockup.html)): **A** the tiles' card under the chip, on
hover and pinned on press, the pieces grouped by stage or status as the Jobs and Bids tiles group
their own, number · name · value · crew and last work (or estimator and the sent day), eight rows
then *and N more*, the paid jobs as one folded line, the foot *Show all N in Pieces ›*, and on a
phone the press opens it as a sheet under the line; **B** the same card as one flat list, newest
work first, the stage as a dot and a word on each row; **C** the chips as the Plans card's amber
press chips that unfold the whole list as a table inside the band, nothing on hover. The pass
recommends A: it answers the ask as asked, it is the card he picked for the tiles, and the Jobs and
Bids tiles' cards already hold these rows under *At this address, not in it* when the development
has none of its own, so one kernel in `countCards.ts` feeds the chip, the tile and the Pieces table.
The foot is the page's own door rather than the board's, since a development filter on a board
would not find pieces that are not in it. **His pick, verbatim: *"Build A"*.** Built: the line's two
chips are presses (`DevelopmentNotInChips.tsx`) that drop the tiles' card under them
(`buildAtAddressCard` in `countCards.ts`, which shares the Jobs and Bids tiles' grouping by stage and
by status, now `jobGroups` / `bidGroups`): the head *21 jobs at* 📍 *Gun Dog Trail* (the street alone,
the line has the rest), the meta *not in Gun Dog · by stage*, the groups with their rows as doors,
eight rows then *and N more*, the paid jobs as one folded line (*20 paid jobs, $… all in*), and the
foot *Show all 21 in Pieces ›* (*See them in Pieces ›* while the table already draws them), *drawn
there as not in Gun Dog*, which turns the spike's toggle on and goes to the Pieces card. The hover
mechanics the tiles had moved to `useHoverCards.ts`, and both use it: a beat before the card shows, a
beat after the pointer leaves so it can cross into the card, a press pins it (the chip tinted blue),
Escape or a press elsewhere closes, a second press lets go; on a phone the press opens the card as a
sheet at the end of the line, closed by its ×. Walked on the real site at 1400 in dark and light (the
jobs card: one working row and the paid fold; the bids card pinned: thirteen archived, eight rows and
*and 5 more*; Escape; the foot drawing the 21 in Pieces with their *not in Gun Dog* chips and landing
on the card) and at 375 (the tap, the sheet, no sideways scroll). Left as the mock-up said: a site
with two spellings of the address lists both under one head, and the cap of eight is the tiles' cap.

**The two tile lines that wrapped (the owner's next ask).** With a screenshot of the five tiles at his
width, where *on the estimators or Dispatch* under *Nothing* and *nothing billed is unpaid* under *$0*
each ran to a second line: *"I want to make these two wrapping sentances a little shorter"* / *"make
it"* / *"on the office"* / *"and"* / *"nothing unpaid"*. Straight in, the two tile lines only: the
Waiting tile reads *Nothing · on the office*, the Open on bills tile *$0 · nothing unpaid*; the
Waiting card's *Payments · nothing billed is unpaid* group state is the card's own and stays.

**A history for the site (the owner's next ask).** *"I think the only thing we are missing now is a
history of plans and history of updates on a job. I would like some way to see the customer and job
notes and hitory all in one section. history is something new where we can write about events and
leave ourselves notes of things at speciific times and dates like an email came in we want to
memorialise to make following a job easier. this will need to be able to be accessed via MCP. Can you
help me mock up how this could look?"* What the page keeps today: the What changed card draws a
dated line for everything a record did (sends, outcomes, plan filings from `bid_changes`, stage moves,
bills, payments, the job's thread notes, the questions). What it cannot: a note on the site or the
customer has no home (a job's notes are `jobs_ledger_thread_notes`, a bid's `estimates_thread_notes`,
the customer's terms two fields), a plan filing says nothing of what it replaced, and nothing lets a
person write an event down at the time it happened (a thread note is stamped when typed). The job's
`job_activity_events` is a machine log (edge functions and triggers write it), not a place to write.
Mock-up first ([`history-mockup.html`](./history-mockup.html)): **A** one stream, the What changed card
becomes *History*: its record lines plus what people wrote (the job and bid notes, a note on the
customer or the site) plus *entries* (what happened, when, about which piece, from what source), a
composer at the top (*What happened* · About · When · the Source chips Email / Call / Text / On site
/ Letter / Note · *Keep it*), chips that narrow by kind (*Plans* alone is the history of plans) or by
piece (*JP1098 only*, set from a Pieces row's *history ›* door), entries on their own tint, a robot's
line marked *via MCP*; **B** two cards, What changed as it is and a History card for what people
wrote; **C** no new card, each Pieces row unfolds its own history with a composer. The pass recommends
A (one question, one answer; the two histories he named are two presses). The record: one new table
(`development_id`, at most one of `job_id` / `bid_id` / `customer_id`, `happened_at`, `source`,
`body`, `author_user_id`, `via`, `agent_label`, `created_at`, optional `link_url` / `file_path`),
never updated; the thread notes stay where they are and are read into the stream. Through MCP: the
dev seat's write pair `plan_history_entry` / `apply_history_entry` and a `get_history` read that
returns the same stream the page draws, so a robot and a person never see two histories. Waiting on
his pick, and on four calls the draft leaves open: whether a kept line can ever be struck (drawn as
never, with a second line that says so), whether the email itself attaches, whether a job's entries
also show in its Activity box, and whether a bid's twin may write.
**His pick, verbatim: *"Build A"*.** And mid-build: *"in the history section I want to see all the
job, bid, and customer comments along side it"*. Built, the page side in full, with the entries kept
on this device until the PR brings the table and the MCP verbs (the spike makes no migration): the
What changed card is *History* (the strip's look 1 too); its stream (`whatChanged.ts`) now holds the
job's thread notes as before, the bid's thread notes (`estimates_thread_notes`), the customers'
contact log (`customer_contacts`, the Customers page's dated comments, a day each, for the site's
customer and the GC), the plan filings numbered on their bid (*New plans · set 1*, *Plans again · set
2 · replaces set 1 of Oct 3*), and the entries (`history.ts`: `entryLine`); the undated notes the
records carry (a bid's notes, a job's collections note, the customer's payment-terms and lien-notice
notes) sit in an *On record* block under the chips (`onRecordNotes`), each with its door, since a
dated stream has no honest place for a note with no date. The composer
(`DevelopmentHistoryTools.tsx`): *What happened*, About (the site, each job, each bid, the
customer), When (now, or set back; a `datetime-local` box in the device's own time), the Source chips
Email / Call / Text / On site / Letter / Note, *Keep it* (dead until the words are there and the time
has come; Cmd-Enter keeps too), the flash *Kept · it reads at the top*, and the hint *Kept lines never
change. To correct one, keep a second line that says so.* An entry draws on its own tint with its
source's glyph (amber for what happened, the note's grey for a note), its time at the line's end, and
a robot's line would carry *via MCP* (`ChangeLine.via`, no writer yet). The chips: Everything · What
people wrote · What happened · Plans · Stages · Money · Questions; a Pieces row's *history ›* door
narrows to that piece, the bid and the job it became (*JP583 only ×*), opens the look and lands on
it. With nothing new the card stays one line and its header gains *Write ›*, which opens the
composer. Walked on the real site at 1400 in dark and light and at 375: a test line kept at 9:12 with
Email as its source read at the top with its time and tint and sat in the device store with `via:
app`; *What happened* narrowed to it, *What people wrote* to 63 of 105, *Plans* to 0 (this site's
filings are not in `bid_changes`); the door on the first row narrowed to 22 lines about JP583 and
scrolled the card into view; the × cleared it; the test line was removed afterwards. Two fixes from
the walk: an entry's time in the 52 px day column ran into the badge, so it moved to the line's end;
and the tinted row's negative margin widened every card at 375 (the looks are grid items), so
`.developmentCard` has `min-width: 0`. The four calls still wait: striking a kept line (never, for
now), attaching the email, the job's Activity box, the twin.


**Where it ships.** Its own PR between PR 2 and PR 3, as the lead leans: it is one surface (the
Pieces card), one column, no migration, with a help guide of its own (*pair a bid with the job it
became*), and it should not wait on PR 3's *Put the N in* nor hold PR 2's page.

## What PR 2 should take from the spike

- The kernels as they stand (`overview.ts`, `pieces.ts`, `whatChanged.ts`, `plans.ts`,
  `sinceYouLooked.ts`), each with a unit test beside it (none written in the spike), and the fetch
  with its address search; the *off the board* status; the same-minute stage fold and the short-note
  rule from findings 4 and 5; the Plans line's date rule from finding 6; the schedule as the *on site*
  source from finding 7.
- The page, the strip, the Pieces table and cards, the feed with the since line, the two doors, the
  route, `?development=<id>` on both boards, the GC Review and Settings doors, a dynamic search finder
  for developments by name.
- The toggle goes when PR 3's press lands, or stays as the preview before the press.
- The Ask and *Put the N in* stay stubs until PR 3 and PR 4; the house lines gain the pulse when the
  page's reads are shared with the windows (a small hook over the requests and the newest plan date).
- The docs owed by the README's PR 2 row: the guide *see everything on a development in one place*,
  `APP_DIRECTORY.md`, `PROJECT_DOCUMENTATION.md`, `ACCESS_CONTROL.md`, the release note and fragment.
