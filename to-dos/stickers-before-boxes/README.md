---
name: "Stickers before boxes: reserve a run of stickers, stick one on a box, then say what it is"
number: 329
group: ready
status: asked 2026-11-12 · the card and the mock-up the same day · Grace took the seven calls as recommended that evening · PR 1, the sticker itself, LIVE 2026-11-13 (v2.7072, #7849; migration 20261113020000 pushed, box-read deployed, types #7874) · the owner's go for PRs 2 and 3 on 2026-11-14 · PR 2, print a run, BUILT 2026-11-14 (v2.7272) · PR 3, the first scan, BUILT 2026-11-14 (v2.7298) · the stop to walk the site · PRs 4 to 6 not built · the preview fold BUILT 2026-11-14 (v2.7304) · 2026-11-15 the owner asked for runs that name their boxes (G78 to G300): design section 10, mock-up `mockup-named-runs.html`, the second pass folded in on his word, the six calls TAKEN as picked the same day · PR 7, the run carries names, LIVE 2026-11-15 (v2.7312, #8169; migration 20261115050000 pushed, types #8193, dev-mcp redeployed) · Taunya's go for PRs 8 to 10 on 2026-11-15 · PR 8, the window and the strip, LIVE 2026-11-15 (v2.7391, #8283) · PR 9, the first scan and the screens, LIVE 2026-11-15 (v2.7396, #8295) · PR 10, These are on boxes, LIVE 2026-11-16 (v2.7406, #8305; migration 20261116153000 pushed and proved) · 2026-11-16 Taunya dropped the sticker's running number from every tape and screen, BUILT (v2.7438)
mockup: to-dos/stickers-before-boxes/mockup.html
summary: >
  Today a box is made in the app first and its label is printed from that record, because a label's
  code is cut from the box's own row. On a site that is backwards. Someone walks in with a roll of
  stickers, sticks one on each box that is already there, and only then says what is in it, and
  nobody knows ahead how many boxes there will be. The card proposes a sticker as its own thing: a
  printed code, and a box's name when its run names its boxes, that point at a box, or at nothing yet. The office prints a run
  of 200, each one reserved for a box. On site, a scan of a reserved sticker asks one question, an old box or a new one, and the
  next unused sticker is the next box with no office step. A scan of a used sticker opens the box,
  where it can be renamed, moved to the right box or started over, with the old name kept in the
  history. Every label printed so far keeps working.
next: Taunya's first named run off the P-touch, which is the walk of section 10; the stop to walk the site with the phone's own camera; PRs 4 to 6 on the owner's go.
ask: owner · decide · Build PRs 4 to 6 of the stickers now, or after the site is walked?
size: L as a train of ten (M · M · M · S · M · S · M · M · S · M); left: M, PRs 4 to 6 (S · M · S)
blocker: PRs 4 to 6 wait for the walk of the site, by the owner's order of 2026-11-14.
ver: v2.7487
opinion: build PRs 1 to 3, then walk the site — the loop is whole there with the phone's own camera, and the walk shows whether the in-app camera and the sheet of 30 are worth their PRs
---

# Stickers before boxes (#329)

This card sits beside **Materials on site** (#209, closed 2026-11-27; its card lives in git history at the deleting commit), which built
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
new box after that is the same scan and **A new box**, with the site's next free name as its name and the
sticker's number shown beside it (#351's rule, 2026-11-14).

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
  works on any site. A site prefix (`JR-0147`) is call 2's other way. **Since 2026-11-16 (v2.7438)
  no tape and no screen shows it**, by Taunya's call: a sticker reads its name, or its code when it
  has none. The number stays in the database, where it orders a run.
- **Printed on it**: the QR, the number large and the dashed address small on two lines (`prts.co/b/`,
  then `4F2A-9C18`), on the strip the app already draws. The line *Scan for what is inside* came off
  every strip in v2.7373, at Taunya's ask of 2026-11-15, so a strip is shorter. When the code will not scan, a
  signed-in person types the number into **Scan a label**; signed out, the eight characters, as
  today.
- **Blank** means it points at no box. Signed out, a blank sticker's page reads *Sticker 0147 is not
  on a box yet. Sign in to say what it is.* and shows nothing else.

### 2 · Printing a run

**Print future stickers** beside **Print labels**, on the office's Materials page and the phone's On
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
- **A new box**: the name is filled in with the site's next free name (`R97`, the rule of #351 since
  2026-11-14), with the sticker's number shown beside it, the kind and the place remembered from the last box. **Save box 0147**, then
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
the office's page says so beside **Print future stickers**.

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

### 10 · A run that names its boxes (the owner's ask of 2026-11-15)

Micah, 2026-11-15, looking at the window on job 224 after the preview fold (v2.7304) went in: "I'd
like to be able to set an array, such as G1-200 or g78-300. That way, I can continue to add to a list
of boxes I already have if the box code is G, and then as I put those stickers on, I can just identify
what is in those boxes and the name of the box and the location by scanning the QR code." And: "I
like the idea of being able to put a prefix of a letter and a number and a letter. Identify the
maximum number of characters and then allow for the user to set an array of letters and numbers as he
needs." The mock-up is `mockup-named-runs.html`, beside this card's own; its Names field and rule
table are live.

The design, with the second pass of the same day folded in on his word:

- **The sticker names its box.** A run carries a name range and each sticker a `box_name`, printed
  large where the number prints today. The number stays, printed small before the address: it is the
  identity the Runs fold, the CSV and a typed scan use, and it still opens the box after a rename.
  (Built so in v2.7391, then taken off every tape and screen in v2.7438 on Taunya's call of
  2026-11-16; the eight-character code is what a person types.) The
  code is still cut from the sticker's own id at the mint. The box's row is still made on the first
  scan, so an unused sticker leaves nothing behind. The idea under section *The idea* holds: the name
  on the tape is a promise, the box is what the sticker points at.
- **The maximum is the box rule's** (#351): one to three letters, 1 to 999, one letter after. Seven
  characters, no setting. Up to four print at the full size, five to seven smaller, as a long stencil
  does on a label.
- **One typed field, Names**, open on the site's next free name as the Add sheet opens, so the
  default run is named: `G78` with How many 200 reads *G78 to G277*. A range sets the end and the
  count follows: `G78-300`. The parts of the two ends that differ step, the parts that match stay:
  `A1-D50` is four rows of fifty, row by row; `G78B-D` twins at one spot; `G1B-200B` a back row;
  `G1-100C` every spot plain, then B, then C, since on the paint the plain name is the first cage at a
  spot and B the second (G24 and G24B, never G24A). All three parts stepping, a range running
  downward, a name past 999 and a run over 500 are refused in words under the field. Cleared, the run
  is numbered only, as today: the exception, for a crew that wants leftovers that travel.
- **Two notices at print, one hold.** Names that are live boxes on the site are the backfill of
  section 7, now the default: *77 of these are boxes on this site already. Their stickers go on those
  boxes.* Names printed on an earlier run and not yet on boxes are the one mess this can make, two
  drawers of the same names, so that notice holds the press until **Print them anyway**.
- **The first scan reads the name off the sticker.** *Sticker G78 is new* opens on **It is a new
  box** with G78 filled in, kind and place, one press. When the site has a G12 already the sheet opens
  on that box with **Put 0159 on G12**. A twin found on site after a plain run printed: **It is a
  different box** offers the next letter, *Save box G78B*, or G78C when G78B stands; the tape then
  reads G78 on a box named G78B and a later scan says so.
- **These are on boxes.** A named sticker cannot shift anything, so the scan need not be the only way
  a sticker goes on a box. The Runs fold gains a press: the person who stuck them types the range,
  *G78 to G150, cages, Arena*, and 73 boxes are made with their stickers, kind and place in one press.
  A name already a box takes the sticker instead, a sticker already placed is left as it is and said,
  and the rest go on. The scan then only adds what is inside. This is not the rejected 200 empty boxes
  at print time: it is told the range that was used, by the person who used it, so it makes no
  leftovers.
- **The number recedes on the screens.** v2.7298's *G12 · 0147* beside every name says the same thing
  twice on a named run. The number shows only where it carries news: a sticker whose name differs
  from the box's, a lost one, a blank one in the Runs fold. (Since v2.7438 it shows nowhere.)
- **The trade, said out loud.** Call 2 chose a plain number so a leftover works on any site. A named
  G sticker does not travel to a site painted R. That is the right trade for a site with its names on
  the paint, and a numbered-only run keeps the old way.

The six calls, my pick first: (1) the number stays small on a named strip, or off; (2) names the site
already has are a notice, or a refusal; (3) grid ranges in, or the number alone steps; (4)
numbered-only runs stay as the exception, or every run is named; (5) a second run over blank names
holds the press until *Print them anyway*, or a notice only; (6) **These are on boxes** is built in
the Runs fold as PR 10, or the scan stays the only way.

The plan, four PRs and one migration, after the six calls: **7 · the run carries names** (M, a
migration pushed right after the merge: the range on `sticker_runs`, `box_name` on `box_stickers`,
`mint_sticker_run` taking the range under the box rule, `place_sticker` naming a new box by its
sticker's name, the parser as a pure kernel with the mock-up's table as its tests and its SQL twin);
**8 · the window and the strip** (M: the Names field with its read line and the two notices, How many
following a range, the press *Print 223 stickers, G78 to G300*, the strip, the preview fold, the Runs
fold's title, the CSV's Name column; the press reads **Print stickers**); **9 · the first scan and the
screens** (S); **10 · These are on boxes** (M, `place_sticker_range` as the caller, the press in the
Runs fold, then on the phone's On site tab).

Not built on purpose: a setting for the longest name, a name longer than the box rule allows, a map
from a row letter to a place, a run that makes its boxes at print time, and a name that changes which
job a box is on.

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
| 2 · print a run | **Print future stickers** on tape through the window's own strip, reprint, print the rest, the runs on the office page; a guide | M |
| 3 · the first scan | **Built 2026-11-14 (v2.7298).** The **Sticker is new** sheet with both branches, the match list across the development, the number on a box's row and screen, the unused count, the twice-named and other-job verdicts, **Scan a label** taking a number; the guide | M |
| | **Stop here and walk the site.** The loop is whole with the phone's own camera. | |
| 4 · change it afterwards | **Rename**, **This sticker is on the wrong box**, **Take off**, **lost**, **Empty it and start over**, the History rows | S |
| 5 · the sticker walk | One screen, the camera in the app, **Or use the next sticker**, what did not send kept on the phone; checked on a real iPhone and a real Android | M |
| 6 · the sheet of 30 | Only if the tape is too slow: the 30-a-page layout with a one-page alignment test | S |
| | **The preview fold, v2.7304 (2026-11-14):** *What the stickers will look like* at the foot of the window. | S |
| 7 · the run carries names | **Live 2026-11-15 (v2.7312).** Section 10: the migration, `mint_sticker_run` taking a name range under the box rule, the range parser as a kernel with the mock-up's table as its tests | M |
| 8 · the window and the strip | **Live 2026-11-15 (v2.7391).** The Names field with its read line and two notices, the strip with the name large and the number small, the preview, the Runs fold's title, the CSV | M |
| 9 · the first scan and the screens | **Live 2026-11-15 (v2.7396).** The sheet reads the name off the sticker, a box already here first, the next twin letter, the number receding on the box rows | S |
| 10 · These are on boxes | **Live 2026-11-16 (v2.7406).** `place_sticker_range`: a range placed in one press with kind and place, the press in the Runs fold then the phone | M |

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

- **A site prefix on the number** (call 2 went the other way): it ties a leftover to a site.
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

Each is one spot on the mock-up, today beside the suggestion. **Grace took all seven as recommended
on 2026-11-12**, so the Recommended column is the design: a sticker is its own code, the number is
company-wide with no prefix, a run prints on Brother tape first, a known box takes any blank sticker,
the walk gets the camera in the app, the office, a primary and a superintendent print a run, and a
new box is named by its sticker's number — changed on 2026-11-14 by #351's call 7: the site's next free name, the sticker's number beside it.

| Call | Recommended, and taken | Also possible, not taken |
|---|---|---|
| 1 · what a sticker is | Its own code that points at a box | 200 empty boxes made at print time |
| 2 · the number | One company-wide number, `0147` | A site prefix, `JR-0147` |
| 3 · the paper | Brother tape now, the sheet of 30 if it is too slow | The sheet of 30 first |
| 4 · the known boxes | Any blank sticker, matched on the phone; old labels keep working | A named label printed for each known box |
| 5 · the walk | The camera in the app, with a no-scan press (PR 5) | The phone's own camera only |
| 6 · who prints a run | The office, a primary, a superintendent | Anyone on the job |
| 7 · a new box's name | The sticker's number until someone types one; since 2026-11-14 (#351, call 7) the site's next free name, with the sticker's number shown beside it | Ask for a name every time |

## The owner's calls on section 10

Six, each one spot on `mockup-named-runs.html`, my pick first. **The owner took all six as recommended
on 2026-11-15**, in his words *Yes, as picked*, after *fold them in* on the second pass. The Recommended
column is the design.

| Call | Recommended, and taken | Also possible, not taken |
|---|---|---|
| 1 · the number on a named strip | Kept, printed small before the address (reversed 2026-11-16: Taunya took it off every strip and screen, v2.7438) | Left off a named strip |
| 2 · names the site already has | A notice: their stickers go on those boxes | A refusal |
| 3 · a grid range | In: `A1-D50` is four rows of fifty | The number alone steps |
| 4 · numbered-only runs | Stay as the exception, the field cleared | Every run is named |
| 5 · a second run over blank names | The press held until *Print them anyway* | A notice only |
| 6 · These are on boxes | Built in the Runs fold as PR 10 | The scan stays the only way |

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

## Where it stands

2026-11-12: **PR 1, the sticker itself, is built** as v2.7072 (#7849). It is the ground only. A sticker
can exist with no box, its code opens a page, and every label printed so far still opens its box. No
screen prints a run or places a sticker. Nothing was written to the database: the migration is pushed
right after the merge, and `box-read` is deployed after the push.

What it built, against *What needs a migration* above:

- The four tables and the three functions as listed, in `20261113020000_box_stickers.sql`.
- **A sticker changes only through a `box_sticker_events` row.** The row is judged by the caller's own
  RLS and a trigger then moves the sticker, so no client updates `box_stickers`. A run is the same
  shape: inserting the `sticker_runs` row is the act, and its triggers number it and make the stickers.
  `mint_sticker_run` and `place_sticker` are the wrappers a screen calls.
- All four kinds of event already hold their rules, so PR 4's presses need no second migration.
- `sticker_runs` also keeps `sticker_count`. `box_sticker_facts` answers a sticker by its id.
- A new box whose code a sticker already holds is refused, so a scanned code names one thing.
- **Who reads a blank sticker**: whoever may touch the job its run was printed for, and nobody else,
  so nobody collects codes ahead of their boxes. Whoever holds the code reads what `sticker_by_code`
  answers. **Who prints a run**: the office, a primary or a superintendent, on a job they can reach.

Checked: the migration three times on a throwaway local Postgres through 117 checks and two races
between two sessions, the kernel's 28 tests, the render tests of both pages, and a read-only walk on a
local copy of the app, where the ZZ job's label opened its box signed in and signed out. The blank
sticker's page is proved by tests and that Postgres run, since nothing can be minted on prod yet.

Left by PR 1, each for a later PR to weigh:

- A whole-job move or combine does not carry a run's job. Placed stickers follow their boxes.
- A number typed into **Scan a label** finds a sticker only for someone on its run's job or its box's
  job. A leftover on another site is found by its scan. A wider read by number is a call for Grace.
- A lost sticker takes no further act. Whether one can be found again is PR 4's question.

2026-11-13: **PR 1 is live.** #7849 merged at 04:40 UTC. The migration `20261113020000_box_stickers`
is on prod's ledger, and the types regeneration #7874 merged at 06:25 UTC. The edge function drift
check, run from main's tip, read all 187 functions current on prod, `box-read` with them. PR 1's
session walked a label's box page signed out on clicktooling.com, and signed in on a local copy
against prod. The dev seat reads no run and no sticker on prod yet, since no screen prints a run
before PR 2.

2026-11-13, later: **the Rename of PR 4 is built on its own** as v2.7179, on the owner's ask after a look at a real site's names. **Edit** on a box changes its name, its kind and its where line (`editBox.ts`, `EditBoxForm.tsx`, `editContainer`). PR 4 keeps the rest: the *Renamed from* line, the sticker's own presses and *Empty it and start over*.

**PR 2 waited on Grace's go.** Her rule of 2026-11-13: while sessions run on Opus 5.5 they build no
new screens. They only get what is open onto main, and write what should change on a card.

2026-11-14: **the owner opened PRs 2 and 3.** Micah's words were *Yes, as picked*, to a plan that said: PR 2 now,
PR 3 after PR 2 and #351's PR 1 have both merged, then a stop to walk the site, then PRs 4 to 6. He also changed
call 7: a new box made from a blank sticker takes the site's next free name under punch list #351's rule, with the
sticker's number shown beside it (PR 3's and #351's business).

2026-11-14: **PR 2, print a run, is built** as v2.7272. **Print blank stickers** sits beside Print labels on the
job's On site strip and at the right end of the Materials tabs, for the office, a primary and a superintendent, dead
with the trigger's words for the rest. It asks how many (30 · 60 · 100 · 200 or a typed 1 to 500), **Copies of each**
and the tape width, says where the last run the caller can see ended and which job new boxes go on, and one press
mints the run through `mint_sticker_run` and prints the strips on Brother tape as soon as they are drawn: the QR, the
number large, the dashed address, *Scan for what is inside*, over the labels window's own USB route, chained behind
one lead-in, or the print window. **Print 1 test strip** prints 0000 and mints nothing. A run that stops part way
says how many stickers went and the press becomes *Print the rest, 0163 to 0300*. The job's **Runs** fold lists each
run with its range, its count, how many are on boxes and not used, who printed and when, with **Reprint** and **Print
the rest**. **Export the stickers as a CSV** writes the run for Brother's editor. The words are
`src/lib/materials/stickerRun.ts`; the reads and the mint `stickerRunsIo.ts`; the window `PrintStickersModal.tsx`.

What PR 2 changed from the design, said plainly: the press names the count, not the range, because the numbers are
given by the mint under its lock and a range shown ahead could be another session's; the run's title carries the range
once it exists. *Print 0163 again* for one damaged sticker is not its own press: Reprint prints the run, Print the rest
the blank ones. The phone's On site tab has no press yet, and *Move the unused ones to another job* waits.

2026-11-14: **PR 3, the first scan, is built** as v2.7298, under the owner's change to call 7. A signed-in scan of a blank
sticker lands on the On site tab with `&sticker=<code>` and opens **Sticker 0147 is new**, the number large, two
branches. **It is on a box I know**: the site's live boxes, this job's first and the ones with no sticker first, read
from the store for this job and from the site's other jobs when the sheet opens, searched by the start of the stencil
or of its number (two digits find R76), the place, the where line, a part or the other job; a row is picked and
*Put 0147 on R76* places through `place_sticker`. **It is a new box**: the box made in the same call, *Its name* on the
site's next free name under #351's rule with *Sticker 0147* beside it, the kind and the place as Add a container asks
them, *Goes on* the job with **Change**, which keeps the sticker in hand through the job picker. The verdicts in words:
*Marcus put 0147 on R76 a minute ago* with **Open R76**, a sticker on a box of a job the person is not on, a lost one, a
name the rule refuses. The press is dead with its reason while the phone has no signal, and nothing is kept for later.
A box's row and header on the phone and the office's box card read the sticker numbers beside the name (*G12 · 0147*);
**Scan a label** takes a sticker's number; the office page counts the stickers not yet on a box with **Runs** one press
away, and the Print blank stickers window says the count before a new run. The words are
`src/lib/materials/stickerPlace.ts`; the sheet `src/components/tally/StickerNewSheet.tsx`; the reads and the write
`stickerPlaceIo.ts` and `useJobStickers`. No migration: `place_sticker` and the events' triggers held every rule.

What PR 3 changed from the design, said plainly: the branches read *It is on a box I know* and *It is a new box* (the
mock-up's *A box already here* and *A new box*); the row is picked and the press names it, so the press is dead until a
row is; the new box is named by the site's next free name and never the sticker's number, by the owner's call; a press
with no signal is refused with its reason, not kept, since two phones may hold one blank sticker. **The loop is whole
with the phone's own camera. The next step is the walk of the site**, then PRs 4 to 6.

2026-11-14, later: **the preview fold is built** as v2.7304 (#8164): **What the stickers will look like** at the
foot of the window draws the run's strips through the printer's own drawing, the real numbers and a sample code.

2026-11-15: **the owner asked for runs that name their boxes.** Section 10 and `mockup-named-runs.html` hold the
design: one typed Names field open on the site's next free name, the box rule as the maximum, the letter after the
number as twins, the name large and the number small on the strip, the first scan reading the name off the sticker,
**These are on boxes** placing a range in one press, the number receding on the screens, and the trade against call
2 said out loud. The owner asked *is this the best we can do*, took the second pass with *fold them in*, and then **took the six
calls as picked** the same day (*Yes, as picked*). Nothing of section 10 is built; PR 7 is next, in its own session.

2026-11-15, later: **PR 7, the run carries names, is live** as v2.7312 (#8169). It is the ground only, as PR 1 was,
and no screen changed. A run can carry one name per sticker, held to #351's box rule, as many as its stickers and
each name once, and each sticker keeps its name as printed. `mint_sticker_run` takes the list as `p_names`, and every
run printed before reads as numbers only. The migration `20261115050000_sticker_run_names` is on prod's ledger, the
types came with #8193, and the dev seat was redeployed so it reads the new columns. The range parser is
`src/lib/materials/stickerNames.ts`, its 27 tests the mock-up's rule table row for row. Checked by those tests and by
CI's `sticker-names` bed on the PR, since the local Postgres could not start. `docs/recent-features/v2.7312.md` says
what it built and why. **PR 8 is next**: the Names field and its two notices, the strip with the name large and the
number small, the preview, the Runs fold's title and the CSV, and the mint sending the names.

2026-11-15, later still: **Taunya opened PRs 8 to 10.** She opened Print blank stickers on job 224, saw strips that read
0003 with the sample code, and was shown where the feature stood. Her words: *Build PR 8-10, let me know when it's
live*. One session builds the three in order, each seen to its merge and live before the next.

2026-11-15: **PR 8, the window and the strip, is built** as v2.7391. The window's ask opens on **Names**, one typed field
filled with the site's next free name once the site's boxes are read: `G78` with How many 200 reads *G78 to G277*, and
a typed range, `G78-300`, sets the count, with How many showing it. The line under the field says what was read, and a
refusal is said there with the press dead (`stickerNamesAsk`, over PR 7's parser). Names that are live boxes on the
site are a notice. Names an earlier run printed that are on no box hold the press, and **Print them anyway** prints
the run. The press names its count and range, *Print 223 stickers, G78 to G300*, and the mint is sent the names. Each
strip prints its name large, its number small on a line of its own over the address, and the address's two lines; a
name of five to seven characters prints at five sevenths of the size. The preview fold draws the names, the Runs fold
titles a named run by its names with its numbers on the line under, and the CSV leads with a Name column. Cleared, the
field prints a run of numbers only.

What PR 8 changed from the design, said plainly: the number sits on its own line above the address, not before it on
the same line, since the address became two lines of a dot font the same day (v2.7373, v2.7377). Three ways were drawn
through the real strip and shown to Taunya with their lengths; the own line adds no length (G78 is 43.2 mm of 24 mm
tape) and was built as this session's pick while she looked. **Print them anyway** prints, where the mock-up's only
lifted the hold. The press waits while the site's names are read. The window is still called *Print blank stickers*.
Nothing was printed or minted: the first named run off the P-touch is the proof. `docs/recent-features/v2.7391.md` has
the table of lengths and the picks. **PR 9 is next.**

2026-11-15: **PR 8 is live.** #8283 merged and the Pages deploy carried it. No run was minted and nothing printed in
the proof: the P-touch is on Taunya's desk and a mint makes real sticker rows.

2026-11-15: **PR 9, the first scan and the screens, is built** as v2.7396. A scan of a sticker printed with a name
opens **Sticker G78 is new** with the name large and the number small beside it. When the site has no live G78 the
sheet opens on **It is a new box** with G78 filled in, and one press saves it. When the site has a G78 the sheet
opens on that box, picked, with *Put 0159 on G78*, and **It is a different box** opens a new box on the next letter at
the spot, G78B, or G78C when G78B stands, with a line that the tape and the box will differ. On the box rows the
number recedes: a sticker printed with the box's own name says nothing beside it, one printed with another name reads
*sticker reads G78*, and a scan of that one says so as the box opens. A numbered sticker reads its number as before.
The words are `stickerOpening`, `stickerMarksWords` and `placeOutcome` in `stickerPlace.ts`. No migration.

What PR 9 changed from the design, said plainly: the press on a known box keeps the number, *Put 0159 on G12*, as
section 10 writes it. The name on the tape decides which branch the sheet opens on, not whether the site still has
boxes with no sticker. Signed out, a blank named sticker still reads its number, since that page is `box-read`'s
answer and a change there is a deploy that needs Taunya's go by name; it shows no contents either way. **PR 10 is
next.**

2026-11-15: **PR 9 is live.** #8295 merged and the Pages deploy carried it.

2026-11-15: **PR 10, These are on boxes, is built** as v2.7406, the last of section 10's four. A named run with
stickers still blank has **These are on boxes** on its row in the Runs fold, and the phone's On site tab has the same
press under the boxes while the job has stickers not yet on a box. The form asks the names that were stuck on, as the
print window asks them (`G78-150`), how the boxes sit, the place and a where line. It counts ahead from the site: how
many boxes will be made, how many names are boxes already and take their stickers, how many have no blank sticker and
are left. One press, *Put 73 stickers on their boxes*, calls `place_sticker_range` (migration
`20261116153000_place_sticker_range`), which goes through `place_sticker` once a sticker, so the gate, the box rule and
every policy judge it as they judge one scan. The answer is said in sentences: boxes made, boxes that took their
sticker, names left as they were, names no sticker was printed with, and any name the database refused, kept with its
reason while the rest went on. The words are `stickersOnBoxes.ts`; the form `StickersOnBoxes.tsx`.

What PR 10 changed from the design, said plainly: a name no sticker was printed with makes nothing, where section 10
only spoke of names that have one. A box already on the site keeps its kind and its place. The press on the phone
shows whenever the job has a blank sticker, named or numbered, and the form says which names have none. The SQL was
proved by CI's `sticker-names` bed on the PR, since no local Postgres could start on the Mac it was written on. Nothing
was placed on prod in the proof: no named run is minted there yet. **Section 10 is whole. The next step is Taunya's
first named run off the P-touch**, then the walk of the site and PRs 4 to 6.

2026-11-16: **PR 10 is live, and section 10 with it.** #8305 merged at 06:16 UTC. The migration
`20261116153000_place_sticker_range` was pushed two minutes later with `scripts/db-push.sh`, alone, from a checkout at
main, and prod's ledger holds it. Proved on prod as the signed-in dev over a read-only call, nothing written: the
function answers two names with no sticker as `no_sticker`, and refuses a kind that is not one, an empty list and a
name off the box rule in its own words. It runs as the caller, and `anon` may not call it. The types and the dev
seat's catalog file followed as their own small PR. Nothing was minted, printed or placed on prod by the build: prod
still has the one ZZ run of 2026-11-15, so Taunya's first run starts at 0003.

2026-11-16: **the running number is gone**, built as v2.7438. Taunya, shown the named strip with the number small
on its own line, asked what it was for, said she had taken it for the link, and asked *Shouldn't we get rid of that
number and only use that eight-digit link code?* Offered to keep it on stickers with no name, she picked **Drop it
everywhere**. A named sticker now prints its name over the link's two lines, the same shape as a box label. A sticker
with no name prints its code a size up in the name's place. No screen says the number: the print window says no last
run, a run with no names is said by its count, the scan sheet says *This sticker is new* and *Put this sticker on R76*,
the pages a scan opens say *This sticker*, and Scan a label takes the eight characters alone. The number stays in the
database. `box-read` still answers it and the page does not show it; leaving it out of the answer is a deploy that
waits for Taunya's go by name. No migration. `docs/recent-features/v2.7438.md` has the lengths and the picks.

2026-11-16: **the word blank is gone, and the press reserves**, built as v2.7484. The owner opened the window with
Names `G92-200`, read the fold's strips, each over the stand-in address `0000-0000`, and wrote: *when I click on
print blank stickers I am taken to this page where there is no URL for a part. I don't ever want to print a blank
sticker, I want to print a future sticker where me printing it reserves a slot so to speak to be back filled later.*
That is what the database has done since PR 1: the press mints a `box_stickers` row for each sticker, with a code of
its own and its name, and the row waits with no box until a scan or **These are on boxes** says which box it is. The
screens said it badly. So the press and the window are **Print future stickers**, the ask says what the press holds
(*Printing reserves each name and gives each sticker its own link. You say which box it is on later.*), the press
reads *Print 109 future stickers, G92 to G200*, a run that is made says *These stickers are reserved*, the Runs
fold reads *Stickers reserved for this job*, and a reserved sticker scanned with no sign-in reads *This sticker is
reserved for a box*. One name for the idea on every screen and in the guides: **reserved**. In the code and the
database the state is still `blank`, and both mock-ups keep the old name as drawn. No migration. The fold's stand-in
code followed as v2.7486: the strips read `XXXX-XXXX`, which no sticker's code can be, and a line over them, where
the eye lands, says *Each sticker gets its own link when it prints. XXXX-XXXX stands in for it here.* The link is
still given at the press and not shown ahead; reserving first and printing second is the owner's call, drawn in
`docs/recent-features/v2.7486.md`. The job's line for its reserved stickers followed as v2.7487: over the boxes it says how many are reserved, which
names, who printed them and when, with **These are on boxes** beside **Runs**, and a new run opens on the name after
the last reserved one (`nextNameToReserve`) where it opened on the first run's names and met the hold. One thing is
not held and is the owner's call: **Add a container** offers the site's next free name from its boxes alone, so with
G92 to G200 reserved it still offers G92. A box made by hand as G92 takes sticker G92 when it is scanned, so the tape
and the box agree as long as the stickers go on in order. The name of the press is the owner's pick
of the same day: offered *Reserve stickers* and *Print future stickers*, he took the second, his own phrase.

2026-11-16: **the reserved stickers can be printed where they are named**, built as v2.7523. The owner opened the
*Which job?* window, read a card's amber line (58 stickers reserved and not on a box yet, with their names, who and
when) and wrote: *I love that I can see stickers that were reserved, but I don't see any tools to print them?* The
only way was four presses over three screens: **Open the job's boxes**, **Runs**, **Reprint 58 stickers** in the
fold, then the window's own press. So the line now carries the press, *Print the 58 reserved stickers, G93 to G150*,
one for each run that holds some, on the card, on the job's line over its boxes and in the window's ask. It opens the
stickers window on the run and mints nothing; stickers already on boxes are left out, and **From** and **to** reach
them. The words say *reserved* and never *again*, because a run is made at the press and the app keeps no record
that a strip came out. A role that may not print a run sees the press dead with its reason. The line before **Print
future stickers** on such a card says that press reserves new ones. The phone has no such press: it prints no
stickers. One thing was left for its own PR, since it needed a column: recording that a run's
strips went out, so a line can say *None printed yet* where it said *Printed Nov 16*. That was card #373,
built and closed on 2026-11-17 (v2.7564 the column, v2.7567 the screens; `docs/recent-features/v2.7567.md`).
`docs/recent-features/v2.7523.md` has the three answers.

2026-11-16: **a run opened to print has Copies of each**, built as v2.7553. The owner pressed the new press on his
card and the window opened on his run, whose head read *5 strips each*, with no way to see or change that count: the
stepper was in the ask alone. His words: *I need to be able to choose how many copies to be able to print, for example
for each of these I need to print 5.* The window on a run now has the same stepper under **From** and **to**. It
opens on the count the run was made with, one to six, and changes that print only: the run's own count and the count
the device remembers for the next new run are left as they were.
