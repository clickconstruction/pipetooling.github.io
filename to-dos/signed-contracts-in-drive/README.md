---
name: "Signed contracts: filed in the job's Drive folder and found by Find a file"
number: 377
group: close
status: asked 2026-11-17 as call 7 of #376 · the owner settled all seven calls the same day and said build · built 2026-11-17 as a train of six, every migration pushed and every function deployed · walked on prod on a ZZ Test contract · the sweep's first run tied six papers to their Drive files and held one · the walk's two small finds fixed and walked in v2.7704 · left: the owner's look
summary: >
  A signed job contract lives in the app's own storage and nowhere in Google Drive, so Find a file cannot
  find it. This card files each signed paper in its job's Drive folder, under Team only › Contracts, and
  hands it to the file index the same minute. A paper the office already keeps in the jobs drive is
  adopted where it sits, never copied or moved. The signing itself is not touched: a sweep files the paper
  within ten minutes, and a paper it cannot file waits with its reason and its door. The jobs drive and
  Find a file are open to estimators, who cannot read a contract in the app today, so filing there lets
  an estimator read it. The owner was told that first and chose the job's folder.
next: The owner's look at a signed contract's Drive line and at the card on Where files go. Then his word to retire the card.
size: M as a train of six (S · M · S · M · S · S); shipped: PR 1 to 6 and one fix; left: the owner's look (XS)
blocker: None. All six PRs and the fix are merged and live.
opinion: your call — the code is done and walked; the look is yours
ver: v2.7640 · 7643 · 7644 · 7645 · 7647 · 7649 · 7704
---

# Signed contracts in Google Drive (#377)

The mock-up is [mockup.html](mockup.html). Every screen on it is drawn by one script from one list of
made-up contracts, so the counts on the Where files go card are counted from the lines drawn. It was
rendered with Playwright at desktop and phone width, in light and dark, before it was shown.

This is call 7 of [#376](../documents-agreements-tab/README.md), the Agreements tab. That card lists the
papers. This one puts the signed file where the office looks for files.

## Where it stands

Built 2026-11-17, the day the owner said build, as six PRs, with one fix after the walk. All seven are merged and live.

| PR | Version | What |
|---|---|---|
| 1 | v2.7640 | The rules: which file a record files, the name, the due rule, the holds and their words |
| 2 | v2.7643 | The columns on `job_contracts` and the function `job-contract-drive` |
| 3 | v2.7644 | The Contract sweep's Drive pass drops a file that is already a paper on file |
| 4 | v2.7645 | The sweep's cron, the Drive line on the Contract window, the office's filings ask at once |
| 5 | v2.7647 | The Signed contracts card on Documents → Where files go |
| 6 | v2.7649 | Find a file's chip and **Open the contract** |
| fix | v2.7704 | A job whose Drive folder is gone says so, and a voided copy's new name is in the index at once |

Both migrations are pushed and the three functions are deployed from `main`.

**Walked on prod** as the dev, on a ZZ Test job's signed contract, through the function itself:

- As it stood, with a typed link that is no Drive file: held, *The signed paper is a link outside the jobs
  drive*, written on the record.
- With a scan added and the job's link pointed at a folder that does not exist: held with Drive's own
  words then. Since v2.7704 it is held with *This job's Drive folder is gone* and the job's **Edit** tab
  as its door. The link was put back and checked.
- Pressed again: filed. The copy sits in the ZZ job's folder under Team only › Contracts, named by day,
  kind, job number and signer. The file index had it the same minute, with its text and its job. A second
  press did nothing.
- The Contract sweep's Drive pass, run fresh: it dropped four files that are papers on file, and did not
  offer the copy.
- Voided, then pressed: the copy's name starts `VOIDED · ` in Drive. The index had the new name on its
  next run then. Since v2.7704 it has it at once: about four seconds after the press on the second walk.
- Find a file, both searches, by a word from the paper's text: the hit is marked as a voided contract
  and carries its record.

**The sweep's first run** on the real papers did what the look said it would: six read *In Drive, where
the office put it*, and one is held with *Nothing to file*. No file was uploaded, moved or renamed.

**Changes from the plan below**, each written up in its fragment:

- Seven columns, not six, and no `job_contracts_drive_due` view. The function reads the queue itself.
- Every hold is tried again an hour on, not only Drive's refusals.
- A file past 25 MB is held as too big. It is not sent in pieces.
- PR 6 needs no migration. `drive-link` marks the hits; the two search functions are as they were.
- A copy's name is fixed when it is filed. A signer or a job number corrected later does not rename it.

**Not walked:**

- The screens in a browser: the Contract window's Drive line, the Signed contracts card and the chip.
  Render tests hold each one, and the function under them is walked.
- An estimator's Find a file, which shows the chip and no **Open the contract**. Unit tests hold the rule.
- The open-link guard against a real open link. Drive does list inherited sharing on a job's subfolders,
  which is what the guard reads. The proof takes one share press on a ZZ folder in Drive.
- A contract signed through the customer's link, and a paper over several jobs. Tests hold both.
- A job's folder that sits in Drive's trash, which has its own words since v2.7704. A unit test holds it.

**Left on prod by the two walks:** two contracts of the ZZ Test job, both voided, each with its test scan
in storage, its `VOIDED · ` copy in Drive and one row in the file index. The first was signed before its
walk. The second was voided before and is voided again with its own first values.

**Small, found on the first walk and fixed in v2.7704**, on the owner's word, then walked on prod on a
second ZZ Test contract:

- Drive's words for a folder that is gone were technical (*Folder create failed (404)*). The function
  now reads the job's folder before it writes, and the hold says the folder is gone and offers the job's
  door.
- A voided copy's new name reached the file index on the index's next run. The rename is now handed to
  the index the same minute.

## The ask, in the owner's words

2026-11-17, asking how the app handles agreements:

> Across the app can you look at how we handle agreements? I don't currently see Agreements in the
> documents tab

The look for #376 found that a signed job contract is not in Google Drive or the file index. Shown that as
call 7, with the pick *a card of its own after this one*, he answered **Take the picks**. This is that
card. It is a design. No app code ships from it until he says build.

Shown the card, the mock-up and the seven calls the same day, with call 1 put first, he answered **Yes,
job's folder**. That settles call 1: a signed contract is filed in its job's folder, and estimators can
read it there.

Asked next whether he takes the picks as drawn for calls 2 to 7, he answered **Take the picks**. That
settles all seven calls. It is not the word to build.

## What the look found

Read in the code on 2026-11-17, and on prod through the dev seat for counts and Drive facts only.

### Where a signed paper is today

| Paper | How it is made | Where the file is |
|---|---|---|
| A contract or a warranty signed through the link | `sign-job-contract` builds the PDF once every frame is signed | `job-contract-documents`, `<contract id>/signed.pdf`, on `signed_pdf_path` |
| A signed paper the office files, with a scan | The browser writes the row and uploads the scan (`fileSignedJobContract`) | the same bucket, `<contract id>/paper.<ext>`, on `paper_upload_path` |
| A signed paper the office files, with a link only | The same write, no upload | nowhere in the app. The link the office typed is on `signed_document_url` |
| A GC's own paper, signed by us (`kind = 'their_paper'`) | `theirPaperIo.ts` | a scan on `paper_upload_path`, or a typed link |
| One paper over several jobs (`covers_group_id`) | `jobContractCoversWrite.ts` | every covered job has its own row, and its own copy of the scan in the bucket |

- The signing function already treats the PDF and the emails as best effort: *never fail the signature*.
  The customer's copy goes out by email and is kept as a `sent_documents` row of kind
  `job_contract_signed_copy`.
- `minted_pdf_path` is a column on `job_contracts` that nothing writes. The lien releases use the column
  of that name on their own table. It is left alone here.
- Nothing in any of these paths talks to Drive, and nothing writes `file_index`.

### What is on prod

Counts only. `job_contracts` holds 19 rows. 8 are signed and live.

- **None of the 8 has a file in the app's storage.** No contract has been signed through the link for a
  real customer yet, and no scan has been uploaded. Every real one is a paper the office filed as a link.
- **6 of the 8 are links to a file that already sits in the jobs Shared Drive**, inside its job's folder
  tree. The office put them there, and the Contract sweep's Drive pass found most of them.
- All 6 already have a row in the file index. 3 have their text read. 3 are scans waiting on a read. 1 is
  not tied to its job, because it sits in a folder the index could not walk up from.
- 1 of the 8 is a test record with a link that is not a Drive file. 1 has no file and no link at all.

So on day one this card uploads nothing. It ties six files that are already in the drive to their
records, and it names why two cannot be filed. The uploads start with the first contract signed through
the link or the first scan the office uploads.

### How a file reaches a job's folder today

- `job-drive-folders` keeps the tree *root › customer › job*, with **Customer Pictures**, **Plans** and
  **Team only** inside, and **Photos** and **Sent by us** inside Team only (`JOB_FOLDER_TREE`,
  `_shared/jobFolders.ts`, `FolderTree.placeJob`). The office's press, the folder sweep every ten minutes
  and the photo sweep's first photo on a job all place a job through that one rule.
- A job whose folder cannot be placed is held with its reason on `jobs_ledger.drive_folder_hold`: a
  folder in a My Drive, a link that is not a folder, a folder the app cannot open.
- The photo sweep (`photo-save`) files from a bucket into a job's folder. A shot it cannot file keeps its
  reason on its own row and is tried again every run. That is the pattern this card copies.
- The job window's Documents tab has **Add a file**, which puts a file from the computer into the job's
  folder, Plans or Customer Pictures through `drive-link`'s `put`. It offers Team only › Sent by us to the
  Hours statements section only.
- `uploadBytes` takes `appProperties`, the app's own marks on a Drive file. A bid photo already carries
  its row's id that way, so a second run finds the file it made.

### How the index learns a file

- `file-index-sweep` runs every ten minutes. It lists what changed in the jobs Shared Drive, walks each
  file up to its job or bid, reads its text and upserts one `file_index` row. A press can index one file
  at once through the same pass (`indexFiles`).
- A PDF the app builds has a text layer, so its words are searchable the minute it is indexed. A scan has
  none. It is read by the OCR step when the processor secret is set, and found by its name and its
  folders until then.
- Find a file asks `drive-link`: `search_index` first, the index, then `search`, Drive's own search,
  behind it. Since #285 the index also holds rows that are not Drive files, a person's HR file and a
  legal matter, and Find a file answers Drive rows only.

### Who reads what today

| What | Who |
|---|---|
| `job_contracts`, the record | dev, master technician, assistant, controller (`is_office_staff()`) |
| The emailed signed copy, `sent_documents` | the same four |
| The contract bucket | The Contract window opens its files through signed links. The bucket's policy is not in `supabase/migrations/`, so PR 2 reads it on prod before it relies on it |
| `file_index`, `file_index_chunks` and Find a file | those four **and the estimator** (`is_office_or_estimator()`, `drive-link`'s `OFFICE_ROLES`). Never a digital twin |
| A job's folder listed in the app (`drive-link` `list`) | the same five roles |
| The jobs Shared Drive, opened in Google Drive | its members. Read on 2026-11-17: five people's addresses and the app's own account. Three hold the assistant role, one is an estimator, and one address has no app account under it |

Two things follow.

- An estimator cannot read a contract in the app. An estimator can read every file in the jobs drive,
  through Find a file and, for the one who is a member, in Drive itself. **The six papers already in the
  drive are already readable by an estimator.** One of them was put there by one.
- `docs/DRIVE_INTAKE_SETUP.md` names two people as members. The drive has five. The doc is behind.

*Team only* is a name and a habit, not a lock. Drive gives a folder the sharing of the folder above it,
so Team only is as open as the job's folder. It is the half the office never hands a link to.

### The Drive pass that finds old contracts

`drive-contract-scan` lists every file in the drive whose name holds *contract*, *agreement*,
*subcontract*, *signed*, *executed*, *proposal* or *terms*, and keeps the list for an hour.
`matchDriveContracts` offers each file to a job with no contract, by the folder's street or job number,
or, weaker, by the customer's name (`driveContractMatch.ts`, `contractSweepDrive.ts`). A file is never
checked against the papers already on file.

So a copy the app files under one job would be offered, as a *check* find, to the same customer's next
job that has no contract yet. That is true today of the six hand-linked files too.

## The design

### Which papers are filed

Every signed, live `job_contracts` row that has a file, whatever its kind: a contract, a warranty, a GC's
own paper, a scan the office uploaded.

- **One file per record.** The scan when the record has one, since the paper is then the record's
  document (`filedOnPaper`). Else the signed PDF.
- **A paper that is already a Drive file is adopted, not copied.** When the record has no stored file and
  its link is a file inside the jobs Shared Drive, the app records that file as the paper's Drive copy
  and leaves it exactly where it is, under its own name. Nothing a person placed is moved or renamed.
- **A link the app cannot adopt is held with its reason**: a link that is not a Drive file, or a Drive
  file outside the jobs drive. The door is to upload the scan.
- **A record with no file and no link is held** as *Nothing to file*. The door is **Add the scan**.
- Not filed: a draft, a paper out for signature, a paper with one frame signed and one open. An accepted
  estimate and a proposal signed in the bid room are not `job_contracts` rows and stay as they are.

### Where it lands and what it is named

**Team only › Contracts**, a sixth folder, found or made the first time a paper is filed on the job. A job
with no signed paper gets no empty folder.

The name starts with the signed day, as the photo sweep names a shot, then says what it is:

| Paper | Name |
|---|---|
| Contract signed through the link | `2026-11-14 Signed contract · 1042 · Dana Whitfield.pdf` |
| Warranty | `2026-11-12 Signed warranty · 1039 · Luis Ortega.pdf` |
| A scan the office uploaded | `2026-10-30 Signed contract scan · 1017 · Priya Raman.pdf` |
| A GC's own paper | `2026-10-21 Their paper signed by us · 1003 · Master Subcontract Agreement.pdf` |
| One paper over several jobs | `2026-09-18 Signed contract · covers 251, 825 and 843 · Harlan Custom Homes.pdf` |

The day is the signed day in the company's zone. The number is the job's. The last piece is who signed,
the paper's title for a GC's paper, or the customer for a paper over several jobs. A scan keeps its own
extension.

The file carries the app's mark, `appProperties.pt_job_contract = <contract id>`. A run that uploaded the
file and died before it wrote the row finds the file by that mark and does not file it twice.

### When it is filed

- **The signing is not touched.** `sign-job-contract` gains no Drive code, no new failure and no wait on
  the customer's Sign press.
- **One sweep files everything**, every ten minutes, fired only while a paper is due, as the folder sweep
  is. A paper is due when it is signed, live, has a file or a link, and is not filed.
- **A press files one at once**: **File it in Drive now** on the Contract window. The office's own paper
  filings call the same press right after their write, since a signed-in person is there.
- **The backfill is the same sweep.** It takes every due paper, whatever the job's state. On today's prod
  that is six adoptions and two holds, and no upload.
- **It is handed to the index in the same call**, so Find a file answers within the minute. The index
  sweep is the net behind it.

### One paper over several jobs

Each covered job has its own row and its own copy of the scan, so **each covered job's folder gets its
own copy**, named *covers 251, 825 and 843*. A job's folder is then whole by itself, and taking one job
off the paper voids that job's row and marks only that job's copy. The cost is that Find a file shows the
paper once per job.

### A voided paper

The app **renames its own copy** to start with `VOIDED · ` and keeps it in place. A voided paper is still
evidence of what was signed, so it is not trashed, and its old name would read as a paper in force. The
index follows the rename on its next pass, and Find a file marks the hit *Voided contract*.

A file the office placed is never renamed. An adopted paper that is voided keeps its name, and only the
app's own marks say voided.

### Who can read it, said plainly

**Filing a signed contract in the job's folder lets the estimator role read it.** Today the estimator
cannot read `job_contracts`. After filing, an estimator finds the paper in Find a file with a line of its
text, sees it in the job's folder list, and, as a member of the drive, opens it in Drive. What they read
is the whole paper: the price, the terms, the signer's name and, on a paper signed through the link, the
consent line with the time and the IP address.

Nobody else gains anything. A crew member, a primary, a superintendent, a sub and a customer do not reach
the jobs drive or Find a file. A digital twin holds the estimator role and is refused by both.

One guard is added, since a signed contract is a legal paper: **the app does not file into a folder that
is open to anyone with its link.** It reads the job folder's sharing first, as `gc-drive-access` already
does for a plan set, and holds with *This job's folder is open to anyone with its link*.

This was call 1, and the owner settled it on 2026-11-17: **file in the job's folder, and estimators read
it there.** The estimator is on the office team and prices the job, and six of the eight papers are
already there. The way not taken was a drive of its own for contracts, as the People folder has.

### The link field

`signed_document_url` stays what the office typed. The app does not fill it.

That column carries meaning today. It decides the line *Signed outside the app · filed as a link* against
*Signed on paper, uploaded by the office* (`signedHowLine`), whether an emailed copy attaches a PDF or
sends the link (`signedDoors`), and a GC's paper reads its document from it (`theirPaper.ts`). Filling it
would make an uploaded scan read as a link. The Drive copy gets columns of its own, and the Contract
window gets an **Open in Drive** door beside the ones it has.

### When it cannot be filed

A paper that cannot be filed stays safe in the app, keeps its reason on its own row, and is tried again
by the sweep. Nothing about the signing, the record or the emailed copy changes.

| Why | The words | The door |
|---|---|---|
| Drive is not connected | *Drive is not connected. The paper is safe here and files itself once Drive is back.* | Where files go |
| No jobs root | The root's own words (`NO_ROOT_WORDS`) | Where files go |
| The job has no folder | Not a hold. The sweep makes the folder through `placeJob`, as the first photo does | none |
| The job's folder is held | The job's own reason, from `drive_folder_hold` | The job's Edit tab, or the customer |
| The folder is open to anyone with its link | *This job's folder is open to anyone with its link. A signed contract is not filed there.* | The folder in Drive, then **Try again** |
| The paper is a link the app cannot adopt | *The signed paper is a link outside the jobs drive. Upload the scan and it is filed.* | **Add the scan** |
| No file and no link | *Nothing to file. This record has no scan and no link.* | **Add the scan** |
| Drive refused the upload | Drive's own reason (`driveFailWords`) | **Try again** |

A hold is retried each run while its cause can clear by itself, and hourly after that, as the index does
with a held file.

### The Drive pass

`drive-contract-scan` drops every file that is already a paper on file, **by its Drive id, never by its
name**: the id on a record's new Drive column, and the id inside any `signed_document_url`. The filter
runs when the list is served, so a file filed after the hourly scan was kept is gone on the next read.
The file's own mark, `pt_job_contract`, is a second net for a file whose row write was lost.

This also stops the six hand-linked files being offered to a sister job, which they can be today.

### The screens

All drawn on the mock-up.

- **The Contract window, signed.** One new block, **Drive**, under the doors it has. *In the job's Drive
  folder · Team only › Contracts* with **Open in Drive**. *In Drive, where the office put it* for an
  adopted file. *Not in Drive yet. The app files it within ten minutes* with **File it in Drive now**.
  Amber for a hold, with its reason, its door and **Try again**. *Voided. The Drive copy is renamed
  VOIDED and kept.*
- **Documents → Where files go.** A **Signed contracts** card after *What is inside*: where they go, who
  can open them, the counts, one press that says its count (**File 2 signed contracts**, dead when
  nothing waits) and the held papers, each with its reason and its door. *What is inside* gains the line
  for Contracts.
- **Documents → Search → Find a file.** A hit on a filed paper carries a **Signed contract** chip, or
  *Voided contract*, and for the four office roles **Open the contract**, which opens the Contract
  window. An estimator's hit opens in Drive, as any hit does.

The Agreements tab of #376 shows no Drive mark in this card. It is one line to add once both are built.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The job's folder | `FolderTree.placeJob`, `findOrCreateFolder`, the holds | **Contracts** under Team only, made on first use |
| The upload | `uploadBytes` with `appProperties`, `driveFailWords` | the contract's name and mark |
| Who can open a folder | `gc-drive-access`'s `driveAccess` | lifted into `_shared` and asked before a filing |
| The index | `indexFiles`, the sweep, OCR, the meaning vectors | nothing. A filed paper is a Drive file like any other |
| The record | `job_contracts` | `drive_file_id`, `drive_filed_at`, `drive_file_origin` (filed, adopted), `drive_file_hold`, `drive_file_tried_at`, `drive_void_marked_at` |
| The sweep | the cron pattern of `job-drive-folders-sweep` | `job-contract-drive`, an edge function with a press and a sweep, and its cron |
| The Drive pass | `drive-contract-scan`, `matchDriveContracts` | the filter by id |
| The screens | `JobContractSignedRail`, `DocumentsWhereFilesGo`, `findAFile.ts` | the Drive block, the card, the chip |

A function of its own, not a pass in the photo sweep: `photo-save` is the biggest function in the repo
and every pass it gains is weighed against the upload cap. The new one reuses its shared pieces.

## The plan

Each step is one PR, with its release note and fragment. All six are built: *Where it stands* above says
what shipped and where it differs from this plan.

1. **PR 1, the rules (S).** One kernel, read by the browser and the function: which file a record files,
   the name by kind, the due rule, when a link is adoptable, the hold kinds with their words and doors,
   the Drive block's line for each state, the card's counts and its press through `batchWords`, and the
   scan's filter. Unit tests. No screen. PR 1 checks `_shared/gcKernels/` for how the function reads it:
   the copy, or the rules restated with a parity test.
2. **PR 2, the ground (M).** The migration: six nullable columns on `job_contracts` (starting
   `SET lock_timeout = '3s';`, no new table, so no fence calls) and `job_contracts_drive_due`, the
   sweep's queue, for the service role only. The edge function `job-contract-drive`: a press for one
   contract, the sweep, the open-link guard, the index hand-off. No cron and no screen yet. Its
   `docs/migrations/` page, its `docs/EDGE_FUNCTIONS.md` section, and `docs/DRIVE_INTAKE_SETUP.md`, with
   the drive's members put right. Pushed and deployed after the merge, then proven on a ZZ job by a dev.
3. **PR 3, the Drive pass (S).** `drive-contract-scan` drops the papers on file, by id, at serve time. It
   ships before anything files by itself.
4. **PR 4, the sweep on and the Contract window (M).** The cron's migration. The **Drive** block on
   `JobContractSignedRail` with its states, **Open in Drive**, **File it in Drive now** and **Try again**.
   The office's paper filings call the press after their write. A voided paper's copy is marked. Render
   tests. The guides *get a job contract signed* and *find a file when you do not know where it is*.
5. **PR 5, Where files go (S).** The **Signed contracts** card, the Contracts line in *What is inside*,
   the guide *set where a job's files go*, `docs/DOCUMENTS_PAGE_ARCHITECTURE.md`, `docs/GLOSSARY.md` and
   `docs/ACCESS_CONTROL.md`, which says in one line that an estimator reads a filed contract.
6. **PR 6, Find a file's chip (S).** The two search functions answer whether a hit is a paper on file,
   rewritten from their newest definitions. `findAFile.ts` draws the chip, and **Open the contract** shows
   to the four office roles.

## Left to settle while building

- **A scan uploaded again after filing.** The pick: the same Drive file takes the new content, so its id
  and every link to it hold.
- **A paper un-voided.** If a void can be undone, the copy's name goes back. PR 4 checks whether any door
  does that today.
- **The contract bucket's policy**, which is not in the migrations. PR 2 reads it on prod.
- **Whether a list of permissions on a folder in a Shared Drive shows an inherited open link.** PR 2
  proves the guard on a ZZ folder before it is trusted.
- **Size.** `uploadBytes` sends a file whole. A scan past its limit goes up in pieces
  (`driveCopyInPieces.ts`), or is held with *Too big to file*. PR 2 reads the limit.

## Left out on purpose

- **Staff, sub and partner agreements, work orders, statements of work.** They are #376's other kinds.
  A person's signed form belongs with the People folder, which is a drive of its own, and is a card of
  its own if it is wanted.
- **Accepted estimates and signed bid proposals.** They are not `job_contracts` rows.
- **The emailed signed copy** in Sent copies. It stays as it is.
- **Moving or renaming a file a person put in Drive.** Adoption records it and touches nothing.
- **Any change to who reads `job_contracts`**, and any change to who is a member of the drive. The card
  says who reads a filed paper. It does not add or remove anyone.
- **A Drive mark on the Agreements tab's lines.** One line, after both are built.
- **Reading the key terms out of the PDF.** #173 left that as its own follow-up.

## The owner's calls, settled 2026-11-17

Call 1 in his own words, **Yes, job's folder**. Calls 2 to 7 as the mock-up draws them: **Take the
picks**.

1. **Who reads it.** The paper is filed in its job's folder, and estimators can read a signed contract
   there, in Find a file and in Drive. Not taken: a Shared Drive of its own for contracts, as the People
   folder has, with the office's four roles as members and Find a file answering those hits to the four
   only.
2. **Which papers.** Every signed paper with a file, of all four kinds, and a paper already in the drive
   is adopted where it sits. Not taken: only papers signed through the link.
3. **The folder and the name.** Team only › Contracts, a sixth folder made on first use, named by day,
   kind, job number and signer. Not taken: Team only › Sent by us, with no new folder.
4. **A voided paper.** The app's copy is renamed VOIDED and kept. Not taken: moved to Drive's trash, or
   left as it is.
5. **One paper over several jobs.** A copy in each covered job's folder. Not taken: one copy in the
   customer's folder, above the jobs.
6. **When, and the backfill.** The sweep files it within ten minutes and never runs inside the signing,
   with a press for one at once. The backfill is the same sweep, with no press of its own. Not taken: a
   backfill that waits for a press on Where files go.
7. **The link field.** `signed_document_url` stays what the office typed, and the Drive copy gets its own
   door. Not taken: the app fills the link with the Drive file.

## How to verify, once built

- PR 1's tests: the name for each kind, the due rule, each hold's words, the filter by id.
- On prod with a ZZ Test job (`live-test` recipe): sign a contract through the link. Within ten minutes
  the Contract window reads *In the job's Drive folder*, the file is under Team only › Contracts with its
  name, and Find a file finds it by a word from its terms. Void it, and the copy reads `VOIDED · `.
- Clear the ZZ job's Drive link to a broken one. The paper is held with the job's own reason, the
  signature and the emailed copy are as they were, and it files itself once the link is fixed.
- Open the Contract sweep on a ZZ sister job of the same customer. The filed copy is not offered as a
  find.
- As an estimator's sample account: Find a file finds the paper, as call 1 settled, with no **Open
  the contract** press. Where files go shows no Signed contracts card.
- After the sweep's first run on prod: six papers read *In Drive, where the office put it*, and two are
  held with their reasons.
- Trash the ZZ files and delete their `file_index` rows afterwards.
