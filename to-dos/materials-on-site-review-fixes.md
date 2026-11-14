---
name: "Materials on site: what the review found, in the order it would hurt"
number: 344
group: close
status: found 2026-11-13 by a review of Materials → On site (the code, the migrations, the edge side and a read-only walk of the live screens) · four small fixes merged the same day (#7968, #7969, #7970 and v2.7164) · the owner's word the same day (*Yes, build 1 to 4*) · PRs 1 to 4 built and merged the same day (#7986, #7990, #7988, #8019), with the Print labels window made wider on his ask (#8017) · PR 5 built on his word (v2.7240, #8074), LIVE 2026-11-14 on his yes: the migration pushed, `box-read` deployed, the types in #8083 · PRs 6 to 9 built 2026-11-14 on his word (*Please build PR six and the rest of the PR train*): #8088, #8090, #8092 and #8093; #8090 and #8093 merged the same day and `photo-save` was deployed on his yes (*Yes, deploy it*); #8088 and #8092 are open, brought up to date with main and green, out of the merge queue until he says to put them back
summary: >
  The owner asked whether Materials → On site is good to go. The screens load on the real site and
  their totals agree from the desk to the site's tiles to the printed report. What the review found
  is in how a press is kept, not in the arithmetic. A press made with no signal is lost after a
  green toast, and a photo taken with no signal is lost when the phone reconnects. A read that fails
  draws as a true zero on the desk. Any teammate on a job can point a box photo's row at a Drive
  file the public box page then streams. Four defects were fixed the same day. This card lists the
  rest as small PRs in the order they would hurt a person in the field or a number the office
  reads.
next: The owner's word to put #8088 and #8092 back in the merge queue: both left it on a manual request and are up to date with main. His try of a press on a real phone with its radio off, on the ZZ test job, is still owed: it is also the first press to land under PR 5's stamps. Then his look at the desk, and this card retires.
size: L as a train of nine (M · S · S · S · M · S · S · M · S); all nine are built and seven are live; left: PRs 6 and 8 to merge, and the owner's look
blocker: The owner's word to re-queue #8088 and #8092. Nothing else.
opinion: your call — say the word and #8088 and #8092 go back in the queue; then try a press on a phone with the radio off
mockup: not required — PR 1 uses the outbox bar that is already on the phone; no new screen
---

# Materials on site: what the review found (#344)

## The ask

The owner, 2026-11-13: *Can we look at Materials, On site: is there anything left to build in the
punch list for it? If not, can you make a pass and let me know if you think everything was built
well and it is good to go?*

The review read the kernels and their tests, the nine migrations, `box-read`, `photo-save`'s box
sources, the write paths and the guides, and walked the live desk, a whole site, a job in List, By
part and Map, the report in its three readings, the phone's tab and the public box page, at 1,400
and 375 wide, read only. Nothing was written to prod.

## What is sound

- **The arithmetic.** `containerLines`, `countDiffs`, the week window, the 90-day price rule and
  both SQL twins agree with each other. On the real site the desk's row, the site's tiles and the
  paper give the same boxes, lines and pieces, the worth is the sum of its priced lines to the
  cent, and the two jobs' pages add up to the site.
- **The public box page.** It carries no job, customer, address, price, person or Drive id. A
  retired box, a blank sticker and a lost sticker each say only what the label already shows.
- **The fences.** Every on-site table has the four fences. The ledger and the box moves take no
  update and no delete. No function is granted to a signed-out caller.
- **Phone width and dark.** No sideways scroll on any screen walked. The public page holds a long
  stencil, a long part name and a count of four digits.

## Fixed the day of the review

| PR | What |
|---|---|
| #7968 | The store read a job's ledger with `.limit(5000)` and no paging, and the database stops an answer at 1,000 rows without a word. Past 1,000 rows a job would have lost its oldest presses, and the summary function of v2.6743 could never have been asked for. Every on-site read is paged. |
| #7969 | **Count this box** stepped over the next line after a line was counted to none. That line was never shown or counted, and the box still read as counted. |
| #7970 | A job made in the app read as a dash on the desk, the phone and the printed manifest. Every job that holds a box is one. |
| v2.7164 | The Development page's tip named two readings of the report where there are three. The Deliveries panel and its guide said the app reads an invoice from the Drive folder. It does not. The guide now says who a Short request is refused for. |

## The plan, in the order it would hurt

Each row is one PR. *Read* means found in the code and not walked. Line numbers are of `main` at
`3adaa5043`.

### Before a crew relies on it with poor signal

| PR | What is wrong | How a person meets it | Size |
|---|---|---|---|
| ~~1 · presses through the outbox~~ built, #7986 | `addMovement` and every other write in `onSiteStore.ts` lands in the cache, the tab toasts green, and the insert is sent once (`afterWrite`, 349). Nothing queues it. The outbox #163 built for the clock, notes and reports (`src/lib/offline/`) does not carry an on-site press. | With no signal a count shows as saved. A red toast follows, five seconds long, perhaps after the person has walked on. The next good read puts the old number back. If the row did land and only the answer was lost, the toast says nothing was saved, and a second press doubles it, since each press mints a new id. | M |
| ~~2 · a photo taken with no signal~~ built, #7990 | The photo's own row is a plain insert that fails with no signal, so it lives in memory alone (`PhotoPress.tsx` 64, `addPhoto` 487). On reconnect the job is read again and the note is gone, with its **Send now**. The bytes stay in the phone's store. The upload is `upsert: false` with no branch for *already exists* (`photoUpload.ts` 29), which is #338's fault in its 409 form: a send whose answer was lost is refused on every later try. *Read.* | A photo taken in a basement never reaches the job's Drive folder, and nothing says so the next day. | S |
| ~~3 · a failed read is not a zero~~ built, #7988 | `loadJob` keeps its own error, so `loadDesk` succeeds around it (189). The desk never reads `jobLoadState`, so a job whose read failed draws 0 containers and $0.00. `useOnSiteSites` (52) and `usePartTies` (35) swallow a failure the same way: a site reads *across 0 jobs*, and joined names split with no word. *Read.* | The office reads a job as empty when the read failed. | S |
| ~~4 · the store reads again~~ built, v2.7177 | A job or the desk is read once a page session (`loadJob` 126, `loadDesk` 179). Nothing reads again on focus or on opening a box. | The desk left open shows the morning's numbers all day. A second phone caps **Used** at a stale number and offers *40 is right* from it. | S |

### Before the office leans on the numbers

| PR | What is wrong | How a person meets it | Size |
|---|---|---|---|
| ~~5 · what a teammate may change, a migration~~ built, v2.7240 | `job_box_photos_update_own` lets the taker change any column, `drive_file_id` among them, and `box-read` streams whatever file that id names to a signed-out caller through the service account. `job_containers_update` pins no column, so a box's `job_id` can be changed by hand, which is the split v2.6808 closed. The ledger's `by_user_id`, `by_name` and `at` are whatever the phone sends, where `box_sticker_events` stamps them in a trigger. `box-read`'s guess lock turns a miss into a 429 and still answers a hit. | A helper on any job could publish a Drive file whose id they know, or post a backdated count in a teammate's name. None of this is on a screen. It is what the tables allow. | M |
| ~~6 · missing with no price~~ built, #8088 | The desk's **Missing this week** is money alone (`onSiteSummary.ts` 30). A short count of a part with no price adds $0.00, is not amber and sorts last. On the real site 3 of 116 lines have a price. | A job that lost 200 fittings reads $0.00 on the desk. #342 raises the cover; this PR shows the count of short lines beside the money, as the Needs you line already does. | S |
| ~~7 · the price and the fold~~ built, #8090 | `pickBookPrice` refuses only a price under zero, so a 0 or the book's 999,999 stand-in counts as a known price (`bookPrice.ts` 56). `sameWordsKey` joins two fittings when a word sits between their sizes: `1/2 pex x 3/4 mip` and `3/4 pex x 1/2 mip` are one row, as are `4 to 2 reducer` and `2 to 4` (`siteRollup.ts` 103). *Shown by running the kernels.* | Worth reads far too high, or two different adapters share a total on the screen and the paper. | S |
| ~~8 · the Deliveries panel~~ built, #8092 | The pasted-text reader drops `1,000 EA …`, reads `2 1/2" x 10 PVC pipe` as 2 of a half inch, and takes a line total for a unit price (`manifest.ts` 38). **Add N lines** sends lines the press did not count, toasts before any answer and has no guard on the same invoice twice. The office has landed no delivery on prod yet. *Shown by running the reader.* | The first real invoice lands wrong quantities. | M |
| ~~9 · small things on the phone~~ built, #8093 | A line at none with a Can't find on it is never in the count walk, so only the office's **Correct…** clears its flag. The number sheet's field snaps back to 1 when cleared (`TallyOnSiteTab.tsx` 662). Someone signed in but not on the job's team who scans a label is told it *may be from a box that was retired*. The photo sweep takes the oldest 20 unfiled rows with no skip, so 20 stuck photos hold every newer one (`photo-save/index.ts` 264). | Small frictions, each a line or two. | S |

### To check on prod before PR 5

The gate `on_site_can_touch_job` reads `jobs_ledger` under the caller's own RLS or the team list.
Read from the policy text alone: a superintendent or an estimator on a job's team may be refused
until they clock onto it, and anyone who ever clocked onto a job may keep the reach after leaving
the team. **View as** a superintendent on the real site answers it in a minute.

### Nice to have

- The paper counts a place per job (3 on the real site) and the site's tile by name (2).
- The desk counts Unsorted as a container and the site's **Boxes** tile does not.
- *Counted today* is the last 24 hours, not the calendar day.
- `where_note`, the crew's own words, is on the public page. A gate code typed there is public.
- The sign-in's return key never expires, so a shared phone can land on a stale box.
- The kept bytes of a sent photo are never deleted from the phone.
- **Short** is not safe to press twice after a lost answer.
- The dev seat's delivery dry run says the same *before* for two lines of one part (#209's own note).
- The Tally's job pill on its other two tabs reads a dash for a job made in the app.
- A statement timeout (57014) showed twice on the Tally's first load as the dev. Its read was not found.
- `Jobs.tsx` draws the Materials tab for a primary and then sends them to Reports.
- Docs: `ACCESS_CONTROL.md` says places allow update and that a primary reads the desk's money; the Glossary's manifest entry names a `?manifest=` link nothing makes; `JOB_TALLY_ARCHITECTURE.md` lists two tabs; `MATERIALS_TABS_ARCHITECTURE.md` has old line counts and no On site row; the guide for the office hides from the three field roles that get the tab.

## What I would not build

- **An update policy on `box-photos`** to fix PR 2. It lets a person overwrite a photo's bytes, the reason #338 gave.
- **A lock on the count walk across phones.** PR 4's fresh read is enough until two crews count one box.
- **A second queue.** PR 1 is the outbox that exists, with the press's own id as its key.

## How to verify

- Dev server from a worktree, `/dev-login?as=1`. Prod is the only database: a walk that writes uses the ZZ test job's boxes (ZZ1, ZZ2).
- PR 1 and 2: a headless browser that lets the first request reach the office and then drops its answer (Playwright's `route.fetch()`, then `route.abort('internetdisconnected')`), and one with the network off from the start. The press is kept, lands once, and the box's number is right after.
- PR 3: fail one job's read inside the desk load. Its row says the read failed.
- PR 5: the migration on a throwaway Postgres, with a helper's session trying each column.

## Where it stands

2026-11-13: the review is done and its four small fixes are merged. #342 (price what has no price)
and #329's PRs 2 to 6 (stickers) are their own cards and are not repeated here.

2026-11-13, later: the owner said *Yes, build 1 to 4*, and all four are built. Each row above tells
what was wrong; this is what each PR did.

- **PR 1, #7986.** A press is plain data (`onSiteWrites.ts`), written to the phone's store before its
  first send and sent one at a time in the order pressed (`onSiteSend.ts`). With a signal it goes at
  once. With none, or behind a press that waits, it joins the outbox as a tenth kind,
  `on-site-press`, and the replay lands it through the tables' own policies. A resend carries the
  same ids, and an insert that meets its own row counts once. A fresh read of the job draws the
  presses still on their way over it. No migration. Walked at 375 wide on the dev server with every
  on-site write answered by the walk's script: 8 to 7 with signal, then 6 and 5 kept with the signal
  cut, both still drawn after a reload, both landed once and in order when it came back.
- **PR 2, #7990.** A box photo's send that meets its own file in the bucket is a landing, so a send
  whose answer was lost can be made again. A send has 30 seconds. A shot the phone could not keep
  is said as lost. The photo's row rides PR 1.
- **PR 3, #7988.** The desk draws a job whose read failed as *Did not load* with its reason and
  **Read again**, its site's row counts it, and a site's screen names how many of its jobs are not
  on it. A failed read of which job is on which site, and of the joined names, is said. Walked on
  the dev server with one job's reads dropped on purpose.
- **PR 4, v2.7177.** Every on-site screen reads again when the page comes back to the front, the
  signal returns and every five minutes, and the phone when a box is opened. The read is quiet,
  and a kept press stays on the screen through it. It sat on PR 1's store, so it opened once
  #7986 had merged.

2026-11-13, night: all four are on main, with #8017, the Print labels *Which job?* window made 640
wide so a long job name cannot push it into a sideways scroll. PR 1's store test waited a fixed
30 ms for a send and failed under a loaded runner; #8026 made it wait on the sender.

2026-11-13, PR 5 (v2.7240), on his word: four triggers, one helper and one nullable column
(`20261114013000_on_site_teammate_guards.sql`), and `box-read` refusing a locked source a right
guess too. A ledger row and a box move are stamped with the caller and the server's time where the
phone's is ahead, `recorded_at` keeps when a row reached the office, a box photo's Drive columns
are the sweep's and its place in the bucket is its own, and a box keeps its job. Proved on a
scratch Postgres with each trigger switched off in turn; the bed over the whole schema is CI's.
**Live 2026-11-14** on his yes (*Yes, push and deploy*): `supabase db push` applied this one file (the dry run named no other), `box-read` was deployed, and the types are #8083. `check:migration-drift` and `check:edge-drift` read clean. Read only after: the new column reads on prod, null on the rows from before; the box page refuses a malformed code and opens the ZZ test cage. No press was made, so the first real press is what shows the stamps on prod. The check this card asked for first came back
clean for today's teams: the primary on the site's main job and a helper on its second each read
their job's boxes. A superintendent or an estimator on a team is still let in only once clocked
onto the job; none is on a team that holds boxes.

**Not checked by any of the four:** a real phone with its radio off, a real camera, and what the
database answers a resent row. The last is read from Postgres' own rule, a duplicate on the primary
key, and held by tests against a stand-in; the first press that waits and lands on the ZZ test job
proves it on the project.

**Still open from the same rows:** a kept photo waits for a person's **Send now** and is not sent
by itself; the Needs you card leaves out a job whose read failed; two phones can still press
against one box inside the same few seconds.

2026-11-14, PRs 6 to 9, on his word (*Please build PR six and the rest of the PR train*). Each is
its own PR, open and armed. Three are the client alone. PR 9 carries one edge function change.

- **PR 6, #8088.** The desk's **Missing this week** says how many lines came up short under the
  money, and how many of them have no price. A row is amber and sorts up on short lines, not on
  money alone. The site's tile, the job window's chip and the Track caption say the same. Not
  walked in a browser: no job on prod came up short that week, so the live desk had nothing to
  show it on. Held by render tests.
- **PR 7, #8090.** A book price of zero or the 999,999 stand-in is never a price, and the invoice
  price is held to the same rule. A name that holds `x`, `by` or `to` as a word is folded in the
  order typed, so two fittings whose sizes swap ends are two rows, and a decimal keeps its point.
  The cost, chosen: the same two-ended fitting typed in another word order is two rows, which
  **Same part** joins. A row's key is stored with a site's ties and prices; both tables held no row
  when read, so no saved answer was stranded.
- **PR 8, #8092.** The pasted-text reader reads a count with a comma, never takes the 2 of a
  2 1/2 inch size for the count or a part ending in ST for a street, and leaves one figure on a
  line for the office to name as each or the line's total. Lines it could not read are listed, with
  a press to add each by hand. **Add N lines** sends the lines its button counts as one press, says
  one sentence after the answer, and asks before an invoice already on the job lands again. Walked
  read-only on the dev server at 1400 and 375 wide with made-up lines: pasted and read, which
  writes nothing. **Add** was not pressed.
- **PR 9, #8093.** *Count this box* walks a line at none that carries a Can't find, so a count on
  the phone clears the mark. The number field can be cleared and typed over. A scanned code that
  opens no box says the box may be on a job the reader is not on, or retired. The photo sweep takes
  the photos that have not failed first. **The sweep's change does nothing until `photo-save` is
  deployed, on his yes.**

**Not proved by these four:** a real delivery landing through PR 8's one press, since the review
writes nothing on prod, and the sweep's new order on the project, which waits on the deploy.

**Left open, each said in its PR:** a delivery refused part way leaves its first lines landed; an
invoice landed with no number is not known again; the scan page cannot tell a box on another job
from a retired one without a read past the reader's own RLS; the checklist photo source has the
sweep's old read; more than twenty failed box photos with no new ones retry the same twenty.

**Seen in passing, not this card's:** `TallyTeamQueue.render.test.tsx` fails for the hour after
midnight Central. Its fixture texts a charge *an hour ago*, which is then yesterday, and the chip
reads the day with the time.

2026-11-14, later: #8090 (PR 7) and #8093 (PR 9) merged, and the card's own #8094. **`photo-save`
is live** on his yes (*Yes, deploy it*): deployed from main once #8093 was on it, and
`check:edge-drift` reads all 190 functions current. The function boots. The sweep's new order is
read from its text and not yet seen on the project: no box photo is waiting with a reason today
that it could be watched against.

#8088 (PR 6) and #8092 (PR 8) left the merge queue on a manual request before they merged. Each met
one conflict with main in the materials map, where two PRs of the train amend neighbouring lines.
Main is merged into both with both sentences kept, their suites pass, and they wait on his word to
go back in the queue, one at a time.

All four went red once on `TallyTeamQueue` and `ReceiptStateTables`, the two tests that fail for the
hour after midnight Central. A re-run after the hour passed. Another session has that fix.

