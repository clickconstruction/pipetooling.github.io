---
name: "Search every file deeply: our own index, OCR and meaning, backfilled once by an agent"
number: 240
group: close
status: built 2026-11-03 · PR 1 v2.6319 (#6773: the index, the sweep, Find a file reading it first) · PR 2 v2.6332 (#6809: the dev seat's door, a read inside the platform's limits) · PR 3 v2.6336 (#6894: OCR behind a secret) · PR 4 v2.6338 (#6920: search by meaning behind a key) · PR 5 v2.6417 (#6899: the sweep's reconcile step, live 2026-11-03) · with v2.6369 (the index's hits at once), v2.6396 (no twin reads a file's words), v2.6408 (a 12 MB cap after a memory kill), v2.6488 (#7004: one refused OCR token no longer stops a pass) and v2.6491 (#7008: the review's four fixes — a chunk write fenced on the index stamp, the embedding queue through `file_index_embed_due`, a scan queued by its name and read on one download, held rows retaken an hour on) · the walk, the fill and the one retry ran: 4,573 rows, 2,002 with their words, every Shared Drive file with a row · left: the owner's two secrets
summary: >
  Find a file (Documents → Search, v2.6305) asks Drive's own full-text index and lands each hit on its job; PR #6752
  adds the line around the words. That finds a file by words Google has indexed, and nothing more. The owner wants
  search that reaches "deeply into every file" and never loses a file that is somewhere: a text index we own in
  Postgres (one row per Drive file, full-text ranked), fed by the sweep as files land and filled once by a backfill,
  our own OCR for scanned paper, and embeddings so a search by meaning finds the letter that never used the word.
  The backfill is to be run one time by a Claude agent session after the features land, not by a cron.
next: the owner sets `GOOGLE_DOCAI_PROCESSOR` and `GEMINI_API_KEY` (`docs/DRIVE_INTAKE_SETUP.md` → Our own OCR, Search by meaning); nothing redeploys, both are read at call time, and the sweep then reads five waiting scans and embeds ten files a run by itself; `drive-link`'s `ocr_probe` and `embed_probe`, called as a dev, say it took; tune `max_distance` from the first days' hits by meaning
size: L
blocker: the two secrets are the owner's. New files in a bid's folder outside the Shared Drive wait on decision 4. PDFs over 12 MB stay `big`, found by Drive's search, unless a heavier reader is built later.
ver: v2.6319 · 6332 · 6336 · 6338 · 6343 · 6364 · 6369 · 6396 · 6403 · 6408 · 6417 · 6488 · 6491
opinion: your call — the code is done and deployed; the two secrets are yours, and each turns its part on with no redeploy
mockup: not required — the box is the shipped Find a file; the index changes what it finds and how fast, not the screen, and PR #6752 already draws the excerpt line the index will feed
---

# Search every file deeply: our own index, OCR and meaning, backfilled once by an agent

## The ask, in the owner's words (2026-11-02)

The day every job's files landed in one Drive folder under its customer (punch list #236) and the Pipeline, the
Documents tab and Documents → Search got their doors to those files (v2.6299, v2.6301, v2.6303, v2.6305), the
owner asked what would make search "next level":

> What is a good way to make our search in the app extremely robust where we can search deep deeply into every
> file. Does that look like indexing the files as they go in with a one-time backfill where we convert all of the
> text into a markdown file per customer that says what is where. Or perhaps instead of a markdown file at JSON.
> What do you think we could do to make our search next level? 'Cause there's often situations where we need to
> search for files and we just can't find them, but they are somewhere.

The answer was the five-step plan below. The owner took it with one change:

> I like your five step plan for search and embeddings and indexing with one change, which is I would like for
> the work to be done by a Claude agent like yourself. And I would like for it to be done one time by a session
> like this after we build those features. Would you be able to help me build those features and backfill with
> this session?

Then: *Save this all in full detail to the punch list and I'm gonna let another session of another user take care
of it for me.* This card is that hand-over. Everything a cold session needs is here or linked from here.

## The decision

**An index in Postgres, not a markdown or JSON file per customer.** A `file_index` table: one row per Drive file
with its job, bid or customer, its folder path, name, kind, modified time, the **extracted text**, a `tsvector`
over name and text with a GIN index, and later an embedding. Postgres full-text search ranks, stems (*trench*
finds *trenching*), takes phrases and prefixes, and answers in tens of milliseconds, and the hit already knows its
job. A file per customer is a worse copy of the same thing: no ranking, no stemming, a second artefact to keep in
step, and nowhere to hang per-file facts. The table *is* the "what is where" file, queryable.

**Drive's own index stays as the floor.** Google indexes the text of every PDF, Doc and Sheet in the Shared Drive
and OCRs scans and pictures of paper for its own search. v2.6305 asks it through `drive-link`'s `search`. Every PR
here adds reach on top; the box falls back to Drive's index when ours has nothing, so nothing is ever lost by
building this.

**Our own OCR only where Drive's text is not ours to read.** Drive OCRs scans for its index but never hands the
text back through the API, so a scanned permit matches in Drive's search and shows no excerpt in ours. The one place
a robot earns its keep is reading those scans into our text. Google Docs export as text and text-layer PDFs read
with `unpdf` for free (PR #6752 does both today for the excerpt line).

**Meaning on top.** An embedding per file (per page for long PDFs) with `pgvector`, ranked together with the
full-text score, so *the letter where the GC agreed to the extra rock* finds the rock-clause letter when it never
says *agreed*.

**The backfill is an agent's job, run once.** Not a cron that must be right the first time: a Claude session walks
the jobs through a door built for it, reads each file, decides what deserves OCR, watches the counts, lists what it
held with the reason, and writes the report. After that the ten-minute sweep keeps the index current.

Rejected: a markdown or JSON corpus (above); Drive's *Open with Google Docs* to OCR a scan (it makes a second copy of
every file searched, and the repo's rule is one copy, in Drive); indexing in the client (the service account is
the only identity that reads every folder).

## What exists today (2026-11-02), and the ids

- **The folders.** Every job's files live in one folder under its customer in the Shared Drive **PipeTooling Jobs**
  (`0ANSfYqm0sENHUk9PVA`, clickplumbing.com's Workspace; the jobs root is the setting on Documents → Where files
  go, today the *Jobs* folder `1GuDUKC6emyGB5D62eYT3IGHajKmgV3_a`). Inside a job's folder the five names are fixed
  (`JOB_FOLDER_TREE` in `supabase/functions/_shared/whereFilesGo.ts`): *Customer Pictures*, *Plans*, *Team only* ›
  *Photos* and *Sent by us*. A job carries three links: `jobs_ledger.google_drive_link`, `job_plans_link`,
  `job_pictures_link`; a bid carries `bids.drive_link`. On 2026-11-02 all 101 live jobs (every stage but Paid in
  Full) pass Where files go's *Check pasted folders*; the app writes Drive as the service account
  `drive-intake@pipetooling-drive.iam.gserviceaccount.com` (`googleAccessToken` in `_shared/driveUpload.ts`).
- **Find a file** (v2.6305, `src/components/documents/FindAFile.tsx`, kernel `src/lib/documents/findAFile.ts`, io
  `findAFileIo.ts`): the box under the job and bid search on Documents → Search; two letters, a pause, then
  `drive-link`'s `search` — Drive `files.list` with `fullText contains`, `corpora=drive` on the root's `driveId`,
  folders left out, 30 hits, each walked up its parents to a folder the app knows a job by (the three links) or a
  bid by (`bids.drive_link`), the folders between named. Hits group under their job with folder, day, size,
  **Open in Drive**, **Open the job**. Guide: `src/content/help/find-a-file-when-you-do-not-know-where-it-is.md`.
- **The excerpt line** (PR #6752, `claude/find-a-file-excerpts`, in the merge queue as this is written):
  `supabase/functions/_shared/excerpt.ts` (`excerptOf(text, words)`, pure: the earliest place where every word
  occurs within 240 characters, about 160 characters around it on word boundaries, every occurrence marked,
  one-space neighbours merged so *rock clause* bolds as one) and `fileText` in `drive-link/index.ts` (a Google Doc,
  Sheet or Slides exported as `text/plain`; a PDF under 8 MB and 40 pages through `npm:unpdf@2.1.0` by a **dynamic
  import** so a runtime that cannot load it costs an excerpt and never the boot; a text file under 2 MB as bytes;
  each read raced against 3 s; under 20 characters of PDF text is a scan). **PR 1 lifts `fileText` into
  `_shared/fileText.ts` and reuses it; do not write a second reader.**
- **The other doors** (all shipped and deployed): *In the folders* on the job window's Documents tab (v2.6299,
  `job-photos` action `files`, `JobDocumentsFolderFiles.tsx`); the folder icon on every Pipeline row (v2.6301,
  `StagesJobFolderButton`); **Add a file** per folder on the Documents tab (v2.6303, `drive-link` `put` with
  `where: top | plans | pictures`).
- **`drive-link`** (`supabase/functions/drive-link/index.ts`, `_shared/driveLink.ts`, `_shared/driveJobFolder.ts`):
  the office door's actions are `list`, `put`, `link`, `save`, `open`, `search`; office roles only (dev,
  master_technician, assistant, controller, estimator), never a twin; a training account may `list`, `open` and
  `search`. Deploy with `supabase functions deploy drive-link --no-verify-jwt --project-ref yewfzhbofbbyvkvtaatw
  --use-api` (the build Mac has no Docker), then a bare `POST` must answer `{"error":"Sign in first."}` 401 and
  never a 503 boot error. `npm run check:edge-drift` says what is behind.
- **The sweep.** `job-drive-folders` runs every ten minutes (cron `job-drive-folders-sweep`, migration
  `20261101163412`) over the live jobs, making, moving and renaming folders. PR 1 adds the index's own sweep beside
  it rather than inside it (one job each).
- **dev-mcp** (`supabase/functions/dev-mcp`, `docs/DEV_MCP.md` if present, else the function's header): the
  agent's read-only seat plus plan/apply write verbs. The key this session held was revoked 2026-10-26; the owner
  mints a new one for the session that builds PR 2.

## The plan — four PRs, then the agent's backfill

Ship small, one PR at a time, each with its release note, fragment, guide line and docs as `CLAUDE.md` asks. Every
PR here changes `drive-link` or a new function, so **deploy right after each merge**. The queue squashes, so do not
stack these branches on one another (the lesson of #6752): cut each from fresh `main` once the one before has landed.

### PR 1 — the index, and Find a file reads it first (no decision needed)

**Migration** (`supabase db push` only, after merge; `SET lock_timeout = '3s';` first; idempotent):

```sql
create table if not exists public.file_index (
  drive_file_id text primary key,
  jobs_ledger_id uuid references public.jobs_ledger(id) on delete set null,
  bid_id uuid references public.bids(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  folder_kind text,                 -- 'top' | 'plans' | 'pictures' | 'photos' | 'sent' | 'other'
  path text not null default '',    -- the folders between the home and the file, ' › ' joined
  name text not null,
  mime text not null,
  bytes bigint,
  modified_at timestamptz,
  text text,                        -- extracted, capped (200k chars is plenty for ranking)
  text_source text,                 -- 'export' | 'pdf_layer' | 'plain' | 'ocr' | null
  text_why text,                    -- when text is null: 'scan' | 'kind' | 'big' | 'slow' | 'error'
  indexed_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(path, '')), 'B') ||
    setweight(to_tsvector('english', left(coalesce(text, ''), 200000)), 'C')
  ) stored
);
create index if not exists file_index_search_idx on public.file_index using gin (search);
create index if not exists file_index_job_idx on public.file_index (jobs_ledger_id);
create index if not exists file_index_modified_idx on public.file_index (modified_at desc);
-- the three fences every CREATE TABLE ends with (CLAUDE.md):
select public.apply_read_only_write_blocks();
select public.apply_read_only_stmt_blocks();
select public.apply_digital_twin_write_blocks();
```

RLS: the office roles read (`using (public.is_office_role())` or the predicate the sibling tables use — copy from
`uploaded_photos`); only the service role writes. An RPC `search_file_index(words text, max int default 30)`
(`security invoker`, so RLS decides) ranks with `websearch_to_tsquery('english', words)` and `ts_rank_cd`, returns
the row plus `ts_headline('english', coalesce(text, name), query, 'MaxWords=35, MinWords=20, StartSel=<mark>,
StopSel=</mark>')` as the excerpt, and the job's `hcp_number`, `click_number`, `job_name` joined in. Migration doc:
`docs/migrations/<version>_file_index.md`.

**Function.** Move `fileText` out of `drive-link/index.ts` into `supabase/functions/_shared/fileText.ts` (keep its
caps and the dynamic `unpdf` import) and add to `drive-link`:

- `{ action: 'index', driveFileId }` → reads the file's meta (`parents`, `name`, `mimeType`, `size`,
  `modifiedTime`), walks it up to its home with the `walkUp` / `folderHomes` already in `searchFiles`, reads the
  text with `fileText`, upserts one `file_index` row → `{ row }`. A read of Drive and a write of our table; the
  office may press it, a training account may not (a write).
- `{ action: 'index_job', job }` → every file under the job's folder tree (`filesUnder` already lists three levels
  deep for `list`), each indexed as above, in parallel with a cap of 8 at a time → `{ indexed, held: [{ id, name,
  why }] }`.

A new function `file-index-sweep` (cron, every 10 minutes like the folder sweep; `CRON_SECRET` as the others): one
Drive `files.list` over the Shared Drive with `modifiedTime > <last run − 2 min>` and `trashed = false`, folders
left out, each hit indexed; plus a trashed check for rows whose file no longer answers (`404` → delete the row). The
run stamps `app_settings` key `file_index_sweep_last_at`. `docs/EDGE_FUNCTIONS.md` gets its section and TOC line.

**Client.** `findAFileIo.searchJobFiles(words)` calls the RPC first; when it answers rows, the box shows them
(their `ts_headline` as the excerpt, the `<mark>` spans mapped to the existing `marks`); when it answers none, it
falls back to `drive-link` `search` exactly as today, and the count line says which answered (*from the index* /
*from Drive*). The kernel's `FoundFile` already carries `excerpt`. A tiny *Index this folder* press on the job
window's Documents tab (beside Add a file) calls `index_job` for one job, which is also how a tester fills the table
before PR 2. Guide: a short *What the search reads* section in `find-a-file-when-you-do-not-know-where-it-is.md`.

**Tests.** The RPC's ranking in a SQL bed if one exists (`supabase/tests/`), else the kernel: `findAFile.test.ts`
reads an index row into `FoundFile`; `FindAFile.render.test.tsx` shows *from the index* and the fallback; the
function's `_shared/fileText.ts` gets a vitest file for the kind routing (mime → source) with the Drive calls faked.

### PR 2 — the agent's door (needs a dev-mcp key)

In `supabase/functions/dev-mcp` (plan-then-apply like `plan_file_plans` → `apply_file_plans`):

- `read_file_index_status` → counts by `text_source` and `text_why`, rows per job, the newest `indexed_at`, the
  jobs with no rows, the sweep's last stamp.
- `plan_index_backfill { scope: 'live' | 'paid' | 'job', job_id?, since?, limit }` → the list of jobs and files it
  would index (files not in the table or modified since their row), the estimated Drive reads and seconds, and a
  `plan_hash`.
- `apply_index_backfill { plan_hash, batch: 25 }` → indexes that batch through the same code as `index_job`,
  answers `{ indexed, held, remaining }`; the agent loops.

Twin fence: a digital twin never gets these (as the other write verbs). Document the three in the function's
catalog and `docs/EDGE_FUNCTIONS.md`.

### PR 3 — our own OCR for scans (decision: provider)

When `fileText` answers `why: 'scan'` (a PDF with under 20 characters of text) or the file is an image
(`image/*`, `.heic` first converted by Drive's export is not available — send the bytes as they are), send it to the
OCR provider and store the text with `text_source = 'ocr'`. Recommended: **Google Document AI** (Document OCR
processor) in the `pipetooling-drive` GCP project, which now sits under the pipetexas.com organisation since the
2026-11-01 move; the service account the app already holds gets `roles/documentai.apiUser`, and the processor id
goes in a secret `GOOGLE_DOCAI_PROCESSOR` (`projects/<n>/locations/us/processors/<id>`). Alternative: Cloud Vision
`DOCUMENT_TEXT_DETECTION` (same account, simpler, no layout). Pricing (2026): Document AI OCR about $1.50 per
1,000 pages, Vision about the same; a few thousand pages in the backfill is tens of dollars. Cap: 30 pages per file in
the backfill, the rest on request. Store `ocr_pages`, and never OCR a file twice (`text_source = 'ocr'` and the same
`modified_at` skips).

### PR 4 — meaning (decision: embeddings provider and key)

`create extension if not exists vector;` (Supabase ships pgvector) and a `file_index_chunks` table (`drive_file_id`,
`chunk_no`, `page_from`, `page_to`, `text`, `embedding vector(<dim>)`, an HNSW index with cosine distance). Chunk a
file's text at about 800 tokens with 100 of overlap, one chunk per page for PDFs. Recommended provider: **Gemini
text embeddings** through the same GCP project (`gemini-embedding-001`, choose `outputDimensionality: 768`), one
API key in a secret `GEMINI_API_KEY`; alternatives Voyage `voyage-3` (1024) or OpenAI `text-embedding-3-small`
(1536) — the dimension is fixed at table creation, so decide first. `search_file_index` becomes hybrid: the
full-text rank and the cosine similarity of the query's embedding, reciprocal-rank fused (k = 60), top 30 files by
best chunk. The box needs no change; the count line can say *by meaning* when the top hit came from the vector side.

### The backfill — one run, by an agent session

After PRs 1 and 2 (and 3 if OCR is wanted in the first pass), a Claude session with a dev-mcp key:

1. `read_file_index_status` → the baseline (expect ~0 rows).
2. `plan_index_backfill { scope: 'live' }` → read the plan: how many files, how many Drive reads, the seconds.
3. Loop `apply_index_backfill { batch: 25 }` until `remaining = 0`, printing `indexed / held / remaining` each
   batch and sleeping a few seconds between batches (Drive allows about 12,000 reads a minute for one service
   account; stay far under it). The 101 live jobs are a few thousand files: one sitting.
4. `plan_index_backfill { scope: 'paid' }` → the back catalogue, oldest last, in the same loop over an evening.
5. Read the held list: a `why` of `big` or `slow` is left with its reason; `scan` becomes the OCR pass (PR 3) or a
   count in the report; `error` is retried once.
6. Write the report into this card's *Where it stands* (counts by source and why, the held files by job, the time
   it took, the cost of any OCR) and a one-paragraph note to the owner.

The sweep keeps the table current from then on; nothing is scheduled for the agent again.

## Where it stands

PR 1 landed as v2.6319 (#6773, 2026-11-02): `file_index`, `search_file_index`, drive-link's `index` and `index_job`, the
`file-index-sweep` cron, Find a file reading the index first, and *Index this job's files* on the Documents tab. The
backfill runner landed as v2.6343 (`scripts/file-index-backfill.mjs`, `docs/recent-features/v2.6343.md`): it walks every
job's and bid's folders through `index_job` as the dev, the ZZ test homes first, then the live jobs, the bids and the paid
jobs, resumes from a state file and keeps a local log; the counts below are prod's, never a file's name.

### The run (counts only)

Three passes from 2026-11-02 into the small hours of 11-03 UTC, all as the dev through `drive-link`, nothing written to Drive.

- **The walk** (`scripts/file-index-backfill.mjs`, 15:25Z to 16:50Z) took each job's and bid's folder in turn, three folders down:
  the 10 ZZ test homes as the dry run, then 102 live jobs, 328 bids and 180 Paid in Full jobs.
- **The fill** (`scripts/file-index-check.ts --fill`, 00:18Z to 01:53Z) took the 1,589 of the Shared Drive's 2,348 files the walk had
  not reached, which the index check (v2.6364) found. Then `--rehome` (v2.6403) walked 601 rows up to the job or bid a walk had run
  out of climb before reaching.
- **The retry** (05:12Z to 05:50Z, after PR 2's budgeted read and v2.6408's 12 MB cap) took every bid and the 48 jobs holding a
  cut-short or too-big row again, sixteen folders down this time. It met no refusal and stopped on no home.

The check after all three: the Shared Drive's 2,348 files, 0 with no row.

| The index | Rows |
|---|---:|
| Every file | 4,573 |
| With text | 2,002 |
| Scans and pictures, no text until OCR is set up | 1,587 |
| PDFs too big to read today | 605 |
| A kind the index does not read | 353 |
| Reads cut short | 23 |
| Reads that failed | 3 |

- **With text**: 1,962 PDFs through their text layer (11,680 pages; 119 read only in part, as far as one request's budget went),
  33 Google Docs, Sheets or Slides exported, 7 text files.
- **Scans**: 1,375 pictures, 212 PDFs with no text layer.
- **Too big**: 603 past 12 MB, the read's cap since v2.6408, and 2 under it; 117 are past 50 MB. Drive's own search still runs
  behind ours in the box.
- **Not read**: 137 Word and Excel files, 9 videos, 3 emails, 204 others. Word and Excel are the ones worth a later pass.
- **Cut short**: 20 still stamped `reading`, 3 `slow`; a later `--retry` takes them once their last check is an hour old.
- **Failed**: a broken PDF (*Invalid PDF structure*) and two Drive shortcuts named like PDFs, for which Drive serves no bytes.

**What the rows sit on**: 3,077 on bids, 778 on jobs, 718 on neither. 285 bids and 109 jobs carry rows. Fewer jobs than it
sounds, since 135 jobs share 55 folders and a shared folder's files are credited to one of them; count rows, not the runner's
"files walked", which lists a shared folder once for each home. 2,225 of the bid rows sit in bid folders outside the Shared Drive.

- *Click Customers*, a folder beside *Jobs* with 152 subfolders, most named for a customer, holds 716 of the rows on neither. They
  are searchable, read *Not under a job*, and their path names the customer. Whether they should attach to something is the
  owner's call.
- **Not reached**: 15 jobs with only a pictures link, since `index_job` needs the folder link. Pictures read only by name until
  OCR, so these wait.

**Proved live**: Find a file on clicktooling.com answered a ZZ test phrase *from our index* (2026-11-02, the RPC in about 130 ms).
An upload through the app had its row and its words within three seconds of landing, with nobody pressing anything. Words from
a file eleven folders deep in a plan export find it on its bid.

### The live checks after each deploy (2026-11-02 and 11-03, test data only)

- **The budgeted read** (PR 2), one call each on the ZZ test bids' held plan sets: an 11 MB set read through, as a scan; a 25 MB set ended its worker with *Memory limit exceeded* in the function's log; a 29 MB set ran out its 20-second read; a 76 MB set stayed `big`. That memory kill is why v2.6408 caps a PDF at 12 MB and a request at 16 MB. After it deployed, the 25 and 29 MB sets answered `big` in about 1.4 s with no worker ended.
- **The sweep**, twice with made-up letters put in the ZZ Test job's Plans through the app: indexed 101 s after the upload under PR 1's code, and 180 s after under PR 3's, each under the right job and folder, its phrase found.
- **Who reads the index**, one rolled-back read per role on prod: dev, master technician, assistant, controller and a human estimator read every row; subcontractor, primary, superintendent and helpers none; anon is refused. The three digital twins read every row too until v2.6396, and none since.
- **The dev seat's door** (PR 2): `read_file_index_status` answers its line, `plan_index_backfill` on the ZZ Test job hands back a hash, `apply_index_backfill` walked its 15 files (1 indexed, 14 current, the job done), and an apply quoting a stale hash is refused. Its status line says live jobs with no rows *have none yet*; an empty folder counts there too.
- **The probes**: `ocr_probe` and `embed_probe` answer *not set up* with the secret to set, and call no provider.
- **The hybrid search** (PR 4), in a rolled-back transaction on prod with made-up vectors on the two ZZ letters: words and vector together found the letter *by both* at distance 0.005, nonsense words with the same vector found it *by meaning*, and a far vector with matching words found the words' files *by words* alone, the far letter held off by the distance cap. Nothing stayed after the rollback.

### New files from here on: the owner chose the sweep plus a reconcile step (2026-11-02)

**Built as v2.6417** (2026-11-02, `_shared/fileIndexReconcile.ts`, the sweep's last step; `docs/recent-features/v2.6417.md`). What catches what:

- **What the sweep sees.** It lists by Drive's modified time. An upload through the app gets a fresh one (92 of 92 filed photos, within the
  hour), and each of the 4 files changed since the sweep began had its row within nine minutes. A deleted file loses its row within about a
  day by the rechecks.
- **What it cannot see.** A file moved into the drive keeps its old modified time: 672 of the 775 job rows are dated before the drive
  existed (2026-11-01). A file put in by hand through Drive's own page keeps its date too, proved 2026-11-03 under the ZZ Test job: a
  PDF dated 2024-03-15 showed that date in Drive and got no row across two sweep runs on the code before v2.6417. This card used to say
  a file dropped in by hand is found within minutes. That held only for a file with a fresh date; since v2.6417 it holds for any.
- **The reconcile step** (v2.6417): each run, once its stamped pass left nothing behind, also lists the whole Shared Drive against every
  row's id and takes the files with no row, newest first, forty a run, whatever their date, as the run's last step in its own catch, so
  a heavy file there costs neither the stamp nor the rechecks, and its old dates never move the stamp. About a dozen extra Drive lists
  a run at today's size; one log line a run, counts only, read through the management API's `function_logs`. Live 2026-11-03: a second
  PDF with the same 2024 date, put in at 11:50Z, had its row at 11:53Z from the step's first run after it (1 with no row, 1 taken,
  1 indexed), its modified time still 2024-03-15. Six of the seven runs in the hour after the deploy finished the step in eight to
  ten seconds; the seventh's listing met a Drive 403 that the step's own catch took, costing the stamp and the rechecks nothing, its
  reason not in the line since `driveGet` throws the status alone (one to watch: 403s on most runs would mean the dozen lists meet
  Drive's rate). No worker stopped, and the check read 0 files with no row.
- **Weighed and not chosen**: Drive's change feed (`changes.list` with a page token), which also shows a delete at once but is untested on
  a file moved in; and indexing when the app files something itself, which misses every file put in by hand.
- **Neither covers a bid's folder outside the Shared Drive**: 1,861 rows sit there. They are searchable, which Drive's own search in the
  box never reached, but no listing sees a new file in those folders. Decision 4 below is the fix, and Drive keeps a file's id through
  the move, so the rows hold.

## Decisions still open (the owner's)

1. **OCR provider** (PR 3): built on Document AI's Document OCR processor, the recommended default (v2.6336). The owner's step is the processor and the secret `GOOGLE_DOCAI_PROCESSOR`. Cloud Vision stays the alternative, a change inside `_shared/ocr.ts`.
2. **Embeddings provider and key** (PR 4): built on Gemini's `gemini-embedding-001` at 768 dimensions, the recommended default (v2.6338). The owner's step is the key in the secret `GEMINI_API_KEY`. Another provider means a new table, since the dimension is fixed with it.
3. **A dev-mcp key**: no longer open. The seat answers again since 2026-11-02, and the door ran its live test.
4. **The estimators' bid folders.** Every plumbing bid's folder sits in the owner's **My Drive**, in a folder of
   the estimators' own (40-plus bid folders for Aug–Oct 2026 alone, with HVAC and electrical siblings), outside the
   Shared Drive. Drive's own search in the box is scoped to the Shared Drive and does not reach them; our index does,
   from the walk (1,861 rows on 2026-11-02), but no listing sees a new file there, and the folder
   maker holds every bid that becomes a job until its folder is moved (job 523 on 2026-11-02). The fix is one Drive
   move of the whole folder into PipeTooling Jobs **after the estimators are made members of the Shared Drive**
   (else they lose edit access when ownership moves). Owner's call; not part of this card's code.

## Where it plugs in

| Exists | New |
|---|---|
| `supabase/functions/drive-link/index.ts` — `searchFiles`, `folderHomes`, `walkUp`, `fileText`, `excerptFor` | `_shared/fileText.ts` (moved), actions `index` and `index_job`, the fallback order |
| `supabase/functions/_shared/excerpt.ts` — the cut and the marks | reused for OCR text; `ts_headline` for index hits |
| `_shared/driveJobFolder.ts` — `driveGet`, `driveMedia`, `childFolder`, `jobFolder` | — |
| `_shared/driveSettings.ts` — `jobsRootFolderId`, `driveFolderMeta` (the `driveId`) | the sweep's stamp key |
| `src/lib/documents/findAFile.ts`, `findAFileIo.ts`, `src/components/documents/FindAFile.tsx` | index-first io, the *from the index* words |
| `jobs_ledger` (three links), `bids.drive_link`, `uploaded_photos`, `drive_links` | `file_index`, `file_index_chunks`, RPC `search_file_index`, `file-index-sweep` function, dev-mcp verbs |
| `docs/EDGE_FUNCTIONS.md` drive-link section; the guide *find a file when you do not know where it is* | the sweep's section; the guide's *What the search reads* |

## How to verify

- **Unit and render**: `npx vitest run src/lib/documents src/components/documents` (the suites above) plus
  `src/lib/releaseNotes.test.ts`, `helpGuideContent.test.ts`, `helpGuidePlainWords.test.ts`,
  `helpGuideLinks.guides.test.ts`, `helpShareCard.guides.test.ts`; `npx eslint` on the changed files;
  `node scripts/theme-tokenize.mjs --check src`, `npm run check:dead-press`, `npm run check:empty-words`,
  `npm run check:error-words`. The function files are not under `tsc`'s `tsconfig.json` (it includes `src` only)
  and the build Mac has no Deno: check them by eye and by the boot probe after deploy.
- **Migration**: `npm run check:migration-drift` before and after `supabase db push` (from a clean `main`
  checkout; list pending first).
- **Live, on test data only** (the repo and its pages are public; no customer rows in docs or fixtures): the ZZ
  test jobs (Pipeline tools → *ZZ test jobs*); put a small PDF with a known phrase into a ZZ job's Plans with the
  Documents tab's **Add a file**, press *Index this folder*, then search the phrase on Documents → Search: the hit
  must say *from the index*, land on the ZZ job, and show the phrase bold. Then search a phrase from a scanned PDF
  before PR 3 (expect Drive's fallback hit with *Matched inside the scan*) and after it (expect the index hit with
  the OCR'd line).
- **Timing**: the index RPC should answer under 100 ms; Drive's `search` answers in 1–3 s (measured 2026-11-02 at
  about 1.6 s per `job-photos` call on the same path). In the browser pane the network list misses edge-function
  calls; wrap `window.fetch` in-page to log them, or read `performance.getEntriesByType('resource')` after
  `performance.setResourceTimingBufferSize(3000)`.

## Gotchas met on the way here

- **Drive's API cannot move a folder into a Shared Drive** (`teamDrivesFolderMoveInNotSupported`); only the Drive
  UI can, by a member of the destination (robert@clickplumbing is a Manager). Files can be moved by the API.
- **Drive's search API returns which files match, never the passage**; `fullText contains` with two words is both
  words, not a phrase (quote inside the term for a phrase). It does not expose OCR text.
- **`npm:` imports in an edge function**: `npm:unpdf@2.1.0` works when imported dynamically inside the read; a
  static import at the top is a boot risk the probe would catch too late. `getDocumentProxy` then `extractText(pdf,
  { mergePages: true })`; check `pdf.numPages` against the cap first; race every read against a timer (the
  serverless build has no worker).
- **The merge queue squashes**, so a PR stacked on another is dropped when the first lands (add/add conflicts on
  every file the first PR added). Cut each PR from fresh `main`; if a stack is unavoidable, after the first lands
  merge `main` in and keep yours on every conflicted file (`git checkout --ours -- <file>`; in zsh iterate with
  `while read`, an unquoted `$var` does not split), never rebase or force-push.
- **Edge functions and the client deploy on different tracks**: the client is live on the next Pages deploy, the
  function only when you deploy it. A client calling a function action the deployed function lacks gets *That is
  not an ask this door takes.* (400), a refusal, not a lost signal — deploy right after the merge.
- **`form_input` into the Edit tab's url fields does autosave** (confirmed by a full reload); the job maker's 409
  body is readable only in-page (see Timing above).
- Every new guide sentence obeys `src/lib/plainWords.ts` (one idea, under 20 words, no dashes or parentheses);
  every new table ends with the three fence calls; stage files by name, never `git add -A`.

## Sources

- [Drive API: search for files and folders](https://developers.google.com/workspace/drive/api/guides/search-files)
  (`fullText`, `corpora`, `driveId`)
- [Postgres full text search: controlling text search](https://www.postgresql.org/docs/current/textsearch-controls.html)
  (`websearch_to_tsquery`, `ts_rank_cd`, `ts_headline`)
- [pgvector](https://github.com/pgvector/pgvector) (HNSW, cosine) and
  [Supabase: pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)
- [Document AI pricing](https://cloud.google.com/document-ai/pricing) ·
  [Cloud Vision pricing](https://cloud.google.com/vision/pricing)
- [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings) (`outputDimensionality`)
- [unpdf](https://github.com/unjs/unpdf) (serverless PDF.js build)
- Punch list #236 (`to-dos/job-folders-under-customers.md`) for the folder tree, the Shared Drive move and the
  service account; `docs/recent-features/v2.6299.md`, `v2.6301.md`, `v2.6303.md`, `v2.6305.md` for the doors.
