# Development page — design spike (punch list #208, 2026-10-28)

A working prototype of draft 3's Development page, filled with the real site (the one the owner
named, 13 bids and 30 jobs at one address, 9 of the jobs tagged and no bid), so the owner can walk it
before PR 2 is cut and we learn what to add and what he likes. The spike ships nothing: no PR, no
release note, no migration. This note names the real site and never its customer, GC, people or
amounts; the screenshots show them, so they live outside the repo (the session's shared notes
folder), not here.

## Where it is

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
and **Not these**; an unpaired job's Bid cell reads *no bid here ·* the likely bid with its chip
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
