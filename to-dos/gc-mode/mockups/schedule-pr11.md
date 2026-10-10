---
name: "The schedule's PR 11: the what-if copy on real data"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 11, decision 6 and the what-if table; mockups/G-81.md (the prototype's design); GANTT_FEATURES.md G-81, G-37, G-82, G-39, G-40
branch: the plan on claude/gc-schedule-pr11-plan (from origin/spike/gc-mode at dcd82a074); the code from origin/main in one cut, no migration
status: plan 2026-10-10 by gc 4 at the lead's ask. Amendment 1 (2026-10-10): gc 10, holding Schedule, co-signed all eight calls at their picks, and call 2's three conditions are written in. For the lead's read-back. Nothing cut or claimed.
---

# The schedule's PR 11: the what-if copy on real data

## What it is

G-81: a copy of the whole schedule to try moves on, beside the real one, never told to anyone, then **kept** as real
moves with their reasons or **thrown away**. Everything under it is already on main, and nothing draws it:

| Piece | On main | From |
|---|---|---|
| `gc_schedule_what_ifs`, one copy per person per job, its policy the person's own | applied | PR 4 (`20261007235500`) |
| `gc_schedule_keep_what_if`: the moves as real moves with `from_what_if_on`, the bars, the copy deleted, one version | applied | PR 5 (`20261008040000:691`) |
| The read (`loadSchedule` reads the reader's own copy, `whatIfOf` in `rows.ts`) | built | PR 6 |
| The io: `startWhatIf`, `tryInWhatIf`, `throwAwayWhatIf`, `keepScheduleWhatIf` | built, never called | PR 6 |
| The kernels: `whatIfCopy`, `whatIfProject`, `whatIfTried`, `whatIfBaseChanges`, `whatIfBaseChangedWords`, `whatIfGhosts`, `keepWhatIf` | lifted word for word | PR 1a |
| The chart's ghosts (`GcGantt`'s `real`) and its toolbar slot (`toolbarExtra`) | built, never fed | PR 7a |
| The record of moves marks a kept move *Tried in a what-if first.* (`moveRows`) | built | PR 1a |

PR 11 is the screen: the way in and out, the copy's own presses, the line over the chart, and the Keep window. One cut,
no migration, behind the window's dev gate and `moves` (whoever may move a bar), as 9a to 9d and PR 16 were.

## The calls

**Co-signed by gc 10, as Schedule's holder, at their picks (amendment 1); each with the other way:**

1. **No migration, and no new read of the board's tables.** The table, the keep function and the io are PR 4's, 5's
   and 6's. `gc_schedule_keep_what_if` reads none of `gc_projects`, `gc_trade_packages`, `gc_scope_items` or
   `gc_invites` (Building's door, call 9), so the door owes it nothing. The copy's three plain writes go through the
   copy's own policy, which PR 10 (#5231) keeps the person's own (`team AND user_id = auth.uid()`). *Other way:* none
   needed.
2. **What a copy takes: the moves, and only the moves.** In the copy:
   - a bar dragged, an end pulled, a wait drawn or taken off, and the bar's form (dates, waits, the gap, *Not before*,
     *Must finish by*), each through *Why it moved*;
   - a part of a split line dragged (G-39);
   - **Pull the work earlier** (G-37) and **Days back** (G-82), each a move with its own reason;
   - Undo and Redo on the copy's own record of moves (G-40).

   Not in the copy: the walk, the real days, an inspection passed or failed, the job's own work put on, done or taken
   off, the dates to meet, what the work waits on, places, a split or a join, a new baseline, Ask for the days, Print
   or PDF and Export. Their cards and buttons are hidden while the copy is shown.

   Why the line falls there: Keep (`gc_schedule_keep_what_if`) carries moves and the bars they leave, and nothing else.
   A split, a baseline or an added bar tried in a copy would be lost at Keep. The rest records what happened, so it
   belongs to the real schedule. Pull earlier and Days back are moves, so Keep carries them; G-81's design names the
   pull, and the prototype's reducer takes both (`WHAT_IF_ACTIONS`). *Other way:* the moves and undo only, with the
   pull and days back left for later. That is smaller by about ten lines, and leaves the two offers that most need
   trying.

   gc 10's three conditions on the pull and days back in the copy (amendment 1):
   - **The same gate.** They show only with `canPull` (a dev until Building's door), as on the real chart. The copy's
     Days back also needs `lateFinish(state, copy).late > 0`, so a copy whose moves already bring the finish in shows
     no card.
   - **Trying words on both windows.** `GcPullWindow` and `GcRecoveryWindow` take `trying`, as `GcMoveExplain` does:
     - their footer *Saved as one move by {by}, today. Undo puts every date back.* reads *Tried in the what-if. Keep
       puts it on the real schedule.*;
     - the pull's button reads *Try pulling {n} earlier* where it reads *Pull {n} earlier*;
     - their render tests run the new words through `plainWordsFailures`;
     - no `onSaved` in the copy, since the walk is not there.

     Their reasons are filled in already: the pull's is `early` with the finished sentences, and Days back's is
     `recovery` with the offer's note. Both are listed reasons with notes of 8 letters or more, so Keep never asks for a
     reason on these two.
   - **Keep keeps their fields.** `keepWhatIf` keeps `pull` and `recovery` on each kept move, `moveForRpc` sends them
     as `pullFinished` and `recovery`, and `gc_schedule_keep_what_if` writes each through `gc_schedule_save_move`, the
     same writer as a real move. So `pull_finished` and `recovery_how`, `after`, `gap_was` and `gap` survive Keep, and a
     kept days back's Undo puts the gap back. Pinned twice (Tests).
3. **The copy's presses are their own, never the real save** (gc 10's seam). `MovePresses.save` answers the saved
   move's id (9d), and a move in a copy is not a `gc_schedule_moves` row until Keep. So `GcSchedule` gets `copyPresses`:
   - `start`: `whatIfCopy(project, by, today)` through `startWhatIf` with the version this window read;
   - `save`: the move and the bars it leaves, laid on the copy by the new kernel `tryInCopy` and written whole through
     `tryInWhatIf`; it has `ScheduleSave`'s shape and answers null, so *Why it moved*, Pull earlier and Days back take it
     unchanged;
   - `undo` and `redo`: `undoMove` and `redoMove` on `whatIfProject(project)`, written through `tryInWhatIf`;
   - `throwAway`: `throwAwayWhatIf`;
   - `keep`: below.

   Each reads the schedule again after it writes, as every press does. *Other way:* a `copy` flag on `MovePresses`,
   which puts the copy one wrong branch away from a real write.
4. **Why it moved is optional in the copy.** `GcMoveExplain` gets `trying`. It reads *Try moving* where it reads
   *Move*, says *In the what-if, a reason is optional. Keep asks for one.*, and saves with a reason when one is given
   whole. Without one, the move keeps `WHAT_IF_NO_WHY` and is marked `noWhy`, as the prototype's reducer does. The
   Keep window asks for each one missing. *Other way:* a reason on every try, which turns trying into paperwork.
5. **Keep sends the version this window read, and the copy's own rule stays the kernel's** (decision 6). The press:
   - `keepWhatIf(project, whys, by, today)` first;
   - its problem shown in the window when it refuses: no reason yet on a move, nothing tried, or the base changed
     (`whatIfBaseChangedWords`, with *Throw it away* beside it);
   - otherwise `keepScheduleWhatIf` with the log line `whatIfKeepWords`: *Robert Douglas kept a what-if on Fair Oaks
     D: 2 moves, each with its reason.*

   A refusal for the version alone reads the schedule again and leaves the window open. If the copy's base still
   holds, the next press keeps it, as decision 6 says. The server does not check the base again: PR 5 left that rule
   to the kernel, and the version check stops a stale press. *Other way:* a server-side base check, which is PR 5's
   SQL to reopen.
6. **While the copy is shown, the window reads the copy** (`whatIfProject`). The measures, the chart, the bar's form,
   the call list and the record of moves all read it. The real dates show as the chart's dashed ghosts
   (`whatIfGhosts` into `real`). The toolbar's slot holds the way in and out: *What if…*, *What if · 2*, or *See the
   real schedule*. The copy stays open across a reload and on a second device, since it is stored. Leaving it only
   hides it. *Other way:* the copy in its own window, which loses the chart the moves are tried on.
7. **No dollar in the copy but the money team's, from the money state** (16c's rule).
   - The copy's measures carry no late fee: their state is the chart's.
   - The line over the chart says what the copy does to the bills only for the money team: `billingOf` on the copy's
     bars against the real ones. 16c's `planBillingShift` on the money state already compares exactly that.
   - Pull earlier and Days back in the copy get no `billingOf`. Their plan is the copy's, and the money state's
     schedule is the real one, so their Billing line would compare the wrong two.
   - `whatIfDiff`'s billing half stays on the spike. Its words move to main as `whatIfLineWords`, with no dollar.

   *Other way:* none that keeps 16c's rule.
8. **The kept line and Tell the trades wait for PR 13.** The prototype's `GcWhatIfKept` names the companies not told
   yet and opens Tell the trades, which is PR 13's `gc-tell-trades`. Until then the Keep window says *These moves go
   on the real schedule, oldest first, each with its reason.* It does not mention telling. The record of moves marks
   each kept move *Tried in a what-if first.* as today. *Other way:* the line with no button, naming companies nobody
   can tell from here.

## The files

- **`src/lib/gc/schedule/whatIfWindow.ts`** (new, the window's own; `whatIf.ts` stays word for word):
  - `tryInCopy(project, move, activities)`: the copy with the bars as the move left them and the move on its record,
    newest first. Null: no copy.
  - `copyUndone(project, moveId, by, today)` and `copyRedone(project, moveId)`: `undoMove` and `redoMove` on
    `whatIfProject`, as the copy. Null: nothing to undo or redo.
  - `whatIfLineWords(project)`: the prototype's `whatIfDiff` without its billing half (moves tried, those with no reason,
    the bars that differ, the finish against the real one, the line's sentences).
  - `whatIfKeepWords(project, kept, by)`: the log line.
- **`src/components/gc/GcWhatIf.tsx`** (new), the prototype's screen on real presses:
  - `GcWhatIfButton`, the way in and out;
  - `GcWhatIfLine` over the chart, with *Keep the moves…*, *Throw it away* (asked once) and *See the real schedule*;
  - `GcWhatIfKeep`, the window Keep goes through: each move oldest first, a reason asked for each with none, the
    finish, and the kernel's problem in words.
- **`GcScheduleMoves.tsx`**: `GcMoveExplain`'s `trying` (call 4).
- **`GcSchedule.tsx`**:
  - `copyPresses` beside `moves`, built only with `moves`;
  - `ScheduleView` gets `shown` and `onShow`, reads `whatIfProject` while shown, and hides call 2's cards;
  - `real={whatIfGhosts(...)}` and `toolbarExtra`;
  - no `print` in the copy.
- **`GcActivityEditor.tsx`**: in the copy, no `onActual`, `place`, `extra` or `check`. Its header's *the what-if copy
  comes with PR 11* is amended.
- **`GcScheduleMoves.tsx`**'s header line about PR 11 is amended. `GcMoveHistory` takes the copy's undo and redo
  unchanged.

## Tests

- **`whatIfWindow.test.ts`**:
  - `tryInCopy` with and without a reason: the stand-in and `noWhy`, the bars, newest first;
  - the real schedule untouched;
  - undo and redo in the copy;
  - `whatIfLineWords` against the prototype's `whatIfDiff` words on the same rows, the bills sentence aside;
  - `whatIfKeepWords`.
- **`GcWhatIf.render.test.tsx`**:
  - the button's three looks;
  - Throw it away asks once, then calls `throwAwayWhatIf`;
  - Keep:
    - waits for each missing reason;
    - shows the base-changed words with Throw it away;
    - calls `keepScheduleWhatIf` with the version read and the kernel's moves, oldest first;
    - on a version refusal, reads again and stays open.
- **`GcSchedule.whatIf.render.test.tsx`**:
  - a dev makes a copy (`startWhatIf` with the version read);
  - a drag in the copy opens *Try moving*, saves with no reason, and calls `tryInWhatIf`, never `saveScheduleMove`;
  - the walk, the waits, places, own work, milestones, the baseline, Ask and Print are hidden in the copy;
  - Pull earlier in the copy saves to the copy;
  - the ghosts reach the chart;
  - someone without `moves` sees no button;
  - the money team's line has the bills sentence, and anyone else's has none.
- **`GcScheduleMoves.render.test.tsx`**: `trying`'s words and its save with no reason.
- **`GcPullEarlier.render.test.tsx`** and **`GcRecovery.render.test.tsx`**: `trying`'s button and footer words, through
  `plainWordsFailures`, and no `onSaved` (amendment 1).
- **Keep keeps the pull's and days back's fields** (amendment 1):
  - `GcWhatIf.render.test.tsx`: a copy holding a pull and a side-by-side days back. Keep's payload to
    `keepScheduleWhatIf` carries `pull` and `recovery` on its moves, through `moveForRpc`.
  - `supabase/tests/gc_schedule/20_scenario.sql`: one case at the end of the file, so no earlier count moves. A copy
    holding a side-by-side days back is kept. Undo on the real schedule reads the gap back as `gap_was`, and the kept
    pull keeps its `pull_finished`. It is a test file only, so PR 11 still has no migration; the SQL beds workflow runs
    it on the PR.

## Docs

- A new guide, *try moves on a copy of the schedule* (`try-moves-on-a-copy-of-the-schedule.md`),
  category Bids & Estimating like the other schedule guides, linked from *move a bar on the schedule and say why*.
- `PROJECT_DOCUMENTATION.md`'s Schedule paragraph.
- `GLOSSARY.md`: a *What-if copy* entry beside *Walk · pull · days got back*.
- The release note and its fragment.
- `SCHEDULE_REAL_BUILD.md`'s PR 11 marked done after it merges.

## Seams

- **PR 10 (#5231)**: it meets PR 11 in `GcSchedule.tsx`'s props and header and in the window's `printFiling`. Its
  policy swap keeps the copy the person's own. Whichever lands second rebases.
- **PR 13**: the kept line and Tell the trades (call 8).
- **16c**: the copy's bills sentence reads 16c's `billingOf` (call 7).
- **The twin fence**: `gc_schedule_what_ifs` has the digital-twin and read-only write blocks from PR 4, so a twin or a
  user in training mode cannot make a copy. Their refusal shows in the line's words.

## The check (as a dev, on "GC test project, delete me")

1. Make a copy.
2. Drag the plumbing rough-in a week with no reason, then pull an end with a reason.
3. See the ghosts, and the line's finish against the real one.
4. Undo the second move, then Redo it.
5. Open Keep: the first move asks for a reason. Give it one and keep. Both moves show in the record, *Tried in a what-if
   first.*
6. Make a second copy, and from another browser move a bar on the real schedule. Keep is refused with that bar's name,
   and Throw it away clears it.

## Is this the best we can do?

- Every rule was already lifted and tested. PR 11 draws them and adds only the copy's own presses.
- The copy never reaches a real write by accident: its presses are a separate set (call 3).
- What Keep cannot carry is not offered in the copy (call 2).
- What it does not do:
  - a shared copy, the plan's *later*;
  - a server-side base check (call 5);
  - the kept line with Tell the trades, PR 13's.

## Status

Plan 2026-10-10, gc 4. Amendment 1 the same day: gc 10 co-signed the eight calls at their picks, with call 2's
three conditions written in. For the lead's read-back. Nothing cut or claimed.
