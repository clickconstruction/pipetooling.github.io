# P5a: files from the portal (Portal lane)

A trade partner sends its files from its portal: a submittal round's file, a change request's photo or ticket, and its quote's PDF. Each goes into the job's Drive folder, and the app keeps the link, never a copy (the owner's call, `PORTAL_REAL_BUILD.md` decision 9; Building's decision 6). The waivers a trade signs in its portal are kept as signed PDFs beside them, once the owner turns waiver signing on.

Today each of those says to email the file: the quote form (`replyByEmailWords`), Ask for a change (`changeFileByEmailWords`), and a submittal round types a file name and an optional Drive link (P5c-2). P5a replaces each with a picker. The typed Drive link stays as the other way, for a file over the cap.

**Not in P5a**: the company's own papers (insurance, the W-9, the vetting form) are P5b, after the Board's B6-d. A back-charge dispute keeps its words only: the charge's photo is the office's (`gc_back_charges.photo_url`).

## Who owns what (the seams)

| What | Whose | When |
|---|---|---|
| `uploadBytes` in `_shared/driveUpload.ts` | Portal (P5a-1), a shared change | its deploys are the lead's: every function that bundles the file |
| `gc_trade_files`, and the two verbs that take a file link | Portal (P5a-m) | first |
| The pickers in the portal | Portal (P5a-1) | after P5a-m on prod |
| The signed waiver as a PDF | Portal (P5a-2) | held by `WAIVER_SIGN_LIVE` with the presses that make it |
| A waiver's PDF link in the Draws window | Building's `GcDrawsWindow.tsx`, with its owner's yes | P5a-2 |
| The company window's list of its files | Board's `GcCompanyDocuments.tsx` | later, on the Board's word |

## The kind `file` (P5a-1)

One kind on `submit-gc-trade-portal` puts one file in Drive and answers its link. The page then sends the kind that stores the link, as decision 9 has it.

| Field | What |
|---|---|
| `for` | `submittal`, `change` or `quote` |
| `submittalId`, `packageId` or `inviteId` | the record it is for: a submittal, the trade a change is asked on, the ask a quote answers |
| `name` | the trade's file name, 200 characters at most |
| `base64` | the file, as `contract-form-paper-entry` takes its scan |

In order, after the link and the hold checks every kind has:

1. **The shape**: a `for` the page sends, an id that is the company's own (its submittal on a trade awarded to it, its trade, its open ask), a name.
2. **The type, by the file's first bytes, never its name**: a PDF (`%PDF`), a JPEG, a PNG, or a phone's HEIC or HEIF photo. Anything else is `fileType` (400).
3. **The size**: 10 MB at most once decoded (decision 9), `fileTooBig` (400). The page checks it first and says so before it sends.
4. **The hourly cap**: 20 files a company an hour, counted from `gc_trade_files`, `tooMany` (429). Files count apart from the free-text writes.
5. **The folder**: the job's folder is `gc_projects.drive_folder_url` (made by `gc-drive-access` `make_folders`). None is `noJobFolder` (409): "Email it to <project manager> for now." A submittal's file goes to the job's **Submittals** folder, beside Plans and Team only (Building's decision 6). Every other file goes to **Team only → From trades → <company>** (decision 9). Each folder is found or made by name (`findOrCreateFolder`).
6. **The name in Drive** never meets another: a submittal's is `<number> round <n> - <name>` (`26 24 16-01 round 2 - panelboards.pdf`), any other `<YYYY-MM-DD HHmm> - <name>`. So `uploadBytes` always uploads, where `uploadFromUrl` reuses a same-name file.
7. **The upload**, then the row in `gc_trade_files`, then the answer `{ id, name, url }`.

The page sends the next kind with the link: `submittal_send`'s `driveUrl` (and `fileName`), `ask_change`'s new `fileUrl`, and the quote's `file`. A file uploaded whose next kind is refused stays in Drive and in `gc_trade_files` without its record. The office sees it in the folder. The trade's next try uploads it again under a new name.

**The keys** (EN and ES): `fileType` (400) "Send a PDF or a photo.", `fileTooBig` (400) "That file is over 10 MB. Email it to <project manager>, or paste its Drive link.", `noJobFolder` (409) "Email it to <project manager> for now."

## The byte upload (a shared change)

`_shared/driveUpload.ts` gains `uploadBytes(token, folderId, bytes, name, mime)`: one multipart upload, no reuse by name. `uploadFromUrl` keeps its reuse-by-name and calls `uploadBytes` for its upload half, so its callers behave as before.

Four functions bundle the file once P5a-1 merges, and the lead deploys all four: `drive-intake`, `file-submittal-package`, `gc-drive-access` and `submit-gc-trade-portal`. `submit-gc-trade-portal` reads `GOOGLE_SERVICE_ACCOUNT_JSON`, as `gc-drive-access` does.

## The ledger and the two verbs (P5a-m)

**`gc_trade_files`**: one row for each file a trade put in Drive from its portal, and each signed paper the portal made for it.

| Column | What |
|---|---|
| `id`, `company_id`, `project_id`, `package_id` (null on a quote) | whose and where |
| `purpose` | `submittal`, `change`, `quote` or `waiver` |
| `record_id` | the record it went with once the next kind stored it: the round, the change request, the quote, or the draw a waiver is on. Null until then |
| `name`, `mime`, `bytes` | as uploaded |
| `drive_file_id`, `drive_url` | the file in Drive |
| `made_by` | `trade` for an upload, `portal` for a signed paper the function made |
| `uploaded_at` | when |

Its RLS lets the office team (`gc_office_team()`) read it, and only the service role writes it. The migration ends with the three block calls, as every new table does.

**`gc_trade_ask_change`** gains `p_file_url text DEFAULT NULL` into `gc_trade_change_requests.file_url`, already a column. **`gc_trade_submit_quote`** reads `q->>'file'` into `gc_quotes.quote_file`, already a column. Each takes an https link or none, as `submittal_send`'s `p_drive_url` does. Each sets the matching `gc_trade_files.record_id` when the link is one of the company's own rows.

## The signed waiver as a PDF (P5a-2)

When a trade signs a waiver in its portal (`unconditional_waiver`, and `pay_app` or `final_pay_app` with their conditional waiver), the function makes the signed paper after the verb and the ledger row. It is the app's own form: a copy of `lienWaiverRelease.ts`'s title and paragraphs in `_shared/lienWaiverWords.ts`, with a test holding the two equal, laid out by `pdf-lib` as `jobContractPdf.ts` lays out a contract. The typed name sits on the signature line in the cursive face `contract-form-paper-entry` loads. Under it are the day signed, the e-sign audit line and the statute line (`LIEN_WAIVER_ESIGN_LINE`).

It is filed in **Team only → From trades → <company>** as `<form title> - <trade> - draw <n> - signed <YYYY-MM-DD>.pdf`, with its `gc_trade_files` row (`purpose` `waiver`, `record_id` the draw, `made_by` `portal`). It is best effort, as the ledger row is: a failed file is logged and never undoes the signature. It runs only when the presses run, so `WAIVER_SIGN_LIVE` holds it with them.

## What the office sees of a trade's file

- **A submittal round**: its file's name and Drive link in the Submittals window, from `gc_submittal_rounds.drive_url`, as a round recorded by email shows today.
- **A change request**: its file in Change orders, from `gc_trade_change_requests.file_url` (`GcChangeOrders.tsx` draws `r.file` already).
- **A quote**: *Their file* on the company window and the quote, from `gc_quotes.quote_file` (`companyFile.ts` reads it already).
- **A signed waiver**: a **Signed waiver (PDF)** link on the draw's waiver chip in the Draws window, from `gc_trade_files`, with Building's yes on its file.
- **Every file**, in the job's Drive folder, which the office's Shared Drive opens. The trade sees its file's name in its portal, never a link: Team only and Submittals are not shared with it.

## The PRs, in order

1. **P5a-m, the migration**: `gc_trade_files` with its RLS and blocks, `gc_trade_ask_change`'s `p_file_url`, and `gc_trade_submit_quote`'s `file`, with a bed (`gc-portal-p5a`).
2. **P5a-1, the pickers** (after P5a-m on prod): `uploadBytes`, the kind `file` with its keys, the three pickers, the words. The lead deploys the four functions.
3. **P5a-2, the signed waiver's PDF**: `_shared/lienWaiverWords.ts` with its equality test, the PDF, the Draws window's link. Held by `WAIVER_SIGN_LIVE`.

## Tests

- **P5a-m**: the bed: the table's grants and RLS (the office reads, nobody else writes), the two verbs storing a link, another company's link left without its record.
- **P5a-1**: the kind's shape, type by first bytes (a PDF named `.jpg` passes, a ZIP named `.pdf` is refused), the size, the cap, the two folder rules and the names; the page's pickers (a file too big is said before it sends, the next kind carries the link); `uploadBytes` against a stubbed fetch, and `uploadFromUrl` unchanged for its callers.
- **P5a-2**: `lienWaiverWords.ts` equal to `lienWaiverRelease.ts` for the four forms; the PDF's text holds the form's paragraphs, the name and the day; a failed upload leaves the signature standing.

## Docs

`EDGE_FUNCTIONS.md` (the kind, its keys, `uploadBytes` and the four bundlers); `ACCESS_CONTROL.md` (the table's read, the service role's writes); `docs/migrations/<stamp>_gc_portal_p5a_files.md`; `PROJECT_DOCUMENTATION.md`; `docs/DRIVE_INTAKE_SETUP.md` (the From trades folder); the guides `share-a-trade-partner-its-portal`, `see-what-a-trade-partner-sends-from-its-portal` and `send-a-trades-submittal-to-the-architect`.

## The live check

Each upload writes to the test project's Drive folder. It waits for the owner's yes, typed in the Portal helper's own chat. Then: a test PDF lands in the test project's **Team only → From trades** folder and its link is on the quote (`PORTAL_REAL_BUILD.md` step 9's check); a photo on a change request; a submittal round's file in **Submittals**. A 10 MB PDF goes through, or the cap drops to 8 MB, the size `contract-form-paper-entry` takes.

## Decisions (defaults; say if any is wrong)

1. **One kind, `file`, then the kind that stores the link** (decision 9). *The other way:* each kind carries its own file. Not taken: three kinds would each learn files, and a refusal of the record would lose the upload's reason.
2. **The file in the JSON body as base64**, capped at 10 MB, as `contract-form-paper-entry` takes its scan. *The other way:* a signed upload to a Storage bucket, then a move to Drive. Not taken: the app would keep a copy for a moment, against decision 9, and it is two presses for the trade's one.
3. **Types by first bytes**: PDF, JPEG, PNG, HEIC and HEIF. No Word file, spreadsheet or ZIP: the trade saves a PDF.
4. **Drive names never meet**: `uploadBytes` always uploads. A submittal's name carries its number and round, any other the minute.
5. **20 files an hour**, apart from the free-text cap.
6. **A ledger of the trade's files** (`gc_trade_files`), so the office can list a company's files and a waiver's PDF has a home without a column on `gc_draws`.
7. **The signed waiver's PDF is made by the function**, from a `_shared` copy of the app's forms held equal by a test. The trade's browser never makes the legal paper.
8. **No virus scan of our own**. Drive scans what it serves, and the trade's file opens only in our Shared Drive.

## The owner's calls

1. **The live checks**: the owner's yes, typed in the helper's own chat, before any upload on the test link.

## Is this the best we can do?

1. **A link the trade can open.** Its own files could sit in a folder shared with it, so the portal shows a link, not a name. *My pick: not now.* Team only stays ours, and the trade keeps its own copy.
2. **Every office screen reads `gc_trade_files`.** The company window could list a company's files with their record. *My pick: on the Board's word*, after P5a-1, in `GcCompanyDocuments.tsx`.

## Status

Planned 2026-10-10 for the lead's read-back. Nothing cut.
