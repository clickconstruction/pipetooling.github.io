---
name: "The type check in parts: three programs are built; left, the peak on every CI run and the app program itself"
number: 434
group: ready
status: measured 2026-11-24 on a GitHub runner and a dev Mac · the whole program needs 12.0 to 12.3 GB and grows about 190 MB a day · v2.8482 sized the heap from the machine · PR 1 built the same day (v2.8505): npm run typecheck runs three programs, the largest 8.6 GB, and the build checks the app part alone · left: PR 2 and PR 3
summary: >
  One tsc over all of src needed 12.3 GB of heap on 2026-11-24 and grew about 190 MB a day, and a
  GitHub runner can give about 13.3 GB. Since v2.8505 the check runs the same files as three
  programs by plain include lists, which need 8.1, 6.5 and 8.6 GB, with no project references.
  That leaves a runner about 4.7 GB over the largest part, four to five weeks at today's pace.
  Left: print the peak on every CI run so the next wall is seen coming, and cut the app program
  itself. This card holds the numbers, the plan and the measuring script.
next: Build PR 2 below, the peak printed on every CI run with a warning near the cap, so the next wall shows weeks ahead. Then measure the app program with a trace before choosing PR 3's way.
size: M as a train of three (M · S · L); left: PR 2 (S) and PR 3 (L)
blocker: none
ver: v2.8482 · 8505
opinion: build — PR 2 is small and turns the next wall from a surprise into a line in the log; PR 3 can wait for its numbers
mockup: not required — build tooling, no screen
---

# The type check in parts (#434)

## The ask

From the session brief of 2026-11-24: *the whole-program typecheck now peaks at the heap cap itself.
Measure how much headroom is left, on CI and on a dev Mac, and ship the smallest change that gives it
room.* And for a real cut in what one tsc holds: *do not build it in this session: write the numbers
and the plan into a punch-list card.*

The smallest change shipped as v2.8482. Its fragment, `docs/recent-features/v2.8482.md`, has every
run. This card is the real cut. Its first PR shipped as v2.8505, and
`docs/recent-features/v2.8505.md` has what the three programs measured once built.

## Where it stands

- **The whole program needs 12.0 to 12.3 GB** on main at 20e3f849e (v2.8442): 21,677 files,
  2,624,994 lines of TypeScript, 31.4 million instantiations. With room and a collection forced at
  the end it holds 12,334 MB.
- **Under the old fixed 12,288 MB it had no room.** A cold `tsc -p` died of heap on a runner and on a
  48 GB Mac. The deploy's cold `tsc -b` passed with 12,060 MB live, collecting back to back.
- **v2.8482 gives a 15,700 MB runner 13,312 MB** and a big Mac 16,384 MB. For one program that was
  about 1.0 to 1.3 GB of room on a runner.
- **A runner has little more to give.** Its other processes hold 1,000 to 1,250 MB and tsc holds about
  265 MB over its cap, so about 14,100 MB is the most a cap could ever be there.
- **It grows about 190 MB a day.** About 10,050 MB on 2026-11-13, about 12,200 MB on 2026-11-24. Six
  days added 881 merges and about 222,000 lines under `src`. Each line costs about 4.7 KB of heap.
- **As one program, a runner's room lasted five to seven days.** After that the deploy's cold
  `tsc -b` would have died, and so would the check of any pull request that changes the lockfile,
  a tsconfig or the eslint config.
- **PR 1 is built (v2.8505).** `npm run typecheck` runs three programs. On a runner the three took
  11:42 cold and 0:38 warm and peaked at 9,482 MB resident, all clean. The largest part holds
  8,607 MB at the end, which leaves a 13,312 MB cap about 4.7 GB. The build's `tsc -b` checks the
  app part alone: 5:05 cold and 8,813 MB resident, against about 10 minutes and 12,536 MB.
- **That is four to five weeks, not a year.** The largest part is 70% of the whole, so it grows
  perhaps 130 MB a day. PR 2 and PR 3 are what is left.

## What was measured for the cut

On a runner (ubuntu-latest, Node 20, TypeScript 5.6.3), cold, cap 14,336 MB, a collection forced at
the end with `--expose-gc`. MB are V8's.

| Program | Files | Lines | Instantiations | In use at the end | Peak resident | Wall |
|---|---|---|---|---|---|---|
| the whole of `src`, as today | 21,677 | 2,624,994 | 31.4 M | 12,334 | 12,606 | 7:17 |
| `src` without `*.test.ts` and `*.test.tsx` | 15,539 | 1,748,658 | 29.5 M | 8,072 | 9,061 | 5:02 |
| the tests under `src/lib` and what they import | 9,647 | 1,341,199 | 12.4 M | 6,524 | 7,133 | 1:22 |
| the tests outside `src/lib` and what they import | 10,344 | 1,815,560 | 27.8 M | 8,578 | 9,085 | 6:37 |
| the whole of `src`, `incremental` off, cap 12,288 | 21,677 | 2,624,994 | 31.4 M | 12,305 | 12,470 | 12:21 |

What this says:

- **Three programs by plain `include` lists fit.** The largest needs 8.6 GB against 12.3 GB whole.
  That is 3.7 GB under the old cap, about three weeks of growth for that part, and the test parts
  can be cut again the same way.
- **No project references are needed for PR 1.** A program is its `include` list and everything that
  list imports. App code that tests import is checked again in the test programs, which costs time
  and not correctness.
- **The cost is time.** Cold, the three take 13 minutes one after the other against 7 for the whole
  with room. Warm, each is seconds.
- **Turning `incremental` off saves nothing** (12,305 against 12,334).
- **The weight is in the app, not the tests.** The app without tests is 29.5 of the 31.4 million
  instantiations. The `src/lib` tests and what they import are 12.4 million and check in 68 seconds.
  The tests outside `src/lib` pull in the components and pages and take 372 seconds.
- **The tests-outside-lib program printed `error TS` lines** the whole program does not. PR 1 found
  them: `window.__lens` was declared with a `declare global` inside `src/lib/lens/seal.ts`, a module
  that program did not load. It moved to `src/lib/lens/lensWindow.d.ts`, each test program takes
  every `.d.ts` under `src`, and a test refuses the next one.
- **A two-program split was measured and not taken.** The app and the tests outside `src/lib` as one
  program, beside the `src/lib` tests, is two minutes quicker cold (7:50 and 1:52 against 11:42 in
  all) but its larger program holds 9,384 MB, 0.8 GB more than the largest of three.

## The plan

**PR 1 (M): three programs behind the same two commands. Built, v2.8505.** What CI checks did not
change: every file under `src` is still checked, by `npm run typecheck`. As built:

- Three configs that extend `tsconfig.json`, each with its own `tsBuildInfoFile` under
  `.cache/typecheck/`: the app (`src` without tests), the tests under `src/lib`, the tests elsewhere.
  `tsconfig.json` stays the whole program for editors.
- `scripts/typecheck-queued.mjs` runs the three one after the other under the one lock, through
  `scripts/lib/runTsc.mjs`, and keeps going past a part that fails so every part's errors print. The
  exit code is the worst part's.
- A unit test holds that every `.ts` and `.tsx` file under `src` is in at least one of the three
  `include` sets, so a new folder cannot fall outside the check.
- The build's `scripts/tsc-build.mjs` checks the app program alone. The tests do not ship, and the
  merge queue's `checks` job has already checked them.
- `warm-caches.yml` and `ci.yml` cache `.cache` whole, so the three build-info files ride the one
  cache. The key's `hashFiles` list in both takes the three config files, and
  `scripts/check-workflow-parity.mjs` holds the two keys equal.
- `npm run typecheck:config` and the lint of the config files (#9621) are untouched.
- Measured with the script below on a throwaway branch: each part's peak, cold and warm.

**PR 2 (S): the peak on every CI run.** The owner's decision 3 of v2.7134, still open in
`to-dos/owner-decisions-pending.md`. `runTsc.mjs` already prints the cap. Add `--extendedDiagnostics`'
*Memory used* line, or the peak resident size, to each part's last line in CI, and fail a part that
ends within 10% of its cap with words that point here. Then the next wall is seen weeks ahead.

**PR 3 (L): the app program itself.** It is 8.1 GB today and grows with the app, so PR 1 buys it
about three weeks at today's pace, not a year. Two ways, measure before choosing:

- **Find what is heavy.** `tsc -p <app config> --generateTrace <dir>` names the files and types that
  cost the most. The comment at `src/components/jobs/legal/useLegalPacketData.ts:59` already names
  one shape: typed query builders against the full `Database` type. A handful of such shapes may hold
  most of the 29.5 million instantiations.
- **Project references.** `src/lib` as a composite project that emits declarations, and the
  components and pages reading those declarations. This is the only cut that stops the app's own
  growth from landing in one heap. It needs every exported type in `src/lib` to be nameable, which
  is a sweep.

Also still open from v2.7134, the owner's decision 1: drop the deploy's `tsc -b`, since the merge
queue has checked the same content. PR 1 makes it the app program alone, which is the smaller ask.

## How to measure again

The 2026-11-24 runs came from a throwaway branch, deleted after. Push a branch named
`measure/<anything>` holding a workflow that triggers on `push` to that branch alone, runs
`actions/checkout`, `actions/setup-node` with Node 20, `npm ci`, and then this script once per job:

```bash
#!/usr/bin/env bash
# usage: measure.sh <capMB> <tsc args...>
cap="$1"; shift
set +e
/usr/bin/time -v -o time.log node --trace-gc ${EXPOSE_GC:+--expose-gc} "--max-old-space-size=${cap}" \
  node_modules/typescript/bin/tsc "$@" --extendedDiagnostics > tsc.log 2> err.log
echo "== exit code: $? (cap ${cap} MB)"
grep -v -E ' ms: (Scavenge|Mark-Compact|Minor)' tsc.log | tail -60
tail -40 err.log
grep -E 'Maximum resident|Elapsed|Swaps' time.log
grep -E ' ms: Mark-Compact' tsc.log | awk '{ for (i = 1; i <= NF; i++) if ($i == "->") { b = $(i-2) + 0; a = $(i+1) + 0; if (b > mb) mb = b; if (a > ma) ma = a } n++ } END { printf "full collections=%d largest before=%.1f largest left after=%.1f MB\n", n, mb, ma }'
free -m
exit 0
```

- **Read the job's log while the run is still going** with
  `gh api repos/<owner>/<repo>/actions/jobs/<job id>/logs`. `gh run view --log` answers nothing until
  the whole run ends.
- **The number that matters is what is left after a full collection**, not the peak resident size.
  V8 lets the heap fill to its cap before it works hard, so the peak sits at the cap whether the
  program needs it or not.
- **With `EXPOSE_GC=1`** tsc forces a collection before it prints *Memory used*, so that line is the
  heap in use at the end.
- **For an old build-info file**, `git restore --source=<old sha> --worktree -- src`, run tsc once,
  then `git restore --source=HEAD --worktree -- src` and measure. Files deleted since stay behind as
  untracked files and print errors of their own. They do not change the memory.
- **On a Mac**, measure under the machine-wide lock (`scripts/lib/typecheckLock.mjs`) with
  `/usr/bin/time -l`, one run at a time, never beside vitest.
