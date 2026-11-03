---
name: "Photos on a development: in the History by their own time, and a one-row gallery at the bottom"
number: 247
group: gated
status: built and live 2026-11-03 · walked on prod the same day, passed for the office · left the estimator's photos
summary: >
  The owner, 2026-11-02, reading a site's History: the photos the crews upload should show in it, in
  line, placed by their own metadata (the time, the job, who took them), and a development should end
  with a one-row, many-column gallery you scroll through sideways. Today a site's History reads notes,
  stage moves, plans, money and questions and never a picture, and the only photo surfaces are the
  Documents page's Photos tab (every photo, every site) and a job's own strip. Three PRs: the gallery
  as the site's sixth look, the History lines with thumbnails in them, and the time a picture was taken
  read from the file, so a photo uploaded the next morning sits on the day it was shot.
next: >
  The owner's call on what an estimator's Photos look shows (Where it stands, 2026-11-03, has the two
  ways), then delete this card.
size: XS (the words) or S (a read for the estimator), by the call; the train was M + S + S, with no migration
blocker: The owner's call.
ver: v2.6371 · 6373 · 6375
opinion: your call — say so in words now; give estimators the crews' photos only if they should see them, which is an access question
mockup: not required — drawn and shown to the owner before PR 1 on 2026-11-02; the built look on a development replaces it
---

# Photos on a development: in the History by their own time, and a one-row gallery at the bottom (#247)

## The ask, in the owner's words (2026-11-02)

Reading a site's History, 458 lines on a working site with 24 jobs:

> help me add to the punchlist, the need to add photos to the history section of the developments. I think seeing them in line is useful if we base it on their metadata. I think seeing a one row multiple column photo gallery we can scroll through at the bottom of developments would be highly productive.

## What exists today

- **Every uploaded photo is one row of `uploaded_photos`** (punch list #232, v2.6264): the source (a report, a tally box, a checklist answer, a text or an email), the job or the bid, the caption, the stage, who, `taken_at`, the bytes, where it sits (the bucket and path, the Drive file once filed) and the job's and customer's names. The view's policies scope the rows by role; a text's picture reads to the office and the estimator only.
- **Documents → Photos** (v2.6270, `DocumentsPhotosTab.tsx`) lists them newest first across every site, grouped by day, each with its thumbnail, and opens **the viewer** (`UploadedPhotoViewer.tsx`: the full picture streamed and never kept, Previous and Next, the facts, Open in Drive, the source's door, Open the job).
- **A job's own strip** (`src/lib/photos/jobPhotos.ts`, the `job-photos` function): three thumbnails and a *+ N* tile from the job's Drive folder, streamed with the service account through a queue of six, each thumbnail an object URL revoked on unmount.
- **A site's History** (`src/lib/developments/whatChanged.ts` and `history.ts`): one `ChangeLine` per note, send, stage move, plan set, bill, payment and question, each with its time, its verb, its About (a job, a bid, the customer, the site) and who; the chips *Everything · What people wrote · What happened · Plans · Stages · Money · Questions*; the search box; **Write a line**.
- **The page's strip of five looks** (`DevelopmentJumpStrip.tsx`): History, Jobs & bids, Money, Plans, Questions, each with its plain count and, in amber, what needs the leader; the cards below in that order, Questions last.

Nothing joins the two: a photo never reaches a site's History, and a site has no photo surface of its own.

## The thinking

**1. In the History, a photo is a line placed by its metadata, and photos that belong together are one line.** The metadata is already on the row: `taken_at` is the when, the job is the About, who uploaded is the by, the stage and the caption are the words. The rule for the line: photos on the same job by the same person within one hour fold into one line, *Photos · JP629 Rough in · 4 photos · Rough-in · Malachi*, drawn with up to four thumbnails in the line and a *+ N* tile past four. One photo is one line with one thumbnail. A tap on a thumbnail opens the viewer on that photo, with Previous and Next inside the batch. The chip row gains **Photos**; *Everything* includes them. The search box reads a photo's caption, its job and its person like any other line. A text's picture is a line only for the roles the view already lets read it.

**2. The time is the picture's own time, and today that is the upload's.** `taken_at` is stamped when the app receives the file; nothing reads the file's own date (no EXIF read anywhere in the app). For a crew that uploads as it works, the two are minutes apart and the line sits right. For a phone that uploads the next morning on the office Wi-Fi, the line sits a day late. PR 3 reads `DateTimeOriginal` from the file at upload, keeps it as the photo's time when it is present and sane (not ahead of the upload, not years behind), and leaves the upload time as the fallback; a column of its own on each photo table keeps the two apart, and the view reads the taken one first. Later, the same read gives GPS, which can place a photo with no job onto the nearest job of the site, a card of its own.

**3. The gallery is the site's sixth look, at the bottom.** A card **Photos** under Questions, one row, every column a thumbnail, scrolled sideways (the wheel and the trackpad scroll it; on a phone it swipes; the arrow keys move a focused tile), newest at the left, a faint day tick where the day changes (*Nov 1*, *Oct 29*), 60 tiles a read and **Show more** at the right end. Chips above the row: a job picker (*All jobs* and one per job with photos, counted) and the source chips the Photos tab has. A tile opens the viewer with Previous and Next through the row as shown. The jump strip reads *Photos 312 · 9 this week*, so the look counts like the other five and the strip jumps to it. The owner's two surfaces are one read: the History lines and the gallery read the same rows.

**4. Thumbnails come the way the Photos tab draws them, through the queue.** The rows are the view's; the picture bytes stream the way `DocumentsPhotosTab` and the job strip already stream them, through the bytes queue (six in flight, retried, 400 cached), each an object URL revoked when the card unmounts. Tiles load lazily as they scroll into view (an `IntersectionObserver`), so a site with a thousand photos costs the first screenful. If the Photos tab turns out to draw a full-size picture scaled down (to check in PR 1's first hour), PR 1 adds a thumbnail rendition on the way in, never on the way out.

**5. One read, scoped to the site.** `uploaded_photos` filtered by the site's job ids and bid ids, newest first, `limit` 60, plus a head read for the strip's count and a second for *this week*; the History's batches fold on the client from the same rows the gallery holds, so opening the page costs one list read for both. The page already reads the site's jobs and bids, so the ids are at hand.

**6. Who sees what stays the view's rule.** A primary sees their own jobs' photos and no text pictures; the office and the estimator see every source; a reader with no photos sees *Nothing filed yet on this site* with the press that fills it (the job's report), as the empty-state rule says.

## The plan

1. **PR 1, the gallery look.** Kernel `src/lib/photos/sitePhotos.ts` (order, the day ticks, the job counts for the picker, the strip's words) with tests; `DevelopmentPhotosLook.tsx` over the view's read and the existing viewer and queue; the sixth look on the strip and its anchor; the guide *see everything on a development* gains *The photos*. No migration.
2. **PR 2, the History lines.** The batch fold in `whatChanged.ts` (same job, same person, within an hour), the `photos` line kind with its thumbnails and *+ N* tile, the **Photos** chip, the search over captions; the viewer opened from a line. No migration.
3. **PR 3, the taken time.** `taken_at` from the file's own date at upload where present (`report_photos`, the box and checklist photos; a text's picture keeps the message's time), one new column per table and the view reading it first; the migration, its doc, the upload kernels' tests over a file with and without a date.

## The owner's four calls

1. **Where the gallery sits**: the sixth look at the bottom under Questions, as asked (recommended), or a strip under the History card so it reads with the lines.
2. **The batch rule**: same job, same person, within one hour (recommended); or every photo its own line.
3. **Text and email pictures in a site's History**: shown to the office and the estimator as the view allows (recommended), or left to the Photos tab.
4. **PR 3 now or later**: later, after a week of lines (recommended), unless the crews upload in the morning as a habit, in which case it goes first.

## How to verify

PR 1, as the dev on a ZZ Test development with two ZZ Test jobs carrying report photos: the strip reads *Photos N*, the row scrolls sideways with a day tick between two days, the job picker narrows to one job, a tile opens the viewer on that photo and Next walks the row; as an estimator, the look shows only what the view lets an estimator read (a primary cannot open the page). PR 2: the History reads one *Photos* line for four uploads within the hour on one job, with four thumbnails, and two lines for two people; the **Photos** chip narrows to them; the search finds a caption. Delete every ZZ Test row after, the `file_index` rows before the jobs (a job's delete only blanks their link), and move the two ZZ job folders the photo sweep makes in Drive to the trash. PR 3: upload a photo whose file date is yesterday; its line sits on yesterday.

## Where it stands

2026-11-02: the mock-up the card asked for (one History line with four thumbnails, one with a + N tile,
the gallery row with its day ticks, the viewer open, all over made-up data) was rendered at 1280 and
375 and shown with the four calls. No answer came in the session, so calls 1 to 3 stood at their
recommended defaults. On call 4 the owner said *Start PR 3 now*.

- **PR 1, the gallery look: v2.6371 (#6839), merged 2026-11-03.** As planned. The strip reads *Six
  looks*; the page's seam was kept to a few lines because the Gun Dog design spike held the same file.
- **PR 2, the History lines: v2.6373 (#6840).** As planned, and the History legend (v2.6361) gained the
  photos mark. The last PR of the train; this amendment rides in it.
- **PR 3, the taken time: v2.6375 (#6844), merged 2026-11-03.** The file's own `DateTimeOriginal` is
  read before the shrink and written into each table's `taken_at` itself, with **no migration**,
  against the plan above: every table already keeps the upload moment in `created_at`, and
  `uploaded_photos` was being replaced the same day by #244's migration. The fragment
  `docs/recent-features/v2.6375.md` has the why.

Left:

- The walk in *How to verify*, once PR 2 is live. It writes ZZ Test rows on prod, so it waits on the
  owner's word. So far the look and one History line were seen as the dev on a live development
  with a single box photo.
- #244's Job photos window (#6831, open) still stamps the upload's time. One call to `readTakenAt` in
  its capture gives it the camera's time like the other three; that is #244's ground.
- The GPS idea in *The thinking* (a photo with no job placed on the nearest job of the site) is not
  built; a card of its own if wanted.

2026-11-03, the live walk, as the dev on the local dev server built from `main` over prod data, with the
owner's word given in the session:

- **Passed** at 1280 and 375, on a ZZ Test development with two ZZ jobs and twelve made-up report photos over
  three days. The strip read *Photos 12 · 12 this week*. The row drew twelve tiles newest first with the ticks
  *Today*, *Yesterday* and *Nov 1*; the wheel scrolled it sideways, a job chip narrowed it to five, and a tile
  opened the viewer with Next walking the row. History drew one *Photos* line with four thumbnails for one
  person's hour, a separate line for the second person, and a six-photo line with three thumbnails and *+ 3*
  that opened *4 of 6*. The **Photos** chip narrowed History to the four photo lines; *heater* found the batch
  whose printed captions leave it out; nothing scrolled sideways at 375.
- **The taken time passed.** A JPEG whose Exif said yesterday 4:42 PM, sent today through a Tally box, stored
  `taken_at` 2026-11-02 22:42:10Z, sat on *Nov 2 · 4:42 PM* in History, and Drive named it *2026-11-02 … ZZ
  box.jpg*.
- **Not as this card said: an estimator sees no job photos.** `uploaded_photos` joins every job photo to
  `jobs_ledger` under the reader's own rules, and an estimator has no `jobs_ledger` read, so the estimator's
  look reads only the text and email pictures on the site's jobs and bids (checked as the estimator sample
  through the dev seat). On a site full of crew photos it says *Nothing filed yet*. A primary cannot open the
  page at all, so the primary check above never applied. The owner's call, two ways: (a) the words, where the
  estimator's empty look says the crews' photos read to the office (XS); (b) the photos, a definer read for
  the estimator's door as `list_development_overview` is for the jobs (S), if estimators should see the
  crews' photos, which is an access question.
- **For the next walker.** Within five minutes the photo sweep makes a Drive folder tree for each ZZ job under
  *No customer yet* in PipeTooling Jobs, files the seeded photos there, and the file index reads them. This
  walk deleted every row (the `file_index` rows first), both buckets' files and the two job folders, which went
  to Drive's trash; three older ZZ folders under *No customer yet* came from other walks and were left alone.
- PR 3's notes said every photo table keeps the upload moment in `created_at`. `job_box_photos` has no such
  column, so a box photo now keeps the camera's time alone; the v2.6375 fragment and
  `PROJECT_DOCUMENTATION.md` are corrected, and so are `ACCESS_CONTROL.md` and the guide on the estimator.
- Still open beside the call: #244's Job photos window stamps the upload time and can call `readTakenAt`; the
  GPS idea above.
