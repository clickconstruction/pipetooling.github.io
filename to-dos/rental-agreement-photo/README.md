---
name: "A rental's agreement arrives at pickup: the tech photographs the paper, the office types the number off it"
number: 271
group: ready
status: written up 2026-11-06 from the owner's question; the design is decided (photo first), nothing built
summary: >
  The office often books a rental before anyone has the agreement number, which the yard hands the
  tech at pickup. Today the block editor and the fleet board want the number up front. The decided
  flow: the office plans the rental with what it knows, the agreement blank; the tech's pre-use
  check opens with a stop that asks for a photo of the agreement paper and will not sign without it;
  the photo files into the machine's Drive folder like every other shot; and the fleet board card
  shows that photo with a Type it off the photo press that opens the rental editor beside it, so
  the office types the number and the due-back day from the paper. No migration: the photos table
  takes any shot name and the Drive filing already works. The tech typing the number at the yard
  was rejected for now (crews cannot edit the fleet board; it would need a database function).
next: PR 1, the kernels and the agreement stop on the check; PR 2, the card's photo and Type it off the photo; PR 3, Ours or Rental on the label page's add form
size: S as a train of three, each S
blocker: none — the owner picked photo first on 2026-11-06
opinion: ship PR 1 and PR 2 together if one session has both in hand; PR 3 can wait, since the block editor already adds a rental (v2.6573)
mockup: to-dos/rental-agreement-photo/mockup.html
---

# A rental's agreement arrives at pickup (#271)

## The ask

Micah, 2026-11-06, after the block editor learned to add a rental from a template (v2.6573):

> Sometimes we won't know the rental agreement until after the tech or helper picks it up in the
> morning. How should we handle this? Perhaps that tech should be able to take a photo of the
> rental agreement on their phone that the office can see.

He chose **photo first, the office types the number** over the tech typing it at the yard.

## The decision

The flow as it will run:

1. **The office plans the rental with what it knows.** On the block, Rental, the yard (Sunbelt),
   the template, make and model if known. The agreement number and due-back day stay blank. The
   machine reads *Sunbelt rental* on the block and the board, with an amber *agreement not in yet*
   chip.
2. **The tech picks it up.** The morning's *Is the Sunbelt rental here?* opens the pre-use check
   as now. For a rental with no agreement in yet, the check gets a first stop at the top, **The
   rental agreement**: a camera press for the paper, and a second for the back page or a return
   slip when there is one. The sign press holds until that photo is in, the way the gauges and the
   four sides are the evidence against a damage claim. The photo files into the machine's Drive
   folder with the other shots, named by the day, the person and *agreement*.
3. **The office sees it.** The fleet board card's rental line turns to *agreement photo in · number
   not typed yet*, with the photo opening right there, and a **Type it off the photo** press that
   opens the rental editor beside the picture. The office types the agreement number and the
   due-back day from the paper, and the chip reads *agreement 48812-3 · due back Nov 20*
   everywhere.

**Why the office types the number, not the tech.** Crews cannot edit the fleet board: the
`vehicles` policy ("Pay access users can manage vehicles", the baseline) lets only dev, a
pay-approved master and assistants write a vehicle, so a number typed on the phone would need a
`SECURITY DEFINER` function and a migration with a timed push. Reading digits off a paper into a
phone at 6 AM is also where mistakes happen; the office checking the photo against what they type
is the better control. Photo first needs no migration at all.

**Rejected for now, can come later:** a small database function that lets the person whose check
it is set the agreement number and due-back day, with the card then only confirming. One more PR
and one push; it does not undo any of this.

**Also decided:** the label page's *not a machine on the board yet* form gains Ours or Rental like
the block editor, so a rental nobody planned can still start from the yard by scanning the label;
and the leaving check for a rental gets a *return slip* photo press, the matching evidence at the
other end.

## Is this the best we can do?

Two things checked against the first draft. The stop is required only when the machine has
neither a typed number nor an agreement photo yet; once either is in, later checks show one line,
*agreement 48812-3 · photo filed*, and no stop, so a rental that runs for three weeks is not asked
twenty times. And the office's press is beside the photo, not on another page: the number is read
off the picture on the same card that holds the rental editor, which is the whole point of the
photo.

## Where it plugs in (verified 2026-11-06 against main at v2.6569 and PR #7118)

What exists:

- `machine_check_photos.shot` is free text up to 80 characters (`20261106030000_machines.sql`), so
  the shot names `agreement`, `agreement_more` and `return_slip` need no migration. The sweep
  (`photo-save`, `sweepMachinePhotos`) files any row into the machine's Drive folder;
  `photoFileName(check, machine, words)` in `src/lib/machines/machines.ts` names the file.
- `MachineCheckSheet.tsx`: `takePhoto(shot, words, file)` and `photoOf(shot)`; the rental line at
  the top (`data-rental-line`, `rentalWords`); `ShotTile` for the four sides (typed to `ShotKey`,
  widen it to take `words`); the sign press's words and gate (`walkDone && leaveAnswered`).
- `MachinesSection.tsx`: the card's rental chip (`data-rental-chip`), `RentalEditor` (from,
  agreement number, out on, due back), `AddMachine` (unit, make, model, template; the label page
  `src/pages/MachineCode.tsx` reuses it with `code`), `loadFleet` already carries sixty days of
  checks with their photos; `photoSrc` in `checksIo.ts` gives a photo's signed or Drive URL.
- `rentalWords(r, today)` reads *Rental · Sunbelt · agreement 48812-3 · due back …*; with a blank
  number it reads *agreement* followed by nothing — fix in PR 1.
- The block editor's add form (`AddFromTemplate` in `MachineStops.tsx`, PR #7118) already takes a
  rental with the agreement number optional and mints the label *Sunbelt rental* when it is blank.
- The `Rental` type (`from`, `agreementNo`, `outOn`, `dueBack`) and `saveRental` in
  `machinesIo.ts`.

What is new:

- Kernels in `machines.ts`: `agreementState(machine, checks)` → `none | photo | typed`;
  `agreementWords(state, rental)`; `agreementPhotos(checks, machineId)` newest first;
  `agreementDue(machine, kind, checks)` for the sign gate; `mintRentalLabel(from, agreementNo)`
  shared with the block editor's form; `rentalWords` takes the state.
- The sheet's stop, the card's amber box and press, the label page's toggle, the leaving check's
  return slip.

## The plan

1. **PR 1 — the kernels and the stop on the check.** `machines.ts` kernels with unit tests
   (`machines.test.ts`); `MachineCheckSheet.tsx`: for a rental's pre-use check, **The rental
   agreement** under the rental line with two tiles (*The agreement*, *Back page or return slip*)
   through `takePhoto('agreement', 'agreement', file)`; the sign press reads *Photo of the agreement
   first* and holds while `agreementDue`; later checks show *agreement 48812-3 · photo filed*. The
   leaving check of a rental gets the *Return slip* tile. Render test in
   `MachineCheckSheet.render.test.tsx` (a rental with no number and no photo: the press reads
   *Photo of the agreement first* with an empty walk). Guide *check a machine before you run it*,
   section *A rented machine*. Release note and fragment.
2. **PR 2 — the card's photo and Type it off the photo.** `MachinesSection.tsx`: the rental chip
   through `agreementWords`; for `photo` state an amber box with the newest agreement photo
   (`photoSrc`), *Open the photo*, and **Type it off the photo** which opens `RentalEditor` with the
   photo drawn beside the fields (a `photo` prop). Render test in `MachinesSection.render.test.tsx`
   (a rental with a photo and a blank number). Guide *manage company vehicles*, section *Machines on
   the board*. Release note and fragment.
3. **PR 3 — Ours or Rental on the label page.** `AddMachine` in `MachinesSection.tsx` gains the
   Ours / Rental toggle and the rental fields (shared `RentalFields` with the block editor's form
   once PR #7118 is on main); `MachineCode.tsx` needs nothing more. The board's own Add a machine
   gets the toggle for free. Render test; guide line; release note and fragment.

Branch from `origin/main` after PR #7118 (v2.6573) has merged, so `mintRentalLabel` can replace
the inline mint in `MachineStops.tsx` in the same PR.

## How to verify

On the dev server, signed in as dev, at 1280, 768 and 375:

1. People → Vehicles → Machines: the test machine **R-ZZ-TEST-1 · Bobcat S70** (Sunbelt rental,
   agreement ZZ-TEST-1, due back 2026-11-20) exists from the 2026-11-06 live test; on its card,
   *Rental…* and clear the agreement number so it reads *agreement not in yet*. Its label code is
   `RZZT09T4`; the other test machine, **ZZ-TEST · Kubota KX040**, is `ZZTE0YO5` (a letter O).
2. Open `/m/RZZT09T4` at 375: the pre-use check opens; pick **1088 · ZZ TEST Riders Walk**
   (job id `e10bae39-72bd-47cf-89d4-400db3eeca9d`); *The rental agreement* is the first stop; with
   the walk answered the sign press reads *Photo of the agreement first*; take a photo (any image
   file); the press turns to *Sign: Rental ZZ-TEST-1 is safe to run* or the like.
3. Back on the board: the card reads *agreement photo in · number not typed yet* with the photo;
   *Type it off the photo* opens the editor beside it; type the number and the due-back day; the
   chip reads *agreement ZZ-TEST-1 · due back …*.
4. `npx vitest run src/components/machines src/lib/machines`, the guide suites
   (`helpGuideContent`, `helpGuidePlainWords`, `helpGuideLinks.guides`, `helpShareCard.guides`),
   `releaseNotes.test.ts`, typecheck, lint, `node scripts/theme-tokenize.mjs --check src`, and the
   word checks (`check:empty-words`, `check:batch-words`, `check:dead-press`, `check:press-blue`,
   `check:text-fill-words`, `check:error-words`).

Gotchas from the 2026-11-06 build of v2.6573: a `press` style that sets `border` and a variant that
sets `borderColor` make React warn when they swap, so a variant sets the whole `border`; the dead
press takes `DEAD_PRESS_FILL` / `DEAD_PRESS_TEXT` from `src/lib/deadPress.ts`; the job's own week
page (`ScheduleDispatchJobWeek.tsx`) hands the block editor its `jobId` since v2.6573, the people
board since v2.6560.

## Where it stands

Designed and decided on 2026-11-06; the owner chose photo first and asked for this card instead of
a build in the same session. The two version numbers that session claimed were released; the
branch has nothing but this card.
