# Drive intake — service-account setup

---
file: docs/DRIVE_INTAKE_SETUP.md
type: Runbook / Setup
purpose: One-time Google setup for the drive-intake edge function (estimator-twin pipeline Wave 4.4) — a SERVICE ACCOUNT, never a user password. Five minutes in console.cloud.google.com, two supabase secrets, one deploy.
audience: Owner, Developers
last_updated: 2026-11-04
---

Why a service account: the function needs a robot identity that can write ONE shared
folder. A service account has no password, no inbox, no recovery flow — you share the
folder with its generated email like any collaborator, and revoking is unsharing (or
deleting the key). Never wire a human Google password into anything.

## One-time setup (any Google account can own it)

1. **console.cloud.google.com** → project picker → *New project* → name `pipetooling-drive`
   (any org). Wait for it to create, select it.
2. **APIs & Services → Library** → search *Google Drive API* → **Enable**.
3. **IAM & Admin → Service Accounts → Create service account** → name `drive-intake` →
   Create and continue → **skip roles entirely** (Drive access comes from folder sharing,
   not IAM) → Done.
4. On the new account → **Keys → Add key → Create new key → JSON** → a `*.json` file
   downloads. This file IS the credential — it goes into secrets and then gets deleted.
5. Copy the service account's email (`drive-intake@pipetooling-drive.iam.gserviceaccount.com`).
   Open the shared **jobs folder** in Drive → Share → paste that email → **Editor** → send
   (untick notify).
6. Secrets + deploy (PT project):

   ```bash
   supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(cat ~/Downloads/pipetooling-drive-*.json)"
   supabase secrets set DRIVE_JOBS_FOLDER_ID=1HvqiyMzVGOLWiynl5Vib_RMuMGkmPbvL
   supabase functions deploy drive-intake
   rm ~/Downloads/pipetooling-drive-*.json
   ```

   (The folder id is the last path segment of the folder's Drive URL.) Since v2.6056 (Where files go, punch list #211)
   the office can set the jobs root itself on **Documents → Where files go**, which checks the app can write there
   before saving; the `DRIVE_JOBS_FOLDER_ID` secret is the root only while that setting is empty, and every
   function that makes a folder under the root reads it through `_shared/driveSettings.ts`.

## Using it

- **Agents**: twin-mcp `file_plans` (bid + optional plans_url) — twin token auth,
  assignment-is-the-grant.
- **Staff**: `POST /functions/v1/drive-intake` with the app session
  (`{"bid":"b403","plans_url":"…"}`) — estimator+.
- Behavior: finds-or-creates the bid's folder, named by the office's bid pattern on
  Documents → Where files go (the project name as it ships; a bid whose `drive_link` is
  already a folder keeps it, v2.6058), optionally
  fetches `plans_url` into it, stamps `drive_link`/`plans_link` on the bid (set-if-empty),
  and writes the `[pipeline STG-1]` audit note. Idempotent — re-runs reuse the folder.
- **Drive-hosted sources (v2.2499)**: a `plans_url` that is a Drive file link
  (`file/d/<id>`, `open?id=`, `uc?id=`) is fetched with the **SA's own token**, so plan
  intake from an existing Drive folder is a pure Drive-to-Drive copy keeping the source
  filename. The source (file or any ancestor folder) must be **shared with the SA**
  (Viewer is enough) — watch for Google's "sharing outside your organization → Share
  anyway" confirmation, which silently kills the share if dismissed (bit us live
  2026-08-30). Non-Drive URLs fetch unauthenticated as before; a failed upload never
  fails the call (`upload_note` says what to do).
- **GC mode's trade partner portal (P5a-1, v2.5172)**: `submit-gc-trade-portal`'s kind
  `file` uploads a trade's file into the GC job's own folder (`gc_projects.drive_folder_url`,
  made by `gc-drive-access`) with the same SA and the same secrets, no new one. A submittal's
  file goes to the job's **Submittals** folder; any other to **Team only → From trades →
  <company>**. Each folder is found or made by name, and each file is a new upload
  (`uploadBytes`) named so no two meet. The app keeps the link in `gc_trade_files`, never a copy.
  Since P5a-2 (v2.5175) a lien waiver the trade signs in its portal lands in the same **From trades
  → <company>** folder as the signed PDF the function builds, once `WAIVER_SIGN_LIVE` is on. Since
  P5b-2 (v2.5225) a trade's insurance certificate, which is its own and on no job, goes under the jobs
  root itself (`DRIVE_JOBS_FOLDER_ID`, the same secret) to **GC trade partners → <company>**; a missing
  root fails the upload, logged.
- **A Pipeline job's folders (Materials on site, v2.6054; under the customer since v2.6284)**:
  `job-drive-folders` keeps root › `<customer>` › `<job number> · <job name>`, with **Customer Pictures**,
  **Plans** and **Team only** (Photos, Sent by us) inside, behind the office's **Make the job's Drive
  folders** press, the Materials desk's backfill, **Tidy the folders** on Where files go and the cron
  `job-drive-folders-sweep` (every 10 minutes, `_shared/jobFolders.ts`); the same SA and secrets, nothing
  new to set up. A folder the office made by hand inside the Shared Drive is kept, then moved and renamed
  into place; Drive keeps its id, so every link holds. One the SA cannot open or add to must be shared
  with the SA as an **Editor**; the press says so, with the SA's address. One in a person's My Drive is
  never moved, and sharing it does not help, since the SA can make folders there but cannot own a file:
  the job is held with the reason (`jobs_ledger.drive_folder_hold`) until someone moves the folder into the
  Shared Drive, and the sweep adopts it within a week, or at once on **Tidy the folders**. Since v2.6056
  the folder is named by the office's pattern (Documents → Where files go, `_shared/whereFilesGo.ts`),
  `<job number> · <job name>` as it ships.

## The upload leg: RESOLVED — Shared Drive (live since 2026-08-29)

The jobs root now lives in a **Workspace Shared Drive**, which is why uploads work: files
in a Shared Drive belong to the drive, not a person, so the SA quota rule ("Service
Accounts do not have storage quota", found live 2026-08-29 — SAs cannot own file bytes in
a My Drive folder) never applies. Live config, end-to-end verified (folder create + PDF
byte-upload + both stamps through the deployed function):

- Shared Drive **"PipeTooling Jobs"** (`0ANSfYqm0sENHUk9PVA`) in the **clickplumbing.com** Workspace, created
  2026-11-01 by `robert@clickplumbing.com` (v2.6293; the first drive of that name, `0AI1sqwYSeegpUk9PVA` in
  douglasmining.com, is renamed *PipeTooling Jobs (old, Douglas Mining)* and emptied). Members: the owner and the
  office manager as Manager, the SA as Content manager. The dev seat's bid-plans filing names the drive by this id
  (`ROBOT_PLANS_SHARED_DRIVE` in `_shared/bidPlansFolders.ts`), so a new drive is a code change too. The SA, its
  key and the Maps key did not move: an SA is a GCP identity and sits in any organization's drive as a member.
  Left for another day: the GCP project `pipetooling-drive` into clickplumbing.com's Cloud organization, and the
  bids reader onto bids@clickplumbing.com (`GMAIL_IMPERSONATE_USER`).
- `DRIVE_JOBS_FOLDER_ID` = the **Jobs** folder inside it (`1GuDUKC6emyGB5D62eYT3IGHajKmgV3_a`); since v2.6056 the
  office's setting on Documents → Where files go names the root first and the secret is its fallback.
- `DRIVE_IMPERSONATE_USER` was **unset** at cutover: the domain-wide-delegation grant was
  never made, and with the var set but ungranted, every upload fails at token exchange —
  set it only after actually authorizing delegation in the admin console.

Found live during cutover:
- The SA **cannot create Shared Drives** (`userCannotCreateTeamDrives`) — a human creates
  the drive and shares it with the SA; after that the robot does everything (it finds the
  drive via `drives.list` as a member).
- The SA could upload but not delete its own probe file (404 on delete) — likely a
  member-role ceiling; harmless for intake (it only ever adds).

## Domain-wide delegation

The SA's client **is** on the Workspace's domain-wide delegation (admin.google.com → Security → Access and data
control → API controls → Manage domain-wide delegation → the client of `drive-intake@…`), for Gmail alone: the grant
holds `https://www.googleapis.com/auth/gmail.modify` (the bids@ reader `gmail-sync`, Messages → My email
`gmail-mine`) and `https://www.googleapis.com/auth/gmail.metadata` (`gmail-count`), and since v2.6565 the dev seat's
`search_mail` / `read_mail` ask for `https://www.googleapis.com/auth/gmail.readonly` and nothing wider — add that
line to the client and Authorize, or every search answers *refused* with this step named. A grant is per scope, never
per account: every login of the Workspace is readable under it, the admins' included, and the fences are the scope
(read-only cannot label, trash or delete; `gmail.modify` can trash but not delete for good, which only
`https://mail.google.com/` allows — keep that one off) and the code. The Drive scope
(`https://www.googleapis.com/auth/drive`, then `DRIVE_IMPERSONATE_USER` and a redeploy) was never added: the Shared
Drive is the chosen path for files — tighter blast radius than impersonating a user — and the SA sits in a drive a
person makes.

## Where the dev seat files a plan set (v2.6185, v2.6241)

The dev seat's `apply_file_plans` files a plan set as the service account into the **"PipeTooling Jobs" Shared
Drive**, in **Bid plans › Plumbing / Electrical / HVAC › <project>** (`ROBOT_PLANS_SHARED_DRIVE` in
`supabase/functions/_shared/bidPlansFolders.ts`). It makes each level the first time. Bid plans sits at the drive's root
beside Jobs, so the job-folder sweeps never read it as a job. Apply stamps the bid's plans link with the project folder,
so no Find is needed, and the Bid Board opens it in one tap.

The office's three division bid folders (the same file: the folders the bid form's Find looks in) stay **View** for
the service account. They sit in a My Drive, where a service account can make a folder but cannot own a file: on
2026-10-31 the first live run (ZZ bid b566) was refused for permission while they were View, and for storage quota once
the owner made them Edit. That is why v2.6241 moved the filing to the Shared Drive; Edit on the division folders buys
nothing and can go back to View. When Drive refuses, the verb (`driveFilingRefusal`) names the reason, the service
account, where it stopped and the grant that fixes it, keeps the staged copy so the same plan applies again, and tells
the agent that a person can drop the file into the division folder and press Find the folder on the bid form.

## The people's files (v2.6393)

A person's evidence (People → HR, the person file, `HR_FILES.md` → Evidence) is filed by `hr-evidence-drive` under the
**People folder** the office sets on Documents → Where files go (`drive_people_folder_id`), as *<People folder> › <Person's
name> › <YYYY-MM-DD · title> › the files*. **It lives in a Shared Drive of its own** (the owner's call, 2026-11-02): the
Jobs drive's members would read the evidence there while the app keeps it dev-only, so `set.people` refuses a folder whose
Shared Drive is the jobs root's. One-time setup, by a person (the SA cannot make a Shared Drive): a licensed
clickplumbing.com user makes Shared Drive **PipeTooling People**, adds the owner as Manager and the SA
(`drive-intake@pipetooling-drive.iam.gserviceaccount.com`) as Content manager and nobody else, opens the drive and pastes
its link on the People folder card (the drive's own id serves as the folder), presses Check, then Use this folder. The same
SA, key and secrets; nothing new to set up on the functions.

## Our own OCR (punch list #240, PR 3, v2.6336)

The file index (`file_index`, Find a file's first answer) reads a Google Doc's export, a PDF's text layer and a text
file's bytes by itself. A scanned PDF or a picture of a page has no text to read, so the index sends it to **Google
Document AI's Document OCR processor** as the same service account, once one secret names the processor. Until then a
scan sits in the index as `text_why = 'scan'` and Find a file falls back to Drive's own search for it, as before.

One-time setup, in `console.cloud.google.com` on the `pipetooling-drive` project:

1. **APIs & Services → Library** → *Cloud Document AI API* → **Enable**.
2. **Document AI → Processors → Create processor** → *Document OCR* → region **us** → Create. Copy the processor's
   name from its Overview: `projects/<number>/locations/us/processors/<id>`.
3. **IAM & Admin → IAM** → Grant access → principal `drive-intake@pipetooling-drive.iam.gserviceaccount.com` → role
   **Document AI API User** (`roles/documentai.apiUser`) → Save.
4. The secret, no redeploy (it is read at call time):

   ```bash
   supabase secrets set GOOGLE_DOCAI_PROCESSOR="projects/<number>/locations/us/processors/<id>" --project-ref yewfzhbofbbyvkvtaatw
   ```

5. Prove it with one call as the dev: `POST /functions/v1/drive-link { "action": "ocr_probe" }` sends a one-pixel PNG
   through the processor and answers the provider's own words (`answer.ok` with an empty text and one page when it is
   right; `answer.error` with Google's reason when it is not).

From then on the sweep reads five waiting scans every ten minutes, and every index pass (a press, the backfill, the sweep's own first step and its reconcile step) reads at most five scans of its own, so a sweep run reads at most fifteen scans, at most about 1,350 pages an hour at fifteen pages a scan (the scans the backfill held catch up by
themselves), `index_job` and the dev seat's backfill read a scan the first time they meet it, and every row keeps how
many pages were read (`ocr_pages`). A scan the sweep takes costs one download: its bytes go straight to the processor
and the row keeps the text, and a scan Drive lists as `application/octet-stream` is queued by its name (v2.6491).
Fifteen pages per scan at most (the online limit); about $1.50 per 1,000 pages. A
scan the provider refuses is tried again a day later, the reason on the row (`ocr_note`). Rotation: delete the
processor, or unset the secret, and every scan stays a scan.

## Search by meaning (punch list #240, PR 4, v2.6338)

Once one secret holds a Gemini API key, every file in the index gets a vector per chunk of its text
(`file_index_chunks`, `gemini-embedding-001` at 768 dimensions) and Find a file fuses the words' rank with the nearest
chunks, so a search finds the letter where the GC agreed to the extra rock when it never says "agreed". Until then
the words alone answer, as before.

1. A Gemini API key: **aistudio.google.com → Get API key → Create API key** in the `pipetooling-drive` project (or any
   project of the Workspace; the key is the whole credential).
2. The secret, no redeploy (it is read at call time):

   ```bash
   supabase secrets set GEMINI_API_KEY="<the key>" --project-ref yewfzhbofbbyvkvtaatw
   ```

3. Prove it with one call as the dev: `POST /functions/v1/drive-link { "action": "embed_probe" }` embeds one made-up
   sentence and answers `answer.ok` with `dimensions: 768`, or `answer.error` with Google's reason.

From then on every file the pass indexes is embedded as it lands, the sweep embeds ten more files every ten minutes
(the files indexed before the key, and any file whose chunks are older than its text, catch up by themselves; a file
indexed again while its chunks were being made is embedded again from its new text, v2.6491), and a search embeds the
query. Forty chunks of about 800
tokens per file at most. A file the provider refuses is tried again a day later, the reason on the row (`embed_note`).
`search_file_index_meaning`'s `max_distance` (0.45) is the tunable: read the first days' hits by meaning and move it to
where the noise starts. Rotation: delete the key, or unset the secret, and the words alone answer again; a file's
chunks stay until the key returns and the sweep embeds it afresh, unless an index empties its text, which drops them.

## Rotation / kill

Delete the key in console (or `supabase secrets unset GOOGLE_SERVICE_ACCOUNT_JSON`);
unshare the folder to sever access entirely.
