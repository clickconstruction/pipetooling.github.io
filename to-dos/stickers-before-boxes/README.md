---
name: "Stickers before boxes: print a run of blank stickers, stick one on a box, then say what it is"
number: 329
group: gated
status: asked 2026-11-12 · the card and the mock-up the same day · nothing built · waits on Grace's go and her calls
mockup: to-dos/stickers-before-boxes/mockup.html
summary: >
  Today a box is made in the app first and its label is printed from that record, because a label's
  code is cut from the box's own row. On a site that is backwards. Someone walks in with a roll of
  stickers, sticks one on each box that is already there, and only then says what is in it, and
  nobody knows ahead how many boxes there will be. The card proposes a sticker as its own thing: a
  printed code and a short number that point at a box, or at nothing yet. The office prints a run
  of 200. On site, a scan of a blank sticker asks one question, an old box or a new one, and the
  next unused sticker is the next box with no office step. A scan of a used sticker opens the box,
  where it can be renamed, moved to the right box or started over, with the old name kept in the
  history. Every label printed so far keeps working.
next: Grace's go and her seven calls, then PR 1 (the sticker itself, no new screen but a blank sticker's page).
size: L as a train of six (M · M · M · S · M · S); PRs 1 to 3 are the whole loop, then a stop to use it on the site
blocker: Grace's go, and her calls on the number, the paper and who prints a run.
opinion: build PRs 1 to 3, then walk the site — the loop is whole there with the phone's own camera, and the walk shows whether the in-app camera and the sheet of 30 are worth their PRs
---

# Stickers before boxes (#329)

This card sits beside **Materials on site** (#209, `to-dos/materials-on-site/README.md`), which built
the cages, boxes, counts, labels and photos. Nothing in #209's ledger changes here. This card adds one
thing in front of it: a sticker that exists before its box does.

## The ask

Grace, 2026-11-12:

> Can you please take a look at materials? Sometimes on a job site we will want to send someone ahead
> of time with stickers that they will then use to backfill boxes. […] We have almost a hundred boxes
> there already, but we think we might add a hundred more. So we want to print two hundred sets of
> stickers where they can apply the hundred stickers to the first hundred boxes and then however many
> of that two hundred they use they can apply additional stickers. How would I need to modify the app
> to accommodate these individuals where we can easily add more boxes? Or someone can scan a sticker
> and then after the fact change the name of what that sticker represents.

She named a real development as her example. This card calls it *a development with about a hundred
boxes* and every name on the mock-up is made up (Juniper Ridge, Dana, Marcus, Priya).

## What the app does today (read 2026-11-12)

- **A label cannot exist before its box.** `job_containers.code` is a generated column: the first
  eight characters of the row's own id (`20261029010000_materials_on_site.sql`). The QR carries
  `HTTPS://PRTS.CO/B/<CODE>` and the words under it read `7D75-9246` (`src/lib/materials/labels.ts`:
  `boxCode`, `boxUrl`, `boxCodeWords`). No row, no code.
- **A box is made first, by typing.** The phone's **Add a container** sheet
  (`AddContainerSheet` in `src/components/tally/TallyOnSiteTab.tsx`) asks the kind, the stencil, the
  place and a where line, then **Add A1**. The suggested stencil always starts at `A`
  (`nextLabel(existing, 'A')`), whatever letter the site paints. The office's **Add a container** on
  Jobs → Materials does the same. The store writes the row directly (`addContainer` in
  `src/lib/materials/onSiteStore.ts`).
- **A box's name is one field, at most 24 characters, one live name per job**
  (`job_containers_live_label_key`). **Nothing renames a box.** The store has add, move, pin, retire
  and bring back, and no rename. A wrong name today means retire the box and make another, which
  changes its code and so its printed label.
- **Labels print one box at a time or every box of a job** (`LabelsPrintModal.tsx`, opened by
  `PrintLabelsWindow.tsx`, the box's **Print the label** and the office's **Print labels**). Two
  outputs: **Paper sheet**, one Letter page a box with ruled lines, and **Brother tape**, one 18 or
  24 mm strip a box (60 or 72 mm long: the QR, the stencil, the dashed address, *Scan for what is
  inside*), sent straight to a P-touch over USB in Chrome or Edge, a run sharing one lead-in, with
  **Copies of each** for a box with more than one side and **Print 1 test strip**
  (`tapeLabel.ts`, `ptouchUsb.ts`, `ptouchRaster.ts`, `TapeStripBitmap.tsx`). A CSV of the labels
  feeds Brother's own editor (`labelsCsv.ts`). No sheet of many small labels exists.
- **The QR generator** on a label is `qrcode.react` in the browser. Its twin for emails is
  `supabase/functions/_shared/qrMatrix.ts` with `qrPng.ts`, held to it module for module by
  `src/lib/portal/qrMatrix.test.ts`; the bill email, the GC statement and the lien release use it.
  A sticker is printed from the browser, so it takes the first and needs nothing new.
- **A scan is the phone's own camera.** The code opens `/b/:code` (`src/pages/BoxCode.tsx`), outside
  the sign-in. Signed in, `fetchContainerByCode` finds the box and the page goes to the box on the
  Tally's **On site** tab. A code no box carries reads *4F2A-9C18 is not a box on any job*. Signed
  out, `BoxPublicPage.tsx` asks the `box-read` function and draws the stencil, the place, the newest
  photo and the lines, never the job, a price or a name. **Scan a label** (`BoxScan.tsx`,
  `ScanLabelWindow.tsx`) takes a typed code. **The app has no camera scanner of its own**: nothing
  under `src/` asks for the camera to read a code.
- **What a box holds**: lines in the ledger (`job_material_movements`, insert only), a count per
  line, photos (`job_box_photos`, shrunk on the phone, filed in the job's Drive folder by
  `photo-save` within five minutes), a place (`job_places`, a row of one job), a where line and a
  map pin.
- **A box belongs to one job.** A development groups jobs through `jobs_ledger.development_id`
  (#208); the material location report (#268) reads a site's boxes across its jobs, and a place is
  still a row of one job. No screen changes a box's job.
- **Who**: one gate, `on_site_can_touch_job(job_id)`: whoever sees the job, or is on its team, so a
  helper or a subcontractor on the team adds boxes, counts and prints. Training accounts and
  digital twins are fenced out.
- **No signal**: a read keeps its last page and a photo stays on the phone with **Send now**. A
  press that writes waits for signal (#163's queue is not built).

## The need, replayed on her case

Read on prod 2026-11-12 through a local copy of the app with every write refused. Rounded on
purpose; the exact figures are in the session's notes, outside the repo.

- The development has **about a hundred live boxes, all but one a cage, under two jobs**: nearly all
  on one job and a couple on a second. A few more are retired.
- **About four in five are named by a painted stencil alone** (a letter and a number), one in ten by
  a stencil and a word, the rest by words. The median name is three characters.
- **Nearly all stand at one place.** None has a map pin.
- **The crew's first walk made about eighty boxes in under three hours**: about a minute between
  one new box and the next, with a name, one line, a count and a photo each. Almost every box holds
  one line.
- No box has been added since that weekend.

**The first pass with this design.** The office prints 200 sets. On site, each old box is: peel,
stick, scan, type two digits of its stencil, press its row. That is about 20 seconds on the phone
against today's minute, because nothing is typed but the digits and nothing is made. A hundred
boxes are under an hour for one person, walking included (an estimate until someone does it). Each
new box after that is the same scan and **A new box**, with the sticker's number as its name until
someone types a better one.

**Where a person would get stuck, and what the design does about each:**

1. **The boxes sit under two jobs.** A match list that read one job would miss the others and the
   person would make duplicates. The list for **A box already here** reads every job of the
   development, and the sticker takes the job of the box it lands on.
2. **The wrong job.** This site's first count went under the wrong job, picked by hand on the
   phone. A run names its job, so a new box lands there without a picker, and the sheet says the job
   in words with **Change**.
3. **A stencil that does not match the paint.** The list searches every word of a name, the place
   and the where line, and shows boxes with no sticker first.
4. **More than one side.** A set is two or more copies of one sticker (the window's **Copies of
   each**, already built for tape). Every copy opens the same box.
5. **Weak signal in a metal building.** A sticker is not money and placing one twice does nothing
   the second time, so the walk keeps what did not send on the phone and sends it in order
   (PR 5). The count and the photo behave as today.
6. **A retired box that is still standing there.** A search that lands on a retired box offers
   **Bring back** (v2.6406), then takes the sticker.
7. **Scanning a hundred times with the phone's own camera.** Each scan opens a browser tab and the
   person goes back to the camera. PR 5's walk keeps one screen open; until then it works and is
   slower.

## The design

### The idea: the sticker is the address, the box is what it points at

A sticker is a printed code and a short number. It points at one box, or at nothing yet. A box can
have several stickers and its own old label; all of them open it. Renaming a box never touches the
sticker, and moving a sticker never touches the ledger. That one split answers every part of the
ask: stickers before boxes, more boxes than planned, and changing what a sticker means afterwards.

The other way, rejected: make 200 empty boxes at print time and fill them in on site. It needs no
new table, but an old box could never take a new sticker without merging two rows of an insert-only
ledger, 200 empty rows would sit in every list and count, and leftovers would be boxes of a job
instead of stickers anyone can use.

### 1 · What a sticker is

- **The code** in the QR is eight characters cut from the sticker's own id, the same rule a box's
  code follows, so `HTTPS://PRTS.CO/B/<CODE>` stays a 25-module square and every parser, typed-code
  box and test keeps working. It never changes and says nothing about the box. It cannot be guessed,
  which matters because the box page opens with no sign-in.
- **The number** is what a person reads: `0147`. One company-wide count, four digits, five past
  9999. A second run starts where the last ended, so two runs never collide and a leftover sticker
  works on any site. A site prefix (`JR-0147`) is call 2's other way.
- **Printed on it**: the QR, the number large, the dashed address small (`prts.co/b/4F2A-9C18`) and
  *Scan for what is inside*, on the strip the app already draws. When the code will not scan, a
  signed-in person types the number into **Scan a label**; signed out, the eight characters, as
  today.
- **Blank** means it points at no box. Signed out, a blank sticker's page reads *Sticker 0147 is not
  on a box yet. Sign in to say what it is.* and shows nothing else.

### 2 · Printing a run

**Print blank stickers** beside **Print labels**, on the office's Materials page and the phone's On
site tab. It asks how many (30 · 60 · 100 · 200, or a typed number), which job new boxes go on (the
development named beside it), **Copies of each** and the paper. The press says what it will do:
**Print 200 sets, 0101 to 0300**.

- **Paper**: Brother tape first, because it prints today over USB, it is laminated for a yard and
  it needs no alignment. Two hundred sets of two are 400 strips: about half an hour and several
  cassettes. Call 3's other way is a sheet of 30 weatherproof labels a page (the Avery 5160 layout,
  one inch by two and five eighths, almost the 24 mm strip's own size): 14 pages in a minute, a
  laser printer and one alignment test. PR 6 builds it if the tape proves too slow.
- **A run that stops part way** says how many went and offers **Print the rest, 0163 to 0300**.
- **Reprinting a damaged one** is **Print 0163 again** on the run's row: the same code, so nothing
  can collide. A reprint is another copy of the same sticker.
- **A run belongs to the job it was printed for**, and that only sets where new boxes land. A
  leftover scanned on another job asks once, *This sticker was printed for Juniper Ridge. Use it
  here?*, and then belongs to the box it lands on.

### 3 · The first scan

Signed in and on the job's team, a blank sticker opens the On site tab on one sheet, **Sticker 0147
is new**:

- **A box already here**: the site's boxes with no sticker first, a search box on top. Type `76`,
  press the row, **Put 0147 on R76**. Two presses and two digits. The box keeps its name, its
  lines, its counts, its photos and its old label.
- **A new box**: the name is filled in with the sticker's number, with the site's next stencil as a
  second press (`R97`), the kind and the place remembered from the last box. **Save box 0147**, then
  the box's own screen, where **Add a part** and **Photo** are as today. One press when the defaults
  are right.

The sheet opens on whichever fits: **A box already here** while the site has boxes with no sticker,
**A new box** once it has none. Someone not on the job's team reads who to ask.

**Twenty in a row** is PR 5's **Sticker walk**: one screen with the camera at the top, the sheet
under it and the camera back after each save. Under the camera, **Or use the next sticker, 0148**
is the same act with no scan, for a dark corner or a camera that will not read. The scan is the
default because it proves the match; counting along is the fallback because one skipped sticker
would shift every box after it. A line counts down: *37 of 96 old boxes have a sticker · 163
stickers left*.

### 4 · Changing it afterwards

A scan of a used sticker opens the box, as a label does today. The box's screen gains three presses:

- **Rename**: *Rename R40 TOILETS* takes a new name. The lines and counts stay. A trigger writes the
  old name, the new one, who and when, and the box's history reads *Renamed from R40 TOILETS by
  Priya, Nov 14*. No relabel: the sticker never carried the name.
- **This sticker is on the wrong box**: pick the right box, or a new one. The sticker moves; both
  boxes' ledgers stay where they are, and the move is on record.
- **Empty it and start over**: for a box that holds different things now. The old box is retired
  with its history, by Retire's own rule (it asks about what is still inside), and the sticker
  opens a new box. *2-inch couplings* last week and *returns* today are two boxes in the record,
  so last week's count still means what it meant.

The rename sheet says which to pick in one line: *Same things inside? Rename. Different things?
Empty it and start over.*

### 5 · More boxes than expected

Nothing to do. The next unused sticker is the next box. The run's row counts down, and at 20 left
the office's page says so beside **Print blank stickers**.

### 6 · Stickers never used

They show as a count wherever the site's boxes are listed: *96 stickers not used yet, 0205 to 0300*
on the phone's On site tab and on the run's row on the office page. They do not expire. The office
can **Move the unused ones to another job**, and anyone can use one elsewhere by scanning it there
(section 2).

### 7 · Backfilling a site the app already knows

Both. Every label printed so far keeps opening its box, because a box's own code still resolves. A
box that has one needs nothing. A box that has none, or a faded one, takes any blank sticker through
**A box already here**, which lists known boxes so the person picks one instead of making a
duplicate. The other way, printing a named label for each known box, means hunting a pile of a
hundred loose strips for the one that matches the cage in front of you.

### 8 · Mistakes

| What happened | What the app does |
|---|---|
| Two stickers on one box | Allowed. Both open it, and the box reads *Stickers 0147, 0152*. **Take 0152 off this box** makes it blank again. |
| Two people name one sticker | Placing is one write that only a blank sticker takes. The second person reads *Marcus put 0147 on R76 a minute ago* with **Open R76** and **That is wrong**. |
| A sticker on the wrong box | **This sticker is on the wrong box** (section 4). |
| A sticker fell off | The box is still in the list by name. Scan any blank sticker and pick it. **This sticker is lost** on the old one makes a later scan read *0147 was on R76 and was marked lost*. |
| A new box that was already in the app | **This sticker is on the wrong box** onto the old one, then Retire on the empty new one. |
| The wrong job | The run names the job; the sheet says it with **Change**. |

### 9 · Who

- **Place a sticker, rename, move a sticker, start over, reprint one**: anyone the gate lets touch
  the job today, so the person sent ahead needs only to be on the job's team.
- **Print a run, move the unused ones to another job**: the office, a primary and a superintendent
  (call 6). A run takes numbers that are never given out again.
- **Signed out**: reads a used sticker's box as today; a blank one says only that it is blank.

## What needs a migration

One, in PR 1, per `CLAUDE.md`: `SET lock_timeout = '3s'` first, numbered from `origin/main`, claimed,
idempotent, ending with the four `apply_*` fence calls since it creates tables, pushed right after
the merge because the client calls what it makes.

- `sticker_runs`: the job, the first and last number, copies, who printed and when.
- `box_stickers`: the run, the `number` (unique, from one sequence), the generated `code` (unique),
  `container_id` (null while blank), who placed it and when, `lost_at`.
- `box_sticker_events`, insert only: placed, moved, taken off, lost, with from and to.
- `job_container_names`, insert only, written by a trigger on a changed `label`, so the phone, the
  office and the dev seat are all covered at once.
- Functions: `mint_sticker_run` (retries a code that a box or a sticker already carries),
  `sticker_by_code` (what a scan needs before it knows the job), `place_sticker` (the new box and
  the placing in one transaction, a blank sticker only, judged by the caller's own RLS).
- `box-read` learns a sticker's code and is redeployed. `job_containers.code` stays as it is.

## The plan

| PR | What | Size |
|---|---|---|
| 1 · the sticker | The migration, the kernel `src/lib/materials/stickers.ts` (number words, ranges, counts, placing verdicts) with tests, `/b/:code` and `box-read` resolving a sticker first, the blank sticker's page, the types, the docs | M |
| 2 · print a run | **Print blank stickers** on tape through the window's own strip, reprint, print the rest, the runs on the office page; a guide | M |
| 3 · the first scan | The **Sticker is new** sheet with both branches, the match list across the development, the number on a box's row and screen, the unused count, the twice-named and other-job verdicts, **Scan a label** taking a number; the guide | M |
| | **Stop here and walk the site.** The loop is whole with the phone's own camera. | |
| 4 · change it afterwards | **Rename**, **This sticker is on the wrong box**, **Take off**, **lost**, **Empty it and start over**, the History rows | S |
| 5 · the sticker walk | One screen, the camera in the app, **Or use the next sticker**, what did not send kept on the phone; checked on a real iPhone and a real Android | M |
| 6 · the sheet of 30 | Only if the tape is too slow: the 30-a-page layout with a one-page alignment test | S |

Each PR ships its release note, fragment and guide, and updates
`docs/MATERIALS_ON_SITE_ARCHITECTURE.md`, `ACCESS_CONTROL.md` and `GLOSSARY.md` (sticker, run, set,
blank).

**Where it plugs in:** `labels.ts` (the code and its words, shared), `tapeLabel.ts`,
`TapeStripBitmap.tsx` and `ptouchUsb.ts` (the strip and the run), `LabelsPrintModal.tsx` and
`PrintLabelsWindow.tsx` (the new window's neighbours), `onSiteStore.ts` (`fetchContainerByCode`
becomes the one resolver; a `renameContainer`), `BoxCode.tsx`, `BoxPublicPage.tsx`,
`supabase/functions/box-read` and `_shared/boxPage.ts` (a blank sticker's answer),
`TallyOnSiteTab.tsx` (the sheet, the rows, the box's presses; `nextLabel` taught the site's own
letter), `JobsMaterialsTab.tsx` (the runs), `siteMaterialsRead.ts` (the development's boxes for the
match list), `docs/twins/APP_DIRECTORY.md` only if a page is added (none is planned).

## What I would not build

- **A site prefix on the number**, unless call 2 goes that way: it ties a leftover to a site.
- **An expiry** on unused stickers, or a step where the office approves a new box.
- **A sticker for a part or a place.** A part with its own id is #209's V3 (engraved items).
- **Re-stickering every known box by force.** Old labels keep working.
- **NFC or RFID tags, or an app from a store.** The phone's browser does all of it.
- **A box changing job by sticker.** That stays the dev seat's whole-job move (v2.6808).
- **The offline queue for counts.** That is #163; only placing a sticker waits on the phone here.

## Is this the best we can do?

What the replay and a second pass changed:

- **The match list reads the whole development.** The first drawing read one job, and her site's
  boxes sit under two.
- **A sticker became its own row**, not an empty box, when the backfill showed an old box must be
  able to take a new sticker.
- **The number lost its site prefix**, so a second run and a leftover need no rule.
- **The walk gained a press with no scan**, since a scan needs light and a steady hand a hundred
  times.
- **Start over is a new box, not a rename**, so last week's count stays true.
- **`nextLabel` always suggests `A1`.** On a site that paints another letter the suggestion is
  wrong every time. PR 3 fixes it in passing.

Where it is not yet the best, said plainly: the in-app camera is unproven on real phones until PR 5
(the same gap #209 lists for the printed label); a count still waits for signal; and whether tape
or a sheet is right for 400 strips is known only after the first run.

## Grace's calls

Each is one spot on the mock-up, today beside the suggestion.

| Call | Recommended | Also possible |
|---|---|---|
| 1 · what a sticker is | Its own code that points at a box | 200 empty boxes made at print time |
| 2 · the number | One company-wide number, `0147` | A site prefix, `JR-0147` |
| 3 · the paper | Brother tape now, the sheet of 30 if it is too slow | The sheet of 30 first |
| 4 · the known boxes | Any blank sticker, matched on the phone; old labels keep working | A named label printed for each known box |
| 5 · the walk | The camera in the app, with a no-scan press (PR 5) | The phone's own camera only |
| 6 · who prints a run | The office, a primary, a superintendent | Anyone on the job |
| 7 · a new box's name | The sticker's number until someone types one | Ask for a name every time |

## How to verify

- Dev server from a worktree, `/dev-login?as=1`. Prod is the only database: read, never write. A
  walk that writes uses the ZZ test job's boxes (ZZ1, ZZ2) and a run printed for that job.
- PR 1: a blank sticker's code opens its page signed out and signed in; every old label still opens
  its box; the kernel's tests; the migration on a throwaway Postgres before the push.
- PR 2: **Print 1 test strip**, then a run of four on the P-touch; scan each off the tape with an
  iPhone and an Android phone.
- PR 3: on the ZZ job, put one sticker on ZZ1 and make one new box; scan both again; try to place
  one sticker from two browsers.
- The mock-up was checked at 375, 768 and 1400 wide, light and dark, with no sideways scroll.
- Made-up names, jobs, numbers and counts only, in the repo, the PRs and every screenshot.
