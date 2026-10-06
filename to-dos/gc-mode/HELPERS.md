# Helpers on the Gantt (2026-10-06)

Five helper sessions each take one open row of `GANTT_FEATURES.md`, one at a time. The lead
session, **GC spike punchlist**, reviews each piece, merges it into `spike/gc-mode`, and hands out
the next row. Nobody but the lead pushes to `spike/gc-mode`.

## Set up, once

1. In your own worktree: `git fetch origin spike/gc-mode && git checkout -b spike/g<NN> origin/spike/gc-mode`
   (`<NN>` is your G-number, so `spike/g37`).
2. No `node_modules`? `ln -s /Users/isiah/Documents/GitHub/pipetooling.github.io/.claude/worktrees/eager-khorana-3d8631/node_modules node_modules`.
3. No `.env.local`? Copy it from `/Users/isiah/Documents/GitHub/pipetooling.github.io/.claude/worktrees/eager-khorana-3d8631/.env.local`
   (pre-approved by the owner; never print it, never commit it).
4. Dev server on your own port, `npm run dev -- --port 53<NN> --strictPort` (Helper 1 → 5301, …
   Helper 5 → 5305), then open `/dev-login?as=1&to=/bids/gc`. The GC page is a big lazy chunk:
   wait about six seconds. Project tabs are reached by `[data-tour="gc-ptab-<key>"]`; the "Trades"
   button name collides with the Trades | GC mode switch.
5. Read, in this order: `HANDOFF.md`; `README.md` → *The model, in one paragraph* and *Working in
   parallel*; `GANTT_PLAN.md` (the phases, then every *as built* section, which is how the chart
   works today); your row in `GANTT_FEATURES.md`; `PUNCHLIST.md` → *Gotchas*.

## The rules that do not bend

- **The golden test** `src/lib/gcMode/gcModel.test.ts` pins the whole final state of the fixture.
  Never re-pin it (`-u`). If your feature needs the snapshot to move, write that in your report and
  stop at the kernel and its tests; the owner decides.
- **New logic goes in a new file**: `src/lib/gcMode/gc<Feature>.ts`, pure, with
  `gc<Feature>.test.ts`, out of the barrel. Shared files (`gcTypes.ts`, `gcModel.ts`, the reducer,
  `GcGantt.tsx`, the tour) take additions only: a new type, a new action, a new card, never a
  changed sentence someone else's test reads.
- **A new action type** goes in the golden test's `all` list, with a `used.add(...)` line naming
  the test file that plays it.
- **Theme tokens, not hexes** (`node scripts/theme-tokenize.mjs --check src/components/gc`).
- **Plain words** for anything a first-timer reads, a tour stop, a card's line, a Next line: one idea
  per sentence, none over 20 words, no dashes, semicolons or parentheses in a sentence
  (`src/lib/plainWords.ts`).
- **Commits carry the G-number**: `spike: GC mode G-37, pull work earlier on a press`. In the same
  commit, set your row's *Stands* in `GANTT_FEATURES.md` to *Have* with a date, and add a short
  *as built* section to `GANTT_PLAN.md` (what it does, the words, where it is in the UI, the tests).
- Tests: `VITE_SUPABASE_URL=http://x VITE_SUPABASE_ANON_KEY=x npx vitest run src/lib/gcMode src/components/gc`.
  Lint: `npx eslint <your files>`. Typecheck: `npm run typecheck` in the background; it takes 10 to
  25 minutes on a loaded machine; read its exit line. Run it on a quiet tree before you push.

## The way each piece is done

1. **Mockup and plan first**, in `to-dos/gc-mode/mockups/G-<NN>.md`: the screen as text or ASCII
   with the exact words a person reads; where it sits in the UI (which tab, which card, which tour
   stop); the kernel's inputs and outputs; the action, if one; the files you will touch; the tests
   you will write; what you are leaving out and why.
2. **Ask "is this the best we can do?"** at the end of that file: three ways it could be better,
   which you pick, and why. Think of the three jobs the chart has: See, Tell, Chase.
3. **Message the lead** (`GC spike punchlist`) with your branch, the mockup's path and a five-line
   summary. Wait for *go*. The lead may ask for changes first.
4. **Build it.** Tests, lint, theme check and typecheck green. Push `spike/g<NN>`. Message the lead:
   what it does, the commands you ran and their results, anything you left out.
5. **The lead reviews and merges**, then sends your next row. While you wait, do not start a row
   nobody assigned you.

## Assignments, round one

| Helper | Row | What it is |
|---|---|---|
| Helper 1 | G-37 | Pull work earlier when the work before it finishes early, on a press, never by itself |
| Helper 2 | G-21 | Print and PDF of the chart as it is filtered, on one or more landscape pages |
| Helper 3 | G-115 | By company as a call list: each company's late bars, unconfirmed dates and held work, with Call and Follow up |
| Helper 4 | G-117 | A trade tells us from its portal that it will be late, with a new day, before the day passes |
| Helper 5 | G-77 | A trade not ready to start (no signed statement of work, insurance run out): the bar says so before its start day |

Round two, in order: G-60, G-97, G-98, G-118, G-08.

## Assignments, round three (the owner's word, 2026-10-06: every *Later* row and every finding)

Each helper takes its rows in order, one at a time, the same five steps. The one that moves the
golden snapshots (the counts) goes last, by one helper, with the owner's OK to re-pin once.

| Helper | First | Then | Then |
|---|---|---|---|
| Helper 1 | G-81 what-if copy | G-39 split bars | the counts on the board row, Follow up and Needs you (re-pins the golden test once) |
| Helper 2 | G-45 a schedule while bidding | G-136 export | G-137 import, then G-44 templates |
| Helper 3 | G-82 how to get days back | G-57 weather and crew projection | G-141 Ask for the days |
| Helper 4 | G-140 the cash weeks follow the bars | the trade's own crew count from its portal | G-83 too many trades in one place |
| Helper 5 | G-138 running bars with lapsed insurance | G-139 one readiness list for both sides | G-84 people on site per week |

## Status

Round three landed the same day, 2026-10-06, every *Later* row and every finding the helpers raised:
G-138, G-140, G-139, G-45, G-82, G-142, G-81, G-136, G-84 (and G-144, the strip on the paper),
G-57, G-137 (with two of theirs as a line's parts), G-83 (with the place in the exported file and
back in), G-141, G-44, G-39 and the counts on the board row, Follow up and Needs you, the one
golden re-pin of the day (59 snapshots, every moved reading named in its commit). The GC suite
stands at 139 files and 1650 tests. Rows raised for the owner and not built: G-143 (a trade's
site-finish lines after the dry-in gate, not its trims), G-145 (dates to meet only, onto a running
job), G-146 (the call list's bar reasons counted on the row and the badge).

Rounds one and two landed on `spike/gc-mode` the same day, 2026-10-06, each row reviewed and merged by
the lead with the GC tests green and the golden test unmoved: G-77, G-117, G-115, G-60, G-21, G-97,
G-37, G-118, G-98 and G-08, then a fit-and-finish pass (the late-finish lines and the pull's ghost on
the paper, the billing shift in the pull window, the capitals in a merged hold sentence) and the G-59
row set to Have. Every row of `GANTT_FEATURES.md` with a phase number now stands Have. Round three
waits on the owner's word on the *Later* rows; the rows the helpers raised for the owner are G-138 to
G-141 and the snapshot-moving counts each mockup names under *Left out*.
