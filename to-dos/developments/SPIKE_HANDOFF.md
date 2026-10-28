# Development page spike — hand-off (punch list #208, 2026-10-28)

A design spike, not a release: a working prototype of the Development page the owner walks on the
dev server, filled with the real site. It ships nothing — no PR to `main`, no release note, no
migration. This file is how a second person, on another computer, picks it up and works on it with
the owner. The findings and every one of the owner's reactions, in his words, are in
[`SPIKE.md`](./SPIKE.md); the mock-ups that preceded each piece are beside it.

## The branch

- `claude/objective-williams-960014` on origin, twenty `spike(developments): …` commits on top of
  `7bf9dd335` (main as of the morning of 2026-10-28). `main` has moved since; the spike does not
  need it, so leave the rebase alone unless a merge is asked for.
- Everything the spike adds lives in: `src/pages/DevelopmentPage.tsx`, `src/lib/developments/`
  (`overview.ts`, `pieces.ts`, `whatChanged.ts`, `plans.ts`, `pairing.ts`, `pairingWrites.ts`,
  `backfillWrites.ts`, `chipWrites.ts`, `sinceYouLooked.ts`, `fetchDevelopmentPage.ts`),
  `src/components/developments/` (the strip, the feed, the Pieces table, the pair cells, the
  backfill sheet, the chip confirm, the shared bits), the route in `src/App.tsx`, the house-line
  doors in `BidPreviewModal.tsx` and `DetailJobModal.tsx` (+ `development_id` on
  `LimitedJobDetailSnapshot`), and two blocks at the end of `src/index.css`
  (`.developmentFoldButton`, `.developmentReviewStrip`).
- Spike-only, not for the PR as it stands: the `?all=1` / *Show the N here* toggle (PR 3's press
  replaces it), the Ask toast (PR 4), the *Put the N in* toast (PR 3), the page's own confirm
  window (the house `ConfirmDialog` takes a string).

## Run it

1. From the main checkout: `git fetch origin && git worktree add .claude/worktrees/<name> claude/objective-williams-960014`,
   then in the worktree `npm ci` and copy your own `.env.local` from your main checkout (the
   Supabase URL and anon key; never from someone else's machine).
2. Start the dev server with the app's preview (`.claude/launch.json` → `pipetooling-dev`); port
   5190 is often taken and Vite picks another. Sign in as the dev:
   `/dev-login?as=1&to=/developments/7d7b2580-3301-42bd-af10-85d75b941918?all=1`.
3. The mock-ups are static pages; the dev server serves them only from `public/__mockup/`, which is
   not tracked: `mkdir -p public/__mockup && cp to-dos/developments/*-mockup.html public/__mockup/`,
   then open `/__mockup/pairing-mockup.html` (and `backfill-`, `chips-`, `strip-`). Never stage
   `public/__mockup/`.
4. Desk width is 1400; phone is 375. The Browser pane screenshots only while it is on screen and
   painting; `get_page_text` / `read_page` / JS clicks work while it is hidden; headless Chrome
   stalls at the dev-login page.

## The site and the fixture

- The real site is development `7d7b2580-3301-42bd-af10-85d75b941918`. Nine jobs carry it; 13
  bids and 21 more jobs share its address and do not (the `?all=1` toggle draws them). **Nothing on
  the real site is pressed by Claude**: the pairing, backfill, chip and won writes are the owner's to
  press there, in his own pane.
- Writes are walked on the ZZ fixture only: development `be4449ca-64b4-4c42-8b89-21e0f0426989`
  holds bid B398 (`a5a3a840-0a7b-4c67-8b59-3e95d0d80150`) paired with job JP1085
  (`e7a353d8-5aad-4776-a609-500d1f60d274`) at 5501 Balcones Dr. Every walk so far left it as it was
  found: paired, in the development, the bid unarchived. Leave it that way.
- Reads for a survey go through dev-mcp `read_rows` (an `ilike` filter on `address` /
  `job_address`; `find_bid` / `find_job` return an unfiltered top 20 for a rare word). The dev-mcp
  catalog does not know `bids.development_id` until the types chore regenerates it.

## The owner's rules for this spike

1. **Mock-up first, then the pass, then the prototype.** For anything new he asks for: draw it two
   or three ways in a made-up-data HTML page beside the others (`to-dos/developments/*-mockup.html`,
   Harlow Ranch / Ridgeway Builders, the draft-3 tokens), write *Is this the best we can do?* under
   it with a recommendation, then build the recommended way. Small wording and sizing asks go
   straight in.
2. **His words, verbatim, into `SPIKE.md`** under the section the ask belongs to: what he likes, does
   not like, asked for, and the options offered beside the one he picked.
3. **Commit on the branch after each piece and push**; no PR, no release note, no `npm run claim`,
   no migration. Stage files by name; never `git add -A`; never `public/__mockup/`.
4. The repo is public: the note names *the real site* and its development, never its customer, GC,
   people or amounts; screenshots of the real page stay out of the repo (this Mac keeps them in the
   session's notes folder).
5. Typecheck after the last edit (`npm run typecheck`, grep the output for `error TS`; the piped
   exit code lies), eslint the files touched, `node scripts/theme-tokenize.mjs --check src`. The
   whole test suite has not been run on this branch.

## Where it stands (the last things he asked, all done)

The page, the pairing mode (a toggle; draft B in the row with the likely pairs as line items), the
backfill sheet and New Job from a bid, the two chips that act after a before-and-after confirm
window, the chips' words (*not in Gun Dog*, *archived*), the folding feed with the one-line state and
the reacting fold button, the feed search with the time on each match and the typed words lit, the
review strip (four numbered looks that tick as they are seen), the Pieces titles leading the rows,
one two-row shape for every gap cell with the four presses on the second row, right-aligned, small,
with the owner's words (*Pick the job…*, *New job from bid*, *Not a match*, *Pair JP956*) and the
column widths that let them fit.

## Open, for whoever is next

- The owner's reactions section in `SPIKE.md` holds what he said up to the gap cells' words; keep
  adding below it.
- Not verified: the review strip's tick-on-scroll under its final rule was seen once and then the
  pane stopped painting; the *archived* chip's press was never walked, since no fixture bid is both
  unsent and hidden from the board.
- Known rough edges, listed in `SPIKE.md` under each piece: the unpair toast outlives a re-pair; the
  won press has no confirm window; Tab does not close the picker sheet; a job from two bids has one
  link; the estimator on a backfilled bid should be a pick; a backfilled bid needs a mark on the Bid
  Board; the full-form link from the backfill sheet needs a New Bid prefill that does not exist.
- When the owner says the spike is done: the lead session's plan is PR 2 (the page) from fresh
  `main`, the pairing as its own PR between PR 2 and PR 3, then PR 3–6 as `README.md` lays them out;
  each with its release note, `docs/recent-features/` fragment and help guide. The kernels need unit
  tests beside them before any of it is cut.

## Working on it together

Two people on one branch: `git pull --rebase origin claude/objective-williams-960014` before each
piece, commit small and push after each, and keep to different files while the other is mid-piece;
the page file and the pair cells are where the asks land, so say which one you are in. A session
started from this file reports back in the words above; the owner talks to it directly in its pane.
