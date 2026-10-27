---
name: "A Bridge dial date more than a year out shows its year"
number: 201
group: ready
status: proposed 2026-10-27 from the live test of the weekly send · ready to build, no decision needed
summary: >
  The Bridge dial says when a pile is gone, or when the field runs out of work, as a month and a
  day. When that day is more than a year away, a reader takes it as the next one. On 2026-10-27 the
  live sheet said Build's pile "is gone by Jun 4", and the pile and its pace put that day in June
  2028. The line goes out in the Monday email too since v2.5883. The fix adds the year to a day more
  than about a year out.
next: Build it in one small PR, then redeploy bridge-weekly-sheet.
size: XS
blocker: none
ver: v2.5236 · 5883
opinion: build — a date that reads nineteen months early misleads the owner every Monday
mockup: not required — one date in two existing sentences gains its year
---

# A Bridge dial date more than a year out shows its year (#201)

## The ask

On 2026-10-27 the owner asked to put this on the punch list: *please add these two suggested tasks
to the punchlist*. It was found that day while the weekly send (v2.5883) was tested against the live
sheet. #200 is the other one.

## Found

- On 2026-10-27 the weakest link's pile line read *The pile shrinks … a week and is gone by Jun 4.*
  Build's pile divided by the week's shrink comes to about a year and a half, so the day falls in
  June 2028.
- On 2026-10-26 the same line read *gone by Oct 15* for a day about two years out.
- The line shows on the Bridge and in the Monday sheet. Since v2.5883 the sheet is also mailed to
  every dev each Monday once its switch is on.

## Today

- `src/lib/bridge/dial.ts` → `buildDialReading`: `dateAfterWeeks(w)` adds `w` weeks to today and
  labels the day with `opts.dayLabel`.
- Both callers pass `md`, a month and day label: `src/pages/Bridge.tsx` and
  `src/lib/bridge/sheetBuild.ts`.
- Two sentences use it. The green pile line ends *and is gone by <day>.* The red line reads *It runs
  out of work by <day>.*

## The fix

- In `dateAfterWeeks`, add the year when the day is more than about eleven months from today, as in
  *Jun 4, 2028*. A nearer day keeps its month and day, even across New Year.
- Keep `dayLabel` as it is for its other uses.
- Test with a pinned today: a day ten weeks out, a day across New Year inside the year ahead, and a
  day two years out, for both sentences.
- Read the other `dayLabel` users in `src/lib/bridge/` for a day that can fall a year out, and give
  them the same rule if one can.
- `dial.ts` is in the edge kernel copy. Run `npm run gen:edge-kernels` and commit the regenerated
  file in the same PR.
- Add a release note and a `docs/recent-features/` fragment.

## Where it plugs in

| Piece | File |
|---|---|
| The dial | `src/lib/bridge/dial.ts` → `buildDialReading`, `dateAfterWeeks` |
| Its tests | `src/lib/bridge/dial.test.ts` |
| The page | `src/pages/Bridge.tsx` |
| The sheet | `src/lib/bridge/sheetBuild.ts` |
| The copy the edge function imports | `supabase/functions/_shared/gcKernels/lib/bridge/dial.ts` |

## How to verify

- The dial's tests, with a pinned today.
- After the merge, redeploy what `node scripts/check-edge-function-drift.mjs --full` names, at least
  `bridge-weekly-sheet`.
- On the live Bridge, the lit stage's pile line names the year when its day is that far out. A dry
  run of `bridge-weekly-sheet` as a dev shows the same line.

## Where it stands

Proposed on 2026-10-27. Nobody has started it.
