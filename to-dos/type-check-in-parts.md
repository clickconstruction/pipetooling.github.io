---
name: "The type check in parts: three programs and the memory line are built; left, the app program itself, which only project references cut"
number: 434
group: ready
status: measured 2026-11-24 on a GitHub runner and a dev Mac · the whole program needs 12.0 to 12.3 GB and grows about 190 MB a day · v2.8482 sized the heap from the machine · PR 1 built the same day (v2.8505): npm run typecheck runs three programs, the largest 8.6 GB, and the build checks the app part alone · PR 2 built 2026-11-27 (v2.8696, its line corrected in v2.8707): every tsc ends with a line on its memory and warns from four fifths of its cap · measured again 2026-11-27: the largest part peaks at 9.3 GB, 70% of a runner's cap; no short list of heavy files; the typed database client holds 80 MB; TypeScript 7 is five times as fast and no lighter · left: PR 3, whose way is not chosen
summary: >
  One tsc over all of src needed 12.3 GB of heap on 2026-11-24 and grew about 190 MB a day, and a
  GitHub runner can give about 13.3 GB. Since v2.8505 the check runs the same files as three
  programs by plain include lists, which need 8.1, 6.5 and 8.6 GB, with no project references.
  That leaves a runner about 4.7 GB over the largest part, four to five weeks at today's pace.
  Since v2.8696 every tsc ends with a line on its memory, and warns from four fifths of its cap.
  Left: cut the app program itself. Measured on 2026-11-27, nothing cheap cuts it: the memory follows
  the lines of code, so only fewer source files in one program does. This card holds the numbers,
  the plan and the measuring script.
next: Choose PR 3's way from *Measured 2026-11-27* below. The question went to Taunya's managing session that day with four ways: wait for the first NEAR ITS HEAP line, start project references by feature area now, take TypeScript 7 for its speed alone, or a larger runner. Until it is answered, read the deploy's build log for the app program's cold line on any merge.
size: M as a train of three (M · S · L); left: PR 3 (L)
blocker: none
ver: v2.8482 · 8505 · 8696 · 8707
opinion: decide — the numbers are in and no cheap way cuts memory; the largest part is at 70% of the cap and grew 26 to 67 MB a day over three days, so PR 3 can wait for the first NEAR ITS HEAP line, and not past it
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
  perhaps 130 MB a day. PR 3 is what is left.
- **PR 2 is built (v2.8696).** Every tsc that answers ends with one line: its time and the most it
  held resident, against its cap. Where tsc still held its program as it exited, the line also
  names the heap it ended holding after a collection, the number in the tables below. The build's
  `tsc -b` does; a part's `tsc -p` mostly does not, so its line is the peak alone (v2.8707). A run
  that held four fifths of its cap gets a `NEAR ITS HEAP` line and, on GitHub Actions, a warning on
  the run's page. Its exit code is tsc's.
- **On 2026-11-27 the largest part peaked at 9,337 MB cold**, 70% of a runner's 13,312 MB cap. The
  warning starts at 10,650 MB. The app program ended holding 7,995 MB on the deploy, against
  8,087 MB measured the same way on 2026-11-24.

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

## Measured 2026-11-27

All from the `typecheck-434` thread of that day's run. MB are V8's. *Peak* is the peak resident size.

**TypeScript 5.6.3, the three parts cold, on a GitHub runner** (15,983 MB, cap 13,568 MB; the peaks
are the new memory line's), against 2026-11-24:

| Part | Time | Peak | Peak on 11-24 | Grew in three days |
|---|---|---|---|---|
| app | 5:35 | 8,857 | 8,778 | 79 |
| tests-lib | 1:49 | 7,363 | 7,197 | 166 |
| tests-rest | 6:17 | 9,337 | 9,137 | 200 |

- All three took 13:41 and were clean.
- That is 26 to 67 MB a day, under the 130 MB a day this card assumed. Three days is a short line
  to read a pace from: those days added about 11,000 lines a day, where the six days before
  2026-11-24 added about 37,000 a day.
- **The deploy's `tsc -b` of the app part**, cold, on a 15,701 MB runner: 5:49, 7,995 MB held after
  a collection, 9,357 MB peak. The same measure read 8,087 MB on 2026-11-24.

**TypeScript 7.0.2, the same three parts, on the same size of runner** (4 cores):

| Part | Time | Peak | On one thread: time, peak |
|---|---|---|---|
| app | 1:04 to 1:06 | 10,103 to 10,464 | 1:46, 8,612 |
| tests-lib | 0:36 to 0:38 | 7,060 to 7,639 | not run |
| tests-rest | 1:06 to 1:10 | 10,571 to 10,971 | 1:59, 9,118 |

- **Five times as fast, and no lighter.** By default it holds 1.1 to 1.6 GB more than 5.6 on the
  two largest parts. On one thread it holds about the same and is three times as fast.
- It has no heap cap of its own. Its limit is the machine, and its default peak leaves a runner
  about 4 GB, the room 5.6 has under its cap.
- The repo's config does not run as it stands: `baseUrl` is removed and `paths` must start with
  `./`. Without `types` named it prints 61 errors of a missing `google` name.
- With those set: 7 errors in 6 files in the app and 15 in 10 files in the tests under `src/lib`,
  about 20 lines in about 14 files. About 14 are a `Uint8Array` handed to a `Blob` or a
  `BufferSource`, 2 are a `??` whose right side is never reached, 1 is an expression that is
  always nullish.
- `typescript-eslint` 8.74 accepts TypeScript under 6.1, so eslint and the tests that import the
  compiler's API would stay on 5.6.

**The app program traced** (`--generateTrace`, a dev Mac, alone under the lock; the counts in the
first line are the plain run's of the same day, since a trace adds to them):

- 15,972 files, 1,781,836 lines, 3.36 million types, 12.2 million symbols, 29.8 million
  instantiations, 253 s of check.
- **No short list of files holds the time.** 14,708 files were checked. The 10 slowest hold 6%, the
  100 slowest 27%, the 1,000 slowest 72%. The slowest took 2.9 s.
- By folder: `components/jobs` 21%, `components/bids` 10%, `pages` 6%, `components/people` 5%,
  `components/gc` 5%. All of `src/lib` is about 12%.
- 12% of the types are declared inside the database client's library, 12% are arrays, 12% string
  literals, 35% have no declaration.

**The app program with the database client untyped** (the one client and the 117 files that name
its type, on a dev Mac, plain and then untyped, back to back):

| | Plain | Untyped | |
|---|---|---|---|
| Heap held after a collection | 8,011 | 7,934 | 77 less |
| Instantiations | 29.8 M | 23.1 M | 22% fewer |
| Check time | 253 s | 227 s | 10% less |
| Errors | 0 | 196 | |

- **The typed client holds about 80 MB of the 8 GB.** It costs time, not memory.

**What it adds up to.** The memory follows the lines of code in one program, about 4.5 KB a line.
A warm program that only parses holds about 3.2 GB of the 8, and the check adds the rest across
every file. No one shape, library or compiler takes it away. Only a program with fewer source files
holds less.

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

**PR 2 (S): the peak on every CI run. Built, v2.8696.** The third way of the row on the type check's
memory in `to-dos/owner-decisions-pending.md`. As built:

- A hook preloaded into tsc (`scripts/lib/tscMemoryHook.cjs`) writes the heap in use and the peak
  resident size as tsc exits. `scripts/lib/runTsc.mjs` prints them as each part's last line, with the
  time, for `npm run typecheck` and for the build's `tsc -b`.
- CI forces a collection first. A dev machine does not, unless `TYPECHECK_COLLECT=1`.
- The heap number is the program's only where tsc still holds its program as it exits. The line
  leaves it out when it is under a quarter of the peak (v2.8707): three cold parts that had held
  7 to 9 GB read about 30 MB.
- It warns and does not fail, from 20% of the cap and not 10%. A fail would stop every merge and the
  deploy about ten days before the heap would, with a check that still passes. A fifth of a
  runner's cap is about three weeks at 130 MB a day.
- The deploy's `tsc -b` is cold on every merge, so its line is the app program's cold number, daily.
- The warning reads the larger of the two numbers, so it was right on every run measured.

**PR 3 (L): the app program itself.** It is 8.0 GB and grows with the app's lines. Its way is not
chosen. What each way measured on 2026-11-27, with the numbers in the section above:

- **Find what is heavy: measured, and there is no short list.** The 10 slowest files hold 6% of the
  check time and the 1,000 slowest 72%. The typed query builders are 22% of the instantiations and
  10% of the check time, and 80 MB of the 8 GB held. A sweep of them would save time, not memory.
- **TypeScript 7: measured, five times as fast and no lighter.** It is not a way past the wall. It
  is a way to a 3 minute cold check and a 1 minute deploy check, for about 20 lines to mend in
  about 14 files and two lines of config, with eslint left on 5.6.
- **Project references: the one cut left.** The memory follows the lines of code in one program,
  about 4.5 KB a line, so only a program with fewer source files holds less. `src/lib` as a
  composite project that emits declarations, and the components and pages reading those
  declarations, takes 609,007 of the app's 1.78 million lines out of the larger program. That is
  not enough alone, since the components are where the check's time goes: the feature areas
  (`components/jobs` 21%, `components/bids` 10%) want to be projects of their own. It needs every
  exported type in a project to be nameable, and `src/lib` untangled first: 52 of its files import
  from `components` and 114 from `hooks`. A sweep, and the only way that stops the app's own growth
  from landing in one heap.
- **Buying room without a cut.** `tests-rest` is the largest part and has no single root, so it
  splits in two by plain include lists (S); after it the app part is the largest, about 480 MB
  under it. A larger runner raises the cap for money.

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
- **Since v2.8696 the check prints its own numbers.** Each part's last line is its time and its
  peak, and the deploy's build log holds the app program's heap after a collection. A measurement
  branch is for what those lines do not say: another compiler, a trace, a changed program.
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
