---
name: "Every photo uploaded, one list: a Photos tab on the Documents page"
number: 232
group: gated
status: proposed 2026-11-01 from the owner's ask of the same day; the sources and the Documents screens read in the code the same morning; nothing built
mockup: to-dos/all-photos-view/mockup.html
summary: >
  Photos reach the app from four doors, each with its own table and bucket, and the only way
  to see them today is one job at a time, in the job window's strip under the address. The
  owner wants one view of every photo uploaded, newest first, with where each one is saved and
  who uploaded it, beside the Documents tab he already likes. The plan is a Photos tab on the
  Documents page fed by one database view that unions the four tables under their own RLS, each
  row a thumbnail, the day and time, the job and its customer, the source, the person, and the
  Drive line (In Drive with Open, or Not in Drive yet with the sweep's reason), with a search
  box and chips for the source and the Drive standing, a viewer on press, and doors to the
  report, the box, the thread and the job. The job window's Documents tab gains a one-line door
  to the strip it already has. Photos dropped straight into a Drive folder have no row of ours
  and stay out of the list at first; the job's own folder is the door to them.
next: the owner's five calls under The owner's calls; then PR 1, the view and the kernel, in a session of its own
size: S · M · XS as a train of three PRs, one migration (a view, no table)
blocker: the owner's calls; #229's PRs 1 to 6 touch the report forms and readers, never the Documents page, so the two trains do not meet
opinion: build the recommended shape; the one call worth the owner's eye is whether the primary's list follows the ledger's scope, since the report photos' own gate is wider today
---

# Every photo uploaded, one list (#232)

## The ask

The owner, 2026-11-01: *"The documents tab Is very cool and offers a lot of great value, but I
would love to see some sort of view and have access to some sort of view that shows me all the
photos that have been uploaded. sorted by most recent to least recent and where they are saved
and who uploaded the photo. Would you be able to help me come up with a way to offer this, and
show me in a mock up what it could look like"*.

This is a proposal with a mock-up. Nothing here is built until the owner picks.

## What the app has today (verified 2026-11-01)

**Four doors take a photo, and each keeps its own rows.** Every one follows the pattern the owner
chose on 2026-10-24 (#164): the phone shrinks the shot, a private bucket holds it, the `photo-save`
sweep copies it into the job's Drive folder within five minutes, the row keeps the Drive file's id
and the bucket copy is deleted. Drive is the home; the bucket is the waiting room.

| Door | The rows | Who took it | The time | Where it is | Who may read the rows |
|---|---|---|---|---|---|
| **Leave report** on the phone (#189, v2.6083), and since #229 every report form | `report_photos` · the `report-photos` bucket | `by_user_id` and `by_name`, a user of ours | `taken_at`, the moment the phone sent it; `filed_at` the filing | the bucket, then Drive (`drive_file_id`); a job with no folder keeps it in the bucket with `fail_why` | the stage-progress gate: the office roles, the estimator, **and a primary or a superintendent on every job**, field roles on their own jobs |
| **The Tally's On site tab**, a photo of a box (#209, v2.6045) | `job_box_photos` · the `box-photos` bucket | `by_user_id` and `by_name` | `taken_at`; a `status` of sending, on-phone, filed or shared | the bucket, then Drive; *on-phone* means the shot never left the phone, *shared* that it went by the phone's share sheet and we have no copy | the ledger's own scope, or the job's team |
| **A stage checklist question** that asks for a photo (#164, v2.6084) | `stage_checklist_answers`, its photo columns · the `stage-checklist-photos` bucket | `answered_by` and `answered_by_name` | `photo_taken_at` | the bucket, then Drive; since v2.6219 an answer may instead name a report photo (`report_photo_id`), the same shot once | the stage-progress gate |
| **A picture on a text or an email** (Messages cut 6 and cut 10) | `message_attachments` with its line in `messages` · the `message-attachments` bucket | the line's `who_text`: a customer, a GC, a supply house, or one of us on a line we sent; **not a user row** | the line's time, `messages.at` | our copy stays in the bucket; `drive_file_id` once **Save to Drive** or the job's *Save every photo* tick filed it; some have no copy of ours (left in Gmail or Quo) | the office team and the estimator only |

**Two more hold pictures and are out of scope here.** Quick Estimate's field photos
(`estimate_field_photos`, moved to Drive by hand at Quickfill's *Field photos → Drive* station)
belong to an estimate, not a job, and the station is already their list. The GC side keeps a
trade's own uploads (`gc_trade_files`) and typed photo links on punch items, bill-day checks and
back charges; those are the GC desk's.

**The only list today is one job at a time.** The job window's Photos strip under the address
(#164, v2.6090) asks the `job-photos` function for the job's two Drive folders, Customer Pictures
and Team only › Photos, newest first, and opens a viewer. It reads Drive, so it also shows a
photo someone dropped in the folder by hand, and it knows the file's name and Drive's modified
time but **not who uploaded it**: the function asks Drive for no owner field, and every file the
sweep filed is owned by the app's service account anyway. The person is in the file's name,
*2026-10-29 Luis Ortega · Rough In.jpg*, because the sweep writes it there.

**The Documents page** (`/documents`) has nine tabs: Company, Search, Estimates, Bid proposals,
Jobs, Supply invoices, Sent, Where files go and Upload. Each ledger is the newest 200 rows of one
kind with a Docs column of icons. The Sent tab is the newest shape and the one to copy: a search
box, a row of kind chips, both asked of the server, and **Show more** by a hundred. The page opens
for the dev, the leader, the assistants, the controller, the estimator, a primary on their own jobs
and a superintendent; the subcontractor-like roles are bounced. **The job window's Documents tab**
lists pay applications, bills, the contract, test reports, lien paper, hours statements, sent
copies and the job's folder links. Photos are not on it.

**Three facts the plan has to respect.**

1. No row says which Drive folder a filed photo landed in. The sweep decides at filing time
   (Customer Pictures when the job's pictures link is a folder, else Team only › Photos) and keeps
   only the file's id. The job's links as they stand say which folder it would be today.
2. A Drive-only photo, one with no row of ours, cannot be listed across jobs. Reading it means one
   Drive call per job, and the Jobs ledger holds two hundred.
3. The report photos' gate names a primary and a superintendent without a job scope, so a
   primary may read every job's report and checklist photo rows today, though their jobs read is
   scoped to their own. The box photos' gate goes through the ledger and keeps the scope.

## The design

### The idea: one list from one view, each row saying where it is and who took it

One database view, `uploaded_photos`, unions the four tables into one shape: the source, the
job (or the bid or the GC project for a text's picture), the report or the box or the question it
came with, who took it, when, the caption, the bytes, where it waits, where it landed and why it
has not. The view runs as the caller (`security_invoker`), so every table's own policy decides
what each person sees and no new gate is written. A Photos tab on the Documents page reads it
newest first, a hundred at a time, and draws each row the way the Sent tab draws a copy.

### A. Documents → Photos, across every job

Between **Sent** and **Where files go**, a tab called **Photos**. Under it:

- **A search box**: *Find a photo: a job, a customer, a person, a stage.* Asked of the server
  once the typing rests, as the Sent tab does.
- **Source chips**: All · Reports · Tally boxes · Checklists · Texts & email. The last shows only
  to the office and the estimator, whose policy reads those rows.
- **Where chips**: Everywhere · In Drive · Not in Drive yet, the last with its count. That chip
  is the office's clean-up door: every photo the sweep could not file, with the reason on the row
  and the press that fixes it.
- **The rows, grouped by day** (*Today · Sat, Nov 1*, *Yesterday*, then the date), newest first.
  Each row: the thumbnail; the caption in bold (*Rough In*, *A1 after Count*, *Did the water test
  hold*, the file's own name for a text's picture); the job as `J1042 · Oak Hollow Apartments
  Building C · Ridgeway Builders`; a source chip and the person and the time (*Report · Mateo Ruiz
  · 2:14 PM*; *Text from Greg Paulk · 9:40 AM*); and the Drive line on the right: **In Drive ·
  Customer Pictures ↗** in green, **On its way** in grey while the sweep has not run, **Not in
  Drive yet · That job has no Drive folder yet** in amber, **Still on Mateo's phone** for a box
  photo kept for want of signal, **Shared from the phone · no copy here** for one sent by hand.
- **Show more** by a hundred, with the page's position kept by the last row's time and id, so a
  photo filed while the list is open never shifts the page.
- **The empty state** names the next press: *Nothing uploaded yet. A photo taken on a report, a
  box or a checklist shows here within a minute.* With a filter on: *No photo matches. Try another
  source or fewer words.*

### B. A press opens the viewer, and every name is a door

- **The thumbnail** opens the viewer: the picture at full size, its day and time, the job, the
  source, who took it, its size before and after the shrink, where it is, and the presses **Open in
  Drive ↗**, **Open the report** (or **Open the box**, **Open the thread**) and **Open the job**.
  Left and right move through the list.
- **The job's name** opens the job window (`/jobs?jobDetail=<id>`); **the source chip** opens
  the report's card, the Tally's On site tab on that box, or the Messages thread; **the person's
  name** narrows the list to their photos.
- **The thumbnail's bytes** come from two places and the client never keeps them: a waiting photo
  through a signed URL on its bucket (as the report card does), a filed one through the
  `job-photos` function's `thumb` on its Drive id (as the strip does). A text's picture filed into
  a bid's or a GC project's folder is outside the function's two job folders, so its tile is the
  camera glyph with **Open in Drive ↗**; its bucket copy, which we keep, is the thumbnail instead.

### C. The job window's Documents tab gets a Photos line

A section **Photos** after the folder links: *Photos · 15 in Drive · 1 on its way* as one line
whose press opens the strip's viewer the window already has, and the dashed card the strip shows
when no folder is linked. Nothing new is read: the strip's own hook feeds it.

### D. Roles

| Who | What the tab shows |
|---|---|
| dev · master · assistant · controller | every photo on every job, all four sources |
| estimator | the same (the stage-progress gate and the Messages policy both name them) |
| primary | their own jobs' photos from reports, boxes and checklists; no text or email pictures |
| superintendent | their assigned projects' jobs; no text or email pictures |
| helpers · subcontractor | the page is not theirs; they keep the job window's strip on their jobs |

The view adds one clause the gates do not have: the job must be one the caller can read in
`jobs_ledger`. That makes the primary's and the superintendent's list follow the ledger's scope,
as the box photos already do, and changes nothing for the office. The report photos' own gate
stays as it is; narrowing it is a one-line migration the owner can ask for apart from this card.

### E. Drive-only photos: not in the first list

A photo dropped into the job's folder by hand, or one the office saved to Drive before the app
kept rows, has no row of ours. Three ways to show it were weighed:

- **Live**, one Drive call per job on every load: refused, two hundred jobs is two hundred calls.
- **Nightly**, a sweep that walks every job's two folders into an index table: possible, a second
  system to keep true (a renamed or deleted file, a folder relinked), its own card if wanted.
- **Not at first**, with the job's own folder as the door: every row's job name opens the job
  window, whose strip reads the folder live, and the tab's foot says so in one line: *A photo put
  in a Drive folder by hand is in the job's own strip, not here.*

The third is recommended. The list is for photos the app took in; the strip is for the folder.

## The owner's calls

1. **Where the list lives.** Recommended: a Photos tab on the Documents page across every job,
   and a one-line door on the job window's Documents tab to the strip it has. The alternative, a
   Photos tab in the job window only, is already most of what v2.6090 built and does not answer
   the ask, every photo in one place. Both at once is the recommendation.
2. **One list from one view, or one list per source.** Recommended: one view that unions the four
   tables, one shape for every row, one page of a hundred, newest first across sources. One list
   per source would be four reads, four Show more presses and no single newest-first order.
3. **Texts and email in the list.** Recommended: yes, for the office and the estimator, since their
   policy already reads those rows and a customer's picture on a text is often the photo that
   matters. The alternative leaves them to the Messages thread and keeps the list to what we took.
4. **The primary's and the superintendent's scope.** Recommended: the view follows the jobs
   ledger's scope, so a primary sees their own jobs' photos only. The alternative shows them what
   the report photos' gate shows today, every job's.
5. **Drive-only photos.** Recommended: not at first, with the job's strip as the door and the one
   line in the foot. The alternative is the nightly index, its own card.

## Is this the best we can do? (the self-review, 2026-11-01)

**The simpler shape.** The simplest thing would be a Photos tab that reads `report_photos` alone,
since that is the door the owner is building out with #229. Rejected: a box photo and a checklist
photo are the same kind of thing to the office, the sweep already treats the three tables as one
list, and the text's picture is the one a customer sent. The view is the one piece that makes the
four read as one, and it is a view, not a table: no fences, no copies, nothing to keep in step.

**What to leave out at first.** Drive-only photos (E). A per-person or per-job count card. A
calendar or a month picker; the day headings and Show more are enough for a list the office reads
top down. Editing a caption or deleting a photo from here: Drive is the home and the row's taker
owns the row, so the tab reads and never writes. A customer-facing copy: nothing in this card
reaches a portal.

**The photos the list cannot show, and why.**

- A photo dropped in a Drive folder by hand: no row of ours (E).
- A box photo marked *shared*: the crew sent it from the phone's share sheet and we have no copy;
  the row shows with its words and no thumbnail.
- A text's picture left in Gmail or Quo: the reader could not copy it; the row shows with *no copy
  here* and the thread as its door.
- A report photo whose form was closed without saving: the row has no report and the client
  discards it; the view requires a report.
- Quick Estimate's field photos and the GC side's: out of scope above.

**Who uploaded it, honestly.** For the three app sources the row keeps the user's id and the name
as typed at the time, so a renamed person still reads as they were. For a text's picture the
"uploader" is the sender on the line, a contact, and the row says *Text from Greg Paulk* rather
than pretending a user did it. For a Drive-only photo the app cannot say at all, which is one more
reason to leave them to the strip.

**Where it is saved, honestly.** The row knows the Drive file, not the folder. The Drive line
names the folder by the job's links as they stand, which is right for every photo filed since the
links were set and could be wrong for a photo filed before the office changed a link. The press
opens the file itself, so the name is a help, never the door.

**The crew.** This is an office list. A tech's own photos are on the report card they filed and
on the job window's strip; nothing here adds a press to the phone's day.

**Speed.** One read of a hundred rows from a view whose branches each have an index on their
time, with the jobs read once for the page's job ids, as the Jobs ledger does. The thumbnails
load as tiles come on screen, twenty-four at a time, as the viewer does today.

## Where it plugs in

- **Exists:** `report_photos`, `job_box_photos`, `stage_checklist_answers`, `message_attachments`
  and `messages`; the four buckets; `photo-save` (the sweep) and `job-photos` (`list`, `thumb`,
  `full`); `lib/photos/jobPhotos.ts`, `jobPhotosIo.ts`, `reportPhotos.ts` (`cardPhotoWords`,
  `driveFileUrl`), `reportPhotosIo.ts` (the signed-URL read); `components/photos/JobPhotosStrip.tsx`,
  `JobPhotosViewer.tsx`, `JobPhotoThumb.tsx`; `components/documents/DocumentsSentLedger.tsx`
  (the shape to copy), `jobs/jobDocumentsStyles.ts`; `lib/documentsPageTab.ts`; `EmptyState`.
- **New:** the migration `uploaded_photos` (a `security_invoker` view, its `docs/migrations/`
  fragment); `lib/photos/uploadedPhotos.ts` (the row shape, the source and Drive words, the day
  groups, the filters, the page key) with tests; `lib/photos/uploadedPhotosIo.ts` (the read, the
  jobs read, the two thumbnail paths); `components/documents/DocumentsPhotosTab.tsx` and
  `UploadedPhotoViewer.tsx`; `'photos'` in `documentsPageTab.ts`; the guide *find every photo
  that was uploaded*; the Documents line in `docs/twins/APP_DIRECTORY.md`, the tab in
  `docs/PROJECT_DOCUMENTATION.md` and `docs/DOCUMENTS_PAGE_ARCHITECTURE.md`, the Glossary's
  *Report photos* entry gains the tab.
- **Beside #229:** that train lifts the photo block into every report form and the strip into
  every reader. It writes more `report_photos` rows and reads them per report; it never touches
  the Documents page, the view or the tab. The two trains share `reportPhotos.ts`'s words only.

## The plan

| PR | What | Size |
|---|---|---|
| 1 | The migration: the `uploaded_photos` view (four branches, `security_invoker`, the ledger clause), pushed after the merge; the kernel `uploadedPhotos.ts` with its tests; the io. A view, so no fence calls; a client ahead of the push reads a refusal in words and the tab waits. | S |
| 2 | The Photos tab: the search, the chips, the day groups and rows, Show more, the empty states, the viewer and its doors, the tab in `documentsPageTab.ts`; the guide; the docs lines. | M |
| 3 | The job window's Documents tab: the Photos line over the strip's hook, and the dashed card when no folder is linked. | XS |

## How to verify

Live on clicktooling.com as the dev through the pane's login, on ZZ Test jobs only, every row
deleted after.

1. On a ZZ Test job with a Drive folder, take one report photo (Leave report), one box photo (the
   Tally's On site tab) and one checklist photo; on a ZZ Test job with no folder, one more report
   photo. Documents → **Photos**: four rows, newest first, the three filed ones reading *In Drive*
   within five minutes and the last *Not in Drive yet · That job has no Drive folder yet*.
2. Press **Not in Drive yet**: the one row; press **Make the job's Drive folders** from the job
   window; the row reads *In Drive* on the next sweep.
3. Press a thumbnail: the viewer, the facts, **Open in Drive** opens the file; **Open the report**
   opens the card with the same photo on its strip.
4. Type the ZZ customer's name: only its jobs' rows. Press a person's name: only their rows.
5. Settings → View as a primary sample: the tab shows that sample's own jobs' photos and no Texts
   & email chip.
6. The job window's Documents tab on the folder job: *Photos · 3 in Drive*, the press opens the
   strip's viewer.
