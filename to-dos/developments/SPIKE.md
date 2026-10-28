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

Left for the walk. Fill in under *likes*, *does not like*, *asked for*; keep the words his.

- likes:
- does not like:
- asked for:

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
