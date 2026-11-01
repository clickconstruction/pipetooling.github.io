---
name: "Photos on every report: the desk's form, Turnaway, Edit report, every reader, the email and the queue"
number: 229
group: close
status: built 2026-11-01 — the six PRs (#6682, #6690, #6684, #6691, #6687, #6695), the fix #6699 and the closing docs PR on main the same day; walked live on the dev server and on clicktooling.com at desk and phone width; left: the owner's look at the screenshots, then delete the folder
mockup: to-dos/report-photos-everywhere/mockup.html
summary: >
  The owner wants a person to leave photos on their reports the way the Job Parts Tally's On site
  tab takes photos of a box. Half of it shipped with punch list #189: the per-job Leave report form
  takes photos for every role, the shots go to the report-photos bucket and the photo-save sweep
  files them in the customer's Drive folder, and the report card shows them. What is left is every
  other door a report goes through. The desk's New report form on the Reports tab, the Stages tab
  and the Dashboard's Job Report square takes no photo at all. Turnaway takes none, though a
  locked gate is the photo the office wants. Edit report shows none and adds none. The Dashboard's
  Recent reports rows, the Reports tab's grouped rows and the job window's thread draw a report's
  words by hand and never its photos. The report email and the push say nothing about them. And a
  report with photos never waits on the phone with no signal. The plan lifts the one photo block
  that exists into a hook and mounts it on every form, puts the one photo strip on every reader
  with a count on the folded rows, attaches the photos to the email, and lets a kept report carry
  its shots through the offline queue.
next: The owner's look at the live screenshots in the session's report; then delete the folder.
size: M as a train of six PRs (S · XS · S · S · S · M) plus a fix and a closing docs PR; no migration anywhere, the queue PR raised the outbox's IndexedDB to version 2
blocker: The owner's look.
opinion: built as recommended, the four calls made as the card proposed; the queue PR is still the one worth the owner's eye, since a photo kept on a phone is bytes the app holds until the signal is back
ver: v2.6255 · v2.6256 · v2.6260 · v2.6262 · v2.6263 · v2.6265 · v2.6273 · v2.6277
---

# Photos on every report (#229)

## The ask

The owner, 2026-11-01: *"I want to give user the ability to leave photos on their reports just
like we have photos in the job tally on site section of the app. can you help me come up with a
way to offer this, create a plan, then create a mockup, ask yourself this is the best we can do,
then build what that plan offers, then once it is complete and tested live show me screenshots of
what we have built?"*

## What the app has today (verified 2026-11-01)

**What shipped.** Punch list #189 built most of the photo path in the last three days:

- **The per-job form, `AdditionalReportModal`** (*Leave report* on the Job Mode press bar, the
  job window's bars in both windows, the Dashboard's Your record card, the clock-out review, the
  Dispatch home, the *Reports for this Job* window) carries photos for every role on every report
  type (v2.6083). On a phone for the field roles it opens on the camera; at a desk, and for the
  office on a phone, an **Add a photo** tile sits under the report type. Each shot is shrunk on the
  device to the office's size (Settings → Jobs & billing → Photos), sent to the private
  `report-photos` bucket with a row in `report_photos`, placed on a stage by a chip, and since
  v2.6219 can answer a stage checklist question. Save ties the shots to the report and adds the
  photos' clause to **Stage progress**. The `photo-save` sweep files each into the job's Photos
  folder in Drive within five minutes, named by day, sender and stage, and deletes the bucket
  copy; a job with no Drive folder keeps the shot in the bucket marked *not in Drive yet*.
- **The card, `ReportDetailBody`**, draws `ReportPhotosStrip`: a thumbnail for a waiting shot, a
  Drive door for a filed one. Four windows read a report through it: `ReportViewModal` (the
  Reports tab's feed card press and Settings' My reports), `JobReportsModal`,
  `BidBoardFieldReportsList` and `ProjectsJobHistoryDayModal`.
- **The Tally's On site photos** (punch list #209, v2.6039/6045) are the same shape one table
  over: `job_box_photos`, the `box-photos` bucket, the same sweep, `PhotoPress` with its
  `CameraGlyph`, `materials/photoShrink.ts`. The report photos reuse its glyph and its page-canvas
  shrink. There is nothing to rebuild there.

**The gap, door by door.** Every role may file a report (`canLeaveJobFieldReport` names all nine),
so the gap is not a role. It is every door that is not the per-job form:

| Door | Who goes through it | Today |
|---|---|---|
| **The desk's New report form, `NewReportModal`** | the office on the Reports tab's *New report*, the Stages tab's row report, the Dashboard's Job Report square for anyone with Job Mode off | No photo tile at all. It also reports on a project or a bid, which `report_photos.job_id` (NOT NULL → `jobs_ledger`) cannot hold. |
| **Turnaway, `TurnawayModal`** | the crew from the press bar and the desk form's door | A reason, a note, no photo. The locked gate or the empty lot is the proof the office wants for the trip charge. |
| **Edit report, `ReportEditModal`** | the author within the edit window, from the Dashboard's Recent reports and Settings → My reports | Shows the fields only. No photo is seen, added or taken back. |
| **The Dashboard's Recent reports** (`DashboardRecentReportsSection`) | the office's first read of every report | The expanded row draws `field_values` by hand; no strip, so the office never sees a photo there. The folded row gives no sign a photo exists. |
| **The Reports tab's grouped rows** (`JobsReportsListView` → `groupReportRow`) and its feed card's preview | the office | The row draws the fields by hand, no strip; the card's two preview lines say nothing of photos. |
| **The job window's thread** (`JobThreadNotesPanel`, `JobActivityView`) | everyone who opens a job | A report item lists its field lines by hand. No strip, no count. |
| **The report email** (`send-report-email` → `_shared/fieldReportEmail.ts`) | every subscriber, including an outside address such as a GC | Fields only. The email goes at Save, before the sweep files anything, so no Drive link exists yet either. |
| **The push** (`send-report-notification`) | everyone opted in for that report type | *Luis submitted a Status Report for J1042*, no count. |
| **No signal** | a tech on a weak site | A report with photos never queues (`allowed: false` in the form): it stays open with Retry until the signal is back. #189's PR 7, the photos through the queue, was held for #163's PR 3, which has since shipped (v2.6100). |

Two smaller facts: a report deleted by a dev leaves its photo rows with `report_id` null and the
bucket objects in place (`ON DELETE SET NULL`), and `ReportPhotosStrip`'s read is gated by
`can_report_stage_progress(job_id)`, so a primary reading a report in the customer summary sees
no strip.

## The design

### The idea: one photo block, one photo strip, mounted everywhere a report is written or read

The per-job form holds the only photo block: the camera input, the tiles, the shrink, the send,
the stage chips, the discard on close, the attach at Save. The plan lifts that state into one hook,
`useReportPhotos`, that any form mounts with a job id, and keeps the per-job form's behaviour
byte for byte. The reader side already has one strip; the plan mounts it on every reader that
draws a report's words by hand, and gives the folded rows one count from one batched read.

### A. The desk's New report form takes photos on a ledger job

Under **Report type**, the same **Add a photo** tile the per-job form shows at a desk, with the
same tiles, the same stage chips on a job with lines, the same Save words. The file picker at a
desk; on a phone the input carries `capture` for the field roles, as the per-job form decides. A
report on a project or a bid shows no tile and one quiet line: *Photos ride on a job's report.* The
job search, Copy to Text and the Turnaway door stay as they are. Copy to Text names the photo
count at the end so a pasted report says *2 photos on the report*.

### B. Turnaway takes a photo

A camera tile under the reason chips, the same hook. The photo's caption is the reason (*Locked
gate*), so the Drive file reads *2026-11-01 Mateo Ruiz · Locked gate.jpg*. Save attaches as the
per-job form does.

### C. Edit report shows the photos and takes more

Under the fields, the report's photos as the card draws them, then the tile to add more. A photo
already on the report stays: Drive is its home, and the sweep may have filed it. Removing a filed
photo is done in Drive; the form says so in one line.

### D. Every reader shows the photos

- The Dashboard's Recent reports expanded row, the Reports tab's grouped rows and the job
  window's thread mount `ReportPhotosStrip` under the words.
- The folded rows, the feed card and the thread item carry a count, *📷 2*, from one read per
  list (`photoCountsByReport(ids)`: one `select report_id` over the ids, counted on the client),
  never one read a row.
- The strip reads nothing for a report with no photos, so every old report draws as it did.

### E. The email and the push carry the photos

The email attaches the photos (the sweep has not filed them when the email goes, so the bytes
come from the bucket with the service role, at most ten and under 8 MB in all), with a line
*Photos · 2* naming each by stage and sender; a photo past the cap is named without its file.
The push body gains *· 2 photos*. Both functions redeploy by the lead after the merge.

### F. A report with photos waits on the phone

The outbox keeps the shrunk bytes beside the press (a `photos` store in the same IndexedDB,
keyed by photo id), the bar counts them (*1 report · 2 photos waiting to send*), and the replay
sends each photo's bytes and row, then the report, then the attach, in that order, with the same
ids every try so a resend counts once. The form's Save reads *Save report · 2 photos* and the
report closes with *Kept on the phone* as a report without photos does today. A photo that
cannot be kept (no IndexedDB, quota) keeps today's rule: the form stays open with Retry.

## The owner's calls

1. **A report on a project or a bid.** Recommended: no photo there yet, one quiet line says so.
   The alternative widens `report_photos` with `bid_id`/`project_id`, a new gate, and teaches the
   sweep a bid's Drive folder: a PR with a migration, worth its own card if bid walks want photos.
2. **Taking a photo back from a saved report.** Recommended: not on the Edit form. The delete
   policy allows only an unsaved row, and a filed photo lives in Drive. The alternative is a
   policy that lets the author delete within the edit window and a sweep that deletes the Drive
   file, which is a migration and an edge change.
3. **The email: attach the photos, or name them with a Drive link.** Recommended: attach. The
   email goes at Save, minutes before any Drive link exists, and a GC on a subscription wants the
   picture in the mail. The cap keeps the mail under 8 MB.
4. **The queue.** Recommended: build it last in this train, as its own PR, since it changes what
   the phone keeps. The alternative keeps today's rule, Retry until the signal is back.

## Is this the best we can do? (the self-review, 2026-11-01)

**Simpler shapes weighed.**

- *Route every door through the per-job form.* The desk's New report form could open
  `AdditionalReportModal` once a ledger job is picked. Rejected for now: the desk form owns the
  job search, Copy to Text, the Turnaway door and the project and bid subjects, and the two forms
  are 1,800 lines together. A merge is a decomposition card of its own, not this one.
- *A photo as a template field type.* The office would pick which report types carry photos.
  Rejected: the table is keyed to the report, not a field, every type benefits, and the owner's
  words are *the ability to leave photos on their reports*.
- *A gallery instead of a strip on the thread.* The job window already has #164's Photos strip
  under the address, reading Drive. A report's own photos on its item are what tells the office
  which report the picture came with. Both stay.

**What the Tally pattern gets right, kept.** The bytes go up as soon as the shot is shrunk and
Save only ties them; the bucket is a waiting room and Drive is the home; the row keeps the
Drive id and the reason it is not there yet; the sweep is one function with one more source; the
card says where each photo is in words. None of that changes here.

**A crew member on a weak signal.** Three things they need: the shot must not be lost, the form
must not trap them, and the bar must say what is waiting. F gives all three. Until F lands, the
rule is today's: Save waits and Retry stays, which is honest but traps the tech on site. That is
why F is in the train and not a leftover. What F does not do: keep a full-size photo. The shrunk
copy is what waits, about 300 KB a shot, so ten shots are 3 MB on the phone, well inside
Safari's quota.

**What a reader sees.** The office reads a report three ways before they ever open its card: the
Dashboard's Recent reports, the Reports tab's rows, the job window's thread. D puts the photos on
all three and a count on the folded rows, so the office never has to open a card to learn a photo
exists.

**What is not built, by design.** A photo on a project or a bid report (call 1). Taking a photo
back from a saved report (call 2). A sweep for photo rows left with no report (a form closed
mid-send, a deleted report): one SQL cron, a leftover named here. The strip for a primary in the
customer summary: the gate is the job's, and the owner has not asked for customers to see crew
photos.

## Where it plugs in

- **Exists:** `report_photos`, the `report-photos` bucket, `photo-save`'s report pass,
  `lib/photos/reportPhotos.ts` (the words and shapes), `reportPhotosIo.ts` (the send, the attach,
  the discard, the card's read), `reportPhotoChecklist.ts`, `lib/photos/shrink.ts`,
  `components/reports/ReportPhotoTiles.tsx` and `ReportPhotosStrip.tsx`, the camera input and its
  handlers inside `AdditionalReportModal.tsx`, `lib/offline/*` (the outbox, the IndexedDB
  adapter, `pressThroughOutbox`, `landFieldPress`, `afterLanding`), `_shared/fieldReportEmail.ts`
  and `resendSendEmail.ts` (attachments already supported).
- **New:** `hooks/useReportPhotos.ts` (the lifted state), `lib/photos/reportPhotoCounts.ts`
  (the batched count and its words), `lib/photos/reportPhotoEmail.ts` (which photos attach and
  the lines, pure, mirrored into the edge bundle), a `photos` store in the outbox DB and a
  `photoIds` field on the field-report payload, `lib/offline/keptPhotos.ts`.
- **Guides:** *take photos for a report* gains the desk, Turnaway, Edit and no-signal sections;
  *read field reports on the dashboard* and *reports* name the strip and the count.

## The plan

| PR | What | Size |
|---|---|---|
| 1 | `useReportPhotos` lifted out of `AdditionalReportModal` with no change in behaviour (its render tests stay green), mounted on the desk's New report form for a ledger job with the quiet line for a project or a bid; the guide. | S |
| 2 | Turnaway takes a photo, captioned by the reason. | XS |
| 3 | Every reader: the strip on the Dashboard's Recent reports, the Reports tab's grouped rows and the job thread; the count on the folded rows, the feed card and the thread item from one batched read. | S |
| 4 | Edit report shows the photos and takes more; the one line on taking one back. | S |
| 5 | The email attaches the photos and names them; the push counts them. Edge redeploy by the lead. | S |
| 6 | The queue: a kept report carries its shots; the bar counts them; the replay sends in order. Closes #189's PR 7. | M |

## How to verify

Live on clicktooling.com as the dev through the pane's login, on a ZZ Test job only, every row
deleted after:

1. Jobs → Reports → **New report**, pick the ZZ Test job, **Add a photo**, pick a file, read the
   tile's before and after, Save, open the card and read the strip.
2. On the phone preset with Job Mode on, **Turnaway**, a reason, a photo, **File Turnaway**; the
   card shows the photo captioned by the reason.
3. The Dashboard's Recent reports: the folded row reads *📷 1*, the expanded row shows the strip.
4. Edit the report from the Dashboard: the photo shows, **Add a photo** adds a second.
5. The email: a subscription to a test inbox, or the function's answer on a ZZ job, which is
   *nothing sent* by v2.6127; the attachment logic is held by its unit test.
6. No signal: the browser offline, Leave report with a shot, Save reads *Save report · 1 photo*,
   the toast says kept, the bar reads *1 report · 1 photo waiting to send*; online again, the
   report lands with its photo on the card.

## Where it stands (2026-11-01)

Every PR of the plan is on main, each with its guide, release note and fragment: PR 1 #6682
(v2.6255), PR 2 #6690 (v2.6262), PR 3 #6684 (v2.6256), PR 4 #6691 (v2.6263), PR 5 #6687
(v2.6260, `send-report-email` and `send-report-notification` redeployed from main the same day),
PR 6 #6695 (v2.6265). No migration anywhere in the train.

The live walk ran the recipe above on the dev server from the train's integration branch against
prod's ZZ Test J1085, then the desk's form and the no-signal flow on clicktooling.com once the
queue had landed them; every flow passed. It found one bug, fixed in #6699 (v2.6273): the count
hook keyed its read on the ids in order and threw the answer away when the Reports tab re-ordered
its 578 cards under it, so no row had its badge. The closing docs PR (v2.6277) adds the Glossary's
clauses the train deferred and makes the Edit form's second tile read *Add a photo* at a desk.

The four calls under The owner's calls were made as recommended: no photo on a project's or a
bid's report, no taking a saved photo back on Edit, the email attaches, the queue built last.

Two ZZ Test leftovers the app's own policies would not let the session delete: the open dispatch
request *Turnaway: 1085 ZZ Test — Site not ready* (the office closes it from the Inbox) and the
five files the sweep filed in the ZZ Test customer's Drive Photos folder.
