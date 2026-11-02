---
name: "Job photos: a camera icon on the Pipeline row and on the Job Mode card opens one window that adds a photo with its description and browses every photo on the job"
number: 244
group: ready
status: planned 2026-11-02 — the card, the self-critique and the mock-up; the owner took all eight calls as recommended the same day; nothing built yet
mockup: to-dos/job-photos/mockup.html
summary: >
  The owner likes the Pipeline row's Job folder icon and wants a photos icon beside it: a window
  that works like the report's photo upload, where anyone adds a photo to a job with a few words
  that can be found later, and where the office and the field browse the job's photos. Today a
  photo reaches a job only on a report, a Tally box, a checklist answer or a text, and the only
  per-job browse is the job window's strip, which reads Drive and knows no words. The plan: one
  Job photos window (Add and Browse as two faces of it), opened from a camera icon after the Job
  folder icon on every Pipeline row and the phone card's ⋯ sheet, from a Photos line on the Job
  Mode card for the field, and from the job window's Photos section; a new `job_photo_notes` row
  per photo (the job, the stage, the description, who, when) filed by the same sweep into the
  same Drive folder as a report's photo, listed on Documents → Photos as a fifth source.
next: PR 1, the ground: the migration, the kernel and the io, the shot-tile hook lifted from the report form.
size: M as a train of five PRs (S · S · M · S · XS); one migration (a table, a bucket, a view branch, a cron clause); two edge functions redeployed (photo-save, job-photos)
blocker: None. The calls are made; the train starts with PR 1.
opinion: build it as one window with two faces, not a modal that only uploads; put the field's door on the Job Mode card, not the Pipeline; keep a job photo quiet (a thread line, no push) so it never competes with Leave report
---

# Job photos (#244)

## The ask

The owner, 2026-11-02: *"We really like how a user can see files from the Jobs Pipeline. Next to
that entry point we would like to add a photos icon and a modal that works just like the reports
photo upload, where we make it very easy for a user to upload a photo to a job and leave a text
description that can be referenced later, and we want to make it easy for a user to browse job
photos if they are office or field staff. Help me come up with a plan and user flow, and then,
after asking yourself whether this is the best we can do, build a mock-up and present me the
mock-up and the user flow."*

## What the app has today (verified 2026-11-02)

**Four ways a photo reaches a job, none of them "just a photo".**

| Door | Who | What it carries | Where it lands |
|---|---|---|---|
| **Leave report** (`AdditionalReportModal` over `hooks/useReportPhotos.ts`, punch list #189 and #229) | every role, camera-first on a phone for the field roles, an *Add a photo* tile at a desk | the report, the stage it shows (chips), a checklist question it answers; the caption is the stage's name or the report's first words | `report_photos` → the `report-photos` bucket → the sweep files it in the job's Customer Pictures folder |
| **The Tally's On site tab** (`PhotoPress`, punch list #209) | the crew | the box it shows | `job_box_photos` → `box-photos` → the same folder |
| **A stage checklist's question** (punch list #164) | the crew | the question it answers | `stage_checklist_answers` → `stage-checklist-photos` → the same folder |
| **A text or an email** (Messages, cut 10) | a customer, a GC | the line it came on | `message_attachments`, copied to the same folder when the job's tick is on |

A report's photo is the one that comes with words, and the words are a report's: a type, a
percent, a push to every subscriber, an email, a thread item. There is no way to put a photo on a
job with a sentence and nothing else. The office, when a tech texts them a picture of a cracked
flange, either types a Note report around it or drops the file into Drive by hand, where it has
no words at all.

**Browsing today is two surfaces, neither per job with words.**

- **Documents → Photos** (`DocumentsPhotosTab.tsx` over `lib/photos/uploadedPhotos.ts`, v2.6270)
  lists every photo the app uploaded across every job, newest first by day, with the source chips
  (All · Reports · Tally boxes · Checklists · Texts & email), a search over the caption, the
  person, the job and the stage, and `UploadedPhotoViewer` with the facts and *Open in Drive*. It
  is the office's list. A field user sees it only if they open the Documents page, which the
  roles rarely do.
- **The job window's Photos strip** (`JobPhotosStrip` under the address, `JobPhotosViewer`,
  v2.6090) and its Documents tab's **Photos** line (v2.6272) read the job's two Drive photo
  folders live through `job-photos`: every picture, including one dropped in by hand, but only
  the file's name, so *2026-10-29 Luis Ortega · Rough In.jpg* is all a reader gets. The strip is
  three thumbnails and a *+ N* tile; the viewer pages the folder.
- **The Pipeline row** has the Job folder icon (v2.6301) and the plans icon (v2.6344) after Share;
  the phone card's ⋯ sheet has a *Job folder* line. Neither names photos.
- **The Job Mode card** (the field's whole screen) has Leave report, Turnaway, On my way, % done
  and Clock out. No photo door of its own.

**What is already right and stays.** The phone shrinks a shot to the office's size
(`lib/photos/shrink.ts`); the bytes go to a private bucket the moment the shot is shrunk, with a
row; Drive is the home and the bucket a waiting room; the `photo-save` sweep is one function with
a `WaitingSource` per table, so a new table is one more source; `uploaded_photos` is one view
over the tables, so a new table is one more branch and Documents → Photos lists it for free;
`photoBytesQueue` keeps a hundred tiles from flooding the gateway; `UploadedPhotoTile` already
knows to read a waiting shot from its bucket and a filed one from Drive; the gate
`can_report_stage_progress(job_id)` already says who may see and add a job's photos (the office,
or a field user on the job's team, clocked in on it, or under the sub rule).

## The design

### The idea: one Job photos window with two faces, four doors into it

A photo on a job with a few words, from anyone, in two taps, and the job's photos as one grid
with those words under them. Not a modal that only uploads: a person who opens it to add a photo
sees what is there, and a person who opens it to look finds the Add press at the top.

### The flow at a desk

1. Jobs → Pipeline. The row's icon cluster reads Share · **Job folder** · **Photos** · Plans. The
   Photos icon is a camera, amber like the folder when the job has a Drive folder and grey when
   it does not; its title says *Photos — the job's photos, and add one with a description*.
   A ⌘-click opens the Customer Pictures folder in Drive, as the folder icon does.
2. The click opens **Job photos** (a `ResponsiveModalShell`, 720 px at a desk), headed by the job
   (*Cedar Ridge Townhomes Phase 2 · JP1077 · 2208 Live Oak Dr*). Under the head: the **Add a
   photo** tile at the left of the first row, then the job's photos by day, newest first,
   each tile with the day stamped on it. Under the grid, a search box: *Find a photo on this
   job: words, a person, a stage*. A foot line: *In Drive: Customer Pictures · Open ↗*.
3. **Add a photo** opens this computer's file picker (several at once). Each chosen photo is a
   tile at the top in the Add face: the thumbnail, *4.2 MB → 310 KB · 1600 px* as the shrink
   finishes, *Sending…* then *Sent*, and under it the **description box**, *What does this
   show?*, and the stage chips the report form already draws (*This photo shows · Rough In ·
   Top Out ·Trim Set*) on a job with two or more lines. With several photos, a quiet press under
   the first box, **Use these words for the rest**, copies its description down.
4. The press reads **Add 2 photos to the job** (from `countedLabel`), dead while a shot is still
   on its way, never *OK*. It writes the description, the stage, who and when onto each row;
   the tiles slide into the grid under *Today*; the window stays on the Browse face with the new
   tiles first. A description left empty is allowed; the tile then reads *No description*.
5. A tile opens the **viewer**: the picture at full size, the description as the title, then
   *Mateo Ruiz · Today 2:41 PM · Rough In · Job photo*, Previous and Next through the grid as
   shown, **Open in Drive**, **Open the job**, and the source's door when the photo came with a
   report, a box or a text (*Open the report*). The description is editable in the viewer by its
   taker and the office (**Edit the words**), since the words are what makes it findable later.

### The flow on a phone, for the field

Field staff rarely see the Pipeline. Their screen is the Job Mode card on the Dashboard.

1. The Job Mode card's details gain one line, **Photos · 14 ▸**, under the address with the job's
   other facts. The number is the job's photo count from one read; a job with none reads
   **Photos · add the first ▸**.
2. The line opens the same Job photos window as a full-height sheet. The **Add a photo** tile for
   the field roles carries `capture`, so it opens the camera, as Leave report does; the gallery is
   one tap further on the phone's own sheet.
3. After the shutter the tile shows the shot shrinking, then the description box with the
   phone's keyboard up and the stage chips at 48 px under it. One tap on **Add 1 photo to the job**.
4. The Pipeline's phone cards, for the office on a phone, get a **Photos** line in both ⋯ sheets
   after *Job folder*, so a phone is never a dead end.

### What a photo carries

| Fact | Where it lives | Who sets it |
|---|---|---|
| the job | `job_photo_notes.job_id` → `jobs_ledger` | the door it was opened from |
| the description | `description` (up to 500 characters) | the person, in the box; editable later in the viewer |
| the stage | `fixture_id` + `stage_name`, as `report_photos` holds it | a chip, optional |
| who | `by_user_id`, `by_name` | the sign-in |
| when | `taken_at` | the shutter, else now |
| its sizes | `bytes`, `original_bytes`, `width`, `height` | the shrink |
| where it waits | `storage_path` in the `job-photo-notes` bucket | the send |
| where it lands | `drive_file_id`, `filed_at`, `fail_why` | the sweep, within five minutes |

In Drive the file is named the way every photo the app files is named (`photoDriveName`):
*2026-11-02 Carla Nguyen · Cracked flange under the second lav.jpg*, the description's first
words as the caption, so even a person browsing in Drive reads the words.

### Browsing, for the office and for the field

- **The grid** is the job's Drive photos (`job-photos` → `list`, what the strip reads: every
  picture in Customer Pictures and Team only › Photos, a hand-dropped one included) with our own
  rows laid over them by Drive id (`uploaded_photos` where `job_id` is the job) for the words,
  the person and the source, plus our rows still waiting in a bucket first, marked *on its way
  to Drive*. A photo with no row of ours reads its file name and *Added in Drive*.
- **The words under a tile**: the description's first line, else the stage, else the caption
  the source gave it (*Rough In*, *Box 3 of 7*, *From Dana's text*). The day on the tile.
- **The search box** narrows the grid as typed: the description, the person, the stage, the
  source's words. Two characters start it. The empty result says *No photo on this job matches
  'flange'. Clear the search ▸*.
- **The chips** above the grid, only when the job has more than one source: All · Job photos ·
  Reports · Tally boxes · Checklists · Texts & email (the Documents page's `sourceChips`, the
  Texts chip for the roles that may read them).
- **The field** sees the same window from the Job Mode card; the gate is the job's
  (`can_report_stage_progress`), so a tech sees the job they are clocked in on, every photo on
  it, every source. Documents → Photos stays the office's list across jobs and gains a
  **Job photos** chip.
- **Empty**: a job with no photo reads *No photos on this job yet. Add a photo ▸ puts the first
  one here, with the words you give it.* (`EmptyState`, kind make). A job with no Drive folder
  yet still adds: the row waits in the bucket, the sweep makes the folder before the first photo
  lands (v2.6284), and the tile reads *on its way to Drive*.
- **A read that fails** draws `OfflineRetryPanel` with the reason and Retry.

### What stays quiet

A job photo files no report, moves no percent, sends no push and no email. It writes one line
on the job's thread (*Carla Nguyen added a photo · Cracked flange under the second lav*), so the
thread tells the whole story of the job, and that is all. When the photo is news the office must
act on, the person uses Leave report, which takes photos too; the guide says which to use when.

## Is this the best we can do? (the self-critique, 2026-11-02)

**The Pipeline icon: a window of its own, or the job window's Photos section with an Add press?**
The job window already has the strip, the viewer and a Photos section, and v2.6301 taught the
folder icon to open the window on a tab. Routing the camera icon to the Documents tab would be
one PR. Rejected: the job window is the heaviest thing in the app (seven tabs, the whole job),
the Photos section there is one line, and the strip's viewer knows only file names. The owner's
words are *very easy*: two taps to a photo with words, from a row. A window of its own gets
there, and the job window's Photos section opens the same window, so the job window is not left
behind. Picked: its own window, mounted from four doors.

**The field: the Pipeline, or the Job Mode card?** The owner's ask names the Pipeline. Field
roles land on the Dashboard with the Job Mode card and rarely open Jobs. A camera icon only on
the Pipeline would be built for the office and never found by a tech. Picked: the Job Mode card's
Photos line is the field's door, in the same train, and the Pipeline icon is the office's. The
window is one component either way.

**But the field already has a camera-first Leave report. Is a second camera door one too many?**
This is the real question. Leave report is for news: it files a report, pushes the subscribers,
emails, moves the thread, asks a percent. A tech who wants to leave a picture of the water heater
serial plate for the office to find later should not have to file a report, pick a type and
dismiss a percent, and the office should not get a push for it. The two doors differ in what
happens after the shutter, and the words on each say so: *Leave report* and *Photos*. Picked:
both, and the guide draws the line in one sentence: *a report when the office should hear it
now, a photo when it should be findable later*. Weighed and dropped: folding a *just a photo*
switch into Leave report (one more decision on the form that every report would carry).

**Free text, a chip set, or both?** Free text alone is what the owner asked for (*a text
description that can be referenced later*) and it is what search finds. Chips alone (the stage,
a kind such as *Before · After · Problem · Serial plate*) are faster on a phone and group well,
but every job's photo is different and a chip set the office did not write goes stale. Picked:
both, lightly: the description box first, and the stage chips the report form already has (the
job's own lines, nothing to maintain), optional. A kind chip set is left out until the owner
asks; the description's first word does that work (*Before: …*).

**Tie it to a stage or a report?** A stage, optionally, because the job's lines are there and
the report photos already do it, so the sweep names the file by it and the search finds it. Not
a report: a photo that belongs on a report goes through Leave report. Not a checklist question:
that is the report form's job too.

**Is a modal right on a phone?** `ResponsiveModalShell` is the house pattern: a window at a
desk, a full-height sheet on a phone with the close at the top. The viewer uses it already. The
camera opens from the tile in the same tap, as the report form does. Picked: yes.

**A new table, or widen `report_photos`?** `report_photos` has the right shape minus the
description, but its rule is *a row with no `report_id` is an unsaved form and is discarded*,
and its sweep files only saved reports' photos. Widening it means a `kind` column and every rule
branching on it. Picked: `job_photo_notes`, the same shape plus `description`, its own bucket,
one more `WaitingSource` in the sweep and one more branch in the view. The hook that owns the
tiles is lifted from `useReportPhotos` into a generic shot-tile hook both forms mount, so the
shrink, the send, Retry and Remove are written once.

**Should the Pipeline icon carry a count?** It would need one batched read per visible page of
rows (as the plans icon's `usePlanSetsByJob` does). Left out of the train: the icon is a door,
the count is inside, and the field's line on the Job Mode card does carry it, where one job is
on screen.

**No signal.** #229's queue keeps a report's photos on the phone and sends them when the signal
is back. A job photo should ride the same outbox. It is one more press kind in `lib/offline`,
and it is the last PR of the train, as it was for #229, so the window ships first with today's
honest rule (the tile stays with Retry) and the queue follows.

## The owner's calls

**Made 2026-11-02: the owner took all eight as recommended** (*Take all defaults*). The alternatives stay listed so the next reader knows what was weighed.

1. **Where the Pipeline icon opens.** Recommended: the Job photos window of its own, with the job
   window's Photos section opening the same window. Alternative: the job window's Documents tab
   with an Add press on its Photos line (one PR, no new window, no words under the photos).
2. **The field's door.** Recommended: a *Photos · N* line on the Job Mode card, in this train.
   Alternative: the Pipeline only, and the field keeps Leave report.
3. **The description.** Recommended: a free-text box per photo, optional, with the stage chips
   under it, editable later in the viewer. Alternatives: required (no photo without words);
   a kind chip set (*Before · After · Problem · Serial plate*) beside the stage chips.
4. **Which Drive folder.** Recommended: Customer Pictures, where a report's photos land
   (`photoFolderFor`), so the job has one photo folder. Alternative: Team only › Photos, if a job
   photo is for the team and the Customer Pictures folder is meant to be shown to customers one
   day.
5. **Who is told.** Recommended: one line on the job's thread, no push, no email. Alternatives:
   nothing at all; or the report push's subscribers get *Carla added a photo to JP1077*.
6. **Several photos at once.** Recommended: a description box per photo with *Use these words
   for the rest* under the first. Alternative: one box for the batch.
7. **Editing the words later.** Recommended: the taker and the office roles may edit a photo's
   description in the viewer; the Drive file is renamed by the sweep's next pass. Alternative:
   the words are fixed once added.
8. **No signal.** Recommended: the queue as the train's last PR. Alternative: the tile stays with
   Retry until the signal is back, and the queue waits for a later card.

## Where it plugs in

- **Exists, reused:** `StagesRowActionButtons.tsx` (one component per icon; the new one sits
  after `StagesJobFolderButton`), the two desktop clusters in `JobsStagesTable.tsx` and
  `StagesUnifiedJobRow.tsx`, the ⋯ sheets in `JobsStagesCardList.tsx`, `ResponsiveModalShell`,
  `hooks/useReportPhotos.ts` (lifted into a generic shot-tile hook), `components/reports/
  ReportPhotoTiles.tsx` (the tile and the stage chips), `lib/photos/shrink.ts`,
  `lib/photos/photoBytesQueue.ts`, `UploadedPhotoTile`, `UploadedPhotoViewer` (gains the
  description as its title and *Edit the words*), `lib/photos/uploadedPhotos.ts` (`sourceChips`,
  the day groups, the search filter), `lib/photos/jobPhotosIo.ts` (`listJobPhotos`),
  `job-photos` (`list` and `files` match a fifth source), `photo-save` (`sweepWaiting` with a
  fifth `WaitingSource`), `_shared/gcKernels/lib/photos/photoName.ts` (`photoDriveName`),
  `EmptyState` and `emptyWords`, `OfflineRetryPanel`, `batchWords`' `countedLabel`,
  `can_report_stage_progress`, the Job Mode card's details section, the job thread's line
  writer, `lib/offline/keptPhotos.ts` and the outbox.
- **New:** the migration (`job_photo_notes`, its gate as `report_photos` has it plus an update
  policy for the description by the taker and the office, the `job-photo-notes` bucket, the fifth
  branch of `uploaded_photos` with `description` as its caption, the cron's fifth clause, the
  three `apply_*` blocks), `lib/photos/jobPhotoNotes.ts` (the row shape, the words, the grid's
  merge of Drive's list and our rows, the search, pure) and `jobPhotoNotesIo.ts`,
  `hooks/useShotTiles.ts` (lifted), `components/photos/JobPhotosWindow.tsx` (the two faces),
  `StagesPhotosButton`, the Job Mode card's Photos line, the thread line's words, the guide
  *add a photo to a job and find it later*.
- **Docs:** `docs/EDGE_FUNCTIONS.md` (photo-save's fifth source, job-photos' match), the
  Glossary's *Report photos* and *Where files go* entries, `docs/JOBS_STAGES_TAB_ARCHITECTURE.md`
  (the icon), `docs/ACCESS_CONTROL.md` (who adds, who edits the words), the migration doc.

## The plan

| PR | What | Size |
|---|---|---|
| 1 | The ground: the migration (table, gate, bucket, view branch, cron clause, the three applies), its doc, the kernel and the io, the generic shot-tile hook lifted from `useReportPhotos` with the report form's tests still green; `chore(types)` after the push. | S |
| 2 | The sweep's fifth source and `job-photos`' match of it; redeploy both after the merge. | S |
| 3 | The Job photos window (Add and Browse, the viewer's title and *Edit the words*, the search, the chips, the empty state), the Pipeline icon in both clusters and the ⋯ sheets' line, the guide, the Documents → Photos chip. | M |
| 4 | The field: the Job Mode card's Photos line with its count; the job window's Photos section opens the window; the thread line. | S |
| 5 | No signal: a job photo rides the outbox as a report's photos do (call 8). | XS–S |

PR 1's migration is pushed before PR 3 merges (`check:calls-ahead` labels PR 3); PR 2's two
functions deploy right after its merge.

## How to verify

Live on clicktooling.com as the dev through the pane's login, on a ZZ Test job only, every row
deleted after and the Drive files removed from the ZZ Test customer's folder:

1. Pipeline, the ZZ Test row: the camera icon after the folder icon, amber; the title; a click
   opens Job photos with the empty state naming Add a photo.
2. **Add a photo**, two files, a description on the first, *Use these words for the rest*, a
   stage chip on each, **Add 2 photos to the job**; the tiles land under Today with the words.
3. A tile opens the viewer with the description as the title and the facts; **Edit the words**
   changes it; Next pages to the second.
4. Within five minutes the tiles read *In Drive* and the Customer Pictures folder holds
   *2026-11-02 <dev> · <the words>.jpg*; the job window's strip shows both.
5. Documents → Photos lists both under **Job photos**; the search finds the words.
6. The phone preset, Job Mode on, clocked in on the ZZ Test job: **Photos · 2 ▸**, the sheet, Add
   a photo opens the camera's picker, one shot, the words, **Add 1 photo to the job**.
7. The job thread shows the lines. No push, no email went (the function's log).
8. The browser offline: Add a photo keeps the tile with Retry (PR 3) or *Kept on the phone* (PR 5).
