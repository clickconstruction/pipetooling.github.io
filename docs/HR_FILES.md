# HR files (People → HR, dev-only)

---
file: docs/HR_FILES.md
type: Feature reference + agent writing convention
purpose: The dev-only per-person HR files system — schema, access model, the People → HR tab, and (most importantly) the convention any agent or dev follows when writing to it.
audience: Developers, AI Agents
last_updated: 2026-11-03
---

## What this is

Per-person HR files, visible to **devs only**, maintained mostly by an AI agent connected to Supabase. Three layers per person, keyed on `people.id`:

| Layer | Table | Mutability | What it is |
|---|---|---|---|
| **Raw entries** | `person_file_entries` | **Append-only** (no UPDATE/DELETE policies exist) | Dated facts: what happened, when, from where. The source of truth. |
| **Summary** | `person_files` (`kind='summary'`) | Rewritten freely — **prior versions auto-archive** (v2.2232) | ≤1 page: trajectory, reliability, pay, watch items. Read first. |
| **Narrative** | `person_files` (`kind='narrative'`) | Extended, occasionally consolidated — **prior versions auto-archive** (v2.2232) | The chronological story, oldest → newest. |
| **Doc history** | `person_file_revisions` | Written only by trigger; dev read-only | Prior version of every summary/narrative rewrite (v2.2232). |
| **Evidence** | `person_file_evidence` + `person_file_attachments` | **Append-only** (no UPDATE/DELETE policies; the Drive stamps are the service role's) | A piece of evidence (v2.6392): the day it is about, a title, a memo on what it shows, its files, filed in Drive under People › the person › the day and the title (v2.6393). |

Shipped in the v2.2220–v2.2221 train: migration `20260824025109_person_hr_files.sql` (see `docs/migrations/`), tab `src/components/people/PeopleHrTab.tsx`, freshness kernel `src/lib/people/personFileFreshness.ts`. Extended in v2.2232 (`20260824141540_person_hr_files_v2.sql`): revisions table + archive trigger, `person_files.covered_through` (explicit coverage marker), `author_label` provenance columns, the `hr_agent_write(jsonb)` RPC, and the least-privilege `hr_agent` role.

## Access model — read before touching

- RLS on both tables gates every verb on `is_dev()`. No other role can read a row through the app or PostgREST, ever.
- `person_file_entries` deliberately has **no UPDATE or DELETE policy**. Append-only is enforced by policy absence, not discipline. A wrong entry is corrected by a **new entry** that says so. Break-glass edits are dev SQL only.
- **RLS does not bind the agent**: an agent on service-role/MCP credentials bypasses RLS. The policies protect the app surface; the convention below is the agent-side guardrail. That asymmetry is by design — the agent is at dev trust level.
- Read-only training mode users are blocked by the standard restrictive blocks (both applied in the migration).

## The writing convention (the load-bearing part)

Any agent (or dev) writing to these tables follows this:

### Raw entries
- **Facts with dates, never speculation.** "Missed Tue and Thu, third occurrence this month" — not "seems checked out". If it's an impression, attribute it: "Robert's read after the call: …".
- One event per entry; `entry_date` is the date it **happened** (in `APP_CALENDAR_TZ`), not the date it was logged (`created_at` covers that).
- Name the `source`: `conversation` | `payroll_event` | `incident` | `review` | `milestone` | `job_event` | `report` (field reports filed from the Pending reports queue, v2.2235).
- Write nothing you wouldn't be comfortable having read back in a dispute. Consistent factual documentation protects the company; venting doesn't.
- Corrections: append a new entry referencing what it corrects ("Correction to 2026-08-19 entry: …").

### Summary (`kind='summary'`)
- Rewritten in full on each update; keep it under ~1 page. Sections that have earned their place: **Trajectory · Reliability · Pay · Watch items** (adapt per person).
- Must be reconstructible from the raw entries — never introduce a claim that has no entry behind it. Log the fact first, then fold it in.
- The tab derives coverage and staleness from `person_files.covered_through` (set it explicitly on every rewrite — the RPC defaults it to `now()`), falling back to `updated_at` for pre-v2.2232 rows (`personFileFreshness.ts`). Clearing amber roster dots — summaries with newer entries behind them — is the agent's standing job.
- **Write docs as markdown** (v2.2230): the tab renders summary/narrative through `marked` + the contract sanitizer, with a jump list built from `##` headings. Plain text still renders fine as paragraphs.

### Narrative (`kind='narrative'`)
- Chronological, oldest first; extend at the bottom as entries land. Group by natural chapters (season, role change), not by entry.
- Consolidate every few months when it gets baggy — tighten prose, never drop events.

## The tab

People → **HR** (dev-only cluster, next to Review/Scoreboard; `?tab=hr`, no URL gate — Scoreboard's async-`isDev` pattern). Left: roster grouped by kind, searchable, archived collapsed; freshness dot (green current / amber stale + days behind / grey empty) and entry count per person. Right, since v2.6392, **the person file** (`src/components/people/personFile/PersonFilePanel.tsx`): a fact strip, then **Timeline | Evidence | Narrative**.

- **Timeline** (the kernel `supabase/functions/_shared/personTimeline.ts`, since v2.6418 shared with the dev seat, `src/lib/people/personTimeline.ts` the app's door; the reads in `personTimelineIo.ts`): one dated line of everything on record, on the day it is ABOUT — the raw entries by source beside what the app already knows happened (papers signed, sent or owed and their expiries, licenses on file and lapsed, write-ups with their disclosure, no-shows, excused lates, field reports waiting to be filed, the start and last days), in lanes Said · Did · Paper · Missed · Ahead, by month, what lies ahead on top. Every source is read under the viewer's own RLS and a held one is named under the strip. A waiting field report carries **File to the record** / **Dismiss…** on its line (the queue's RPCs). **+ Add entry** opens the composer, the **only UI write** besides evidence; files attached to an entry become an evidence record on that entry. Since v2.6422 the dev seat reads the same file whole through `get_person_file` ([`dev-mcp/README.md`](./dev-mcp/README.md)): the lines in their lanes by month, the chips, the evidence records and the docs, through the same kernel over the same sources and keys, as the dev under RLS, a held source named the same way.
- **Evidence**: the records newest first (day · title · memo · file chips · the Drive state · Open the folder in Drive › or Try Drive again · by · kept), then *Files from before records*. **Add evidence** asks for the day it is about, a title, a memo and the files (`evidenceDraftProblem` requires all four), shrinks a photo on the way in, and says where it lands.
- **Narrative**: the summary with its freshness and stale banner, then the narrative with its jump list. Both read-only here, written by the agent.
- **Matter** (v2.6543, punch list #269 PR 3a; a dev's tab): a legal matter standing on the person (`legal_matters.kind = 'person'`, `person_id`, one a person, migration `20261105220000`), drawn by `src/components/people/personFile/PersonMatterPanel.tsx` from the Legal desk's own pieces — the narrative for the firm (`LegalNarrativeEditor` over `legal_set_narrative`), the documents (`LegalMatterDocumentsPanel`, the same bucket and rows) and the timeline of planned steps and events (`LegalTimelinePanel` over the desk's plan, event, update, done and undo RPCs). The account's tabs are not drawn. **Open a matter…** calls `legal_person_matter_open` (devs only); restrictive policies keep a person matter's rows to devs on every legal table. The analysis for counsel lives here, never in an entry: the convention above says write nothing you would not want read back in a dispute, and a matter is released to a firm on purpose.

The queue of field reports (below) folds to one line while a file is open; on a phone the roster and the file take turns.

## Evidence (v2.6392; exhibits since v2.2231)

A piece of evidence is a **record** (`person_file_evidence`): the day it is about, a title, a memo on what it shows, and its files (`person_file_attachments` rows naming the record through `evidence_id`). The files are staged in the **private `hr-files` bucket** as they are picked (`<person>/evidence/<record>/<file id>-<name>`, `evidenceStoragePath` in the kernel `supabase/functions/_shared/personEvidence.ts`, since v2.6418 shared with the dev seat, `src/lib/people/personEvidence.ts` the app's door) and filed by `hr-evidence-drive` (v2.6393, `EDGE_FUNCTIONS.md`) into the People folder the office set on Documents → Where files go, as *People › <person> › <YYYY-MM-DD · title> › the files*; each file keeps `drive_file_id` / `drive_url` / `filed_at`, the record its folder, and a refusal is written as `fail_why` for the panel (*Not in Drive: …*, **Try Drive again**). The bucket copy stays as the app's own, opened through the HR tables' RLS; Drive is where the office finds it. **The People folder lives in a Shared Drive of its own** (the owner's call, 2026-11-02): the Jobs drive's members would read the evidence there, so the save refuses a folder inside it. No UPDATE path — a correction is a new record, like an entry.

**A linked file** (v2.6541, punch list #269): a file that already lives in Drive — a call recording over the 10 MB cap, a file the office filed by hand — is a `person_file_attachments` row with `drive_url` and no `storage_path` (`person_file_attachments_copy_or_link`, migration `20261105200000`). Add evidence takes it under the file picker as *Or a file already in Drive*: a name and the Drive address (`evidenceLinkProblem` holds it to drive.google.com or docs.google.com), **+ Add the link**; a file or a link is enough for the record. The row is written with `drive_file_id` read from the link and `filed_at` stamped at once; the filer leaves it alone and counts it as in Drive; the chip reads *in Drive, linked* and opens the link; a record of links alone reads *In Drive, linked* and never asks Drive. The seat's `plan_person_evidence` takes a file as `{ name, drive_url }` beside one sent as bytes. The cap on a staged file is the function's body and the base64 round trip, so a link is the door for anything over it.

Files written before v2.6392 (`entry_id` or neither key) stay as they were: on the entry they were attached to, opened through a 10-minute signed URL (a PDF, a picture) or saved from the app's own address since v2.4610 (`storageSave.ts`), listed under *Files from before records*.

- **Agent uploads**: metadata inserts work as `hr_agent`; the byte upload needs
  the storage API (service key) — `POST /storage/v1/object/hr-files/<path>`.
  Path convention: `<person_id>/<uuid>-<sanitized-filename>`; insert the
  metadata row in the same session. An agent that files evidence writes the
  `person_file_evidence` row first, the attachment rows with its `evidence_id`,
  then asks `hr-evidence-drive` for the record — which is what dev-mcp's `plan_person_evidence` →
  `apply_person_evidence` does for a dev's coding agent since v2.6426 ([`dev-mcp/README.md`](./dev-mcp/README.md)):
  the files as `content_base64`, staged by the function as the dev under the path rule above, the rows through
  `dev_person_evidence_write` (migration `20261103060000`, the dry-run pattern of the second door below, the dev
  named as author), then the Drive ask, fail-soft.
- **Storage setup (out-of-band, one-time — matches how the project's existing
  buckets were created; storage schema is not in the migration ledger):**

  ```sql
  insert into storage.buckets (id, name, public) values ('hr-files','hr-files', false)
  on conflict (id) do nothing;
  create policy hr_files_dev_select on storage.objects for select to authenticated
    using (bucket_id = 'hr-files' and public.is_dev());
  create policy hr_files_dev_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'hr-files' and public.is_dev());
  create policy hr_files_dev_delete on storage.objects for delete to authenticated
    using (bucket_id = 'hr-files' and public.is_dev());
  ```

## Themes on the record (v2.6545)

A large record is read by pattern, not by date. A **theme** is the company's plain-words name for a pattern to find again across a person's record — *Dishonesty*, *Disrespectful conduct*, *Interference with the business* — with one line on what counts and counsel's words beside it when there are some. The catalog lives under Settings → People & teams → **Themes on the record** (`LegalThemesSettingsBlock.tsx`, a dev's): a theme is edited in place and **retired, never deleted**, so every mark made under it keeps its meaning; a retired theme folds under the list and can be brought back. A **mark** (`legal_theme_marks`) hangs a theme on something that already exists — an HR entry, a piece of evidence, a matter's document or event — with *why it fits* (200 characters) and *how it proves the theme*: by a document, by their own words, firsthand or relayed, the grade counsel's matrix asks at the moment of marking. A mark is what it was when made (the trigger refuses every change but the kept and removed stamps) and is removed with a reason, never deleted. The agent proposes a theme or a mark (`proposed_by_agent` / `proposed`), drawn dashed until a dev keeps it. Kernel `supabase/functions/_shared/legalThemes.ts` (the app's door `src/lib/legal/legalThemes.ts`), reads and writes `legalThemesIo.ts`, migration `20261106000000`.

The marks are made where the record is (v2.6546): the **theme picker** (`src/components/legal/ThemeMarkPicker.tsx`, the standing themes as chips, then *why it fits* and *proves it by*) sits in Add entry and Add evidence, under a Timeline line's **+ theme**, and on the Timeline's **bulk bar**, which appears once a line is ticked and marks every ticked line at once (*Mark 3 lines*, the count from `countedLabel`). The Timeline's **Themes row** shows each theme with how many lines carry it and filters the line to one theme; a line's marks are chips with the why and the grade on the tip, **✕** takes one off with a reason (the row stays, stamped), and a proposed mark is dashed with **Keep**. `addMarks` writes one row a theme a thing and counts a thing already marked as *already* (`markedWords`). A matter's composers carry the same picker (v2.6548, T2b): on the Legal desk and the HR file's Matter view, **Record what happened** (`LegalTimelinePanel`'s composer, the marks in `LegalEventDraft.marks`, written by the caller after `legal_event_add` answers with the entry id) and a paper waiting to be saved (`LegalMatterDocumentsPanel`, the marks written after `addLegalMatterDocument`), both only when the hand may mark (the desk's `canMarkReady`, a dev); the matter's marks read as chips on the Timeline's rows and the Evidence rows, the why and the grade on the tip.

**By theme** (v2.6547, `PersonThemesView.tsx`), the investigation: a view beside Timeline, Evidence and Narrative once the catalog has a theme. One theme at a time (the address's `?theme=<id>`, else the theme with the most on the person), its definition and counsel's words, the two counts a person tells counsel (`themeItemsHeadWords`: *14 items · first Apr 3, 2026 · last Aug 15, 2026 · 6 with a file*; `proofCountsWords` with the proposed count), **Show** (every item · with a file · a grade · proposed) and **Order** (oldest first · strongest first, by a document before their own words before firsthand before relayed, the ungraded last; `themeItems`). A press on an item opens the **item window** over the list: the kicker (*Dishonesty · item 3 of 14*), the whole entry or memo, its files through the panel's own chips, every theme on it with the grade, the why, who marked it and when (Keep on a proposed mark, Take it off… with a reason), the two lines either side on the record (`nearbyLines`, a press when the line is on the theme), **Open on the Timeline** (every filter off, the line scrolled to and lit) and Previous / Next (← → too); Escape closes and the list is where it was. **Print this theme** draws the list on paper in the light theme; **Copy as a list for counsel** puts `themeListText` on the clipboard. A pick writes `theme=` into the address through `PeopleHrTab`, so a link reopens the same isolated view.

## Agent credentials & the write RPC (v2.2232)

> **Sister interface (v2.3196):** the same pattern — a least-privilege role plus one validated RPC — exists for moving job cost: `cost_agent` and `cost_batch_apply` / `cost_batch_revert`, documented in [`COST_BATCHES.md`](./COST_BATCHES.md). Both roles are listed together in [`ACCESS_CONTROL.md`](./ACCESS_CONTROL.md) → "Database agent roles".

- **Write as `hr_agent`, not `postgres`/service-role.** The role's RLS policies make entries **append-only by policy** for the agent and scope it to the HR tables + `people` reads. Password lives only in `.env.local` as `HR_AGENT_DB_PASSWORD` (set once, out-of-band: `ALTER ROLE hr_agent WITH LOGIN PASSWORD '…'`).
- **Prefer the RPC over hand-built SQL** — one validated, atomic call:

  ```sql
  SELECT public.hr_agent_write(jsonb_build_object(
    'person_id', '<people.id>',
    'author_label', 'HR agent',
    'entries', jsonb_build_array(jsonb_build_object(
      'entry_date', '2026-08-24', 'source', 'incident', 'content', '…')),
    'summary', '…full rewrite…',            -- optional
    'narrative_append', '…new chapter…',    -- optional (or 'narrative' for full rewrite; mutually exclusive)
    'covered_through', now()::text          -- optional; defaults to now()
  ));
  ```

  It validates the person and sources, stamps `author_label`/`covered_through`, and the archive trigger versions any doc it overwrites.
- **Corrections are still new entries** — the RPC cannot update or delete entries, by design.
- **A second door for a dev's coding agent (v2.3722)**: `dev_hr_entry_write(p jsonb, p_dry_run boolean default true)` (migration `20260922102017`) is a dev-gated definer wrapper that calls the live `hr_agent_write` with `author_label` overwritten by the **dev's own name**, and with `p_dry_run = true` performs the write and unwinds it, returning what would be filed. dev-mcp's `plan_hr_entry` → `apply_hr_entry` are that function; apply re-runs the dry run and writes only when it still matches the plan the agent quoted ([`dev-mcp/README.md`](./dev-mcp/README.md)). The `hr_agent` contract above is unchanged.
- Doc history: `select * from person_file_revisions where person_id = … order by replaced_at desc`.

### Agent connection cookbook (verified live 2026-08-24)

- **Connect via the session pooler**, not the direct host — `db.<ref>.supabase.co` resolves flakily (IPv6/DNS) from the office machine:

  ```bash
  PGPASSWORD="$HR_AGENT_DB_PASSWORD" psql \
    "host=aws-1-us-east-1.pooler.supabase.com port=5432 dbname=postgres \
     user=hr_agent.yewfzhbofbbyvkvtaatw sslmode=require"
  ```

  (`HR_AGENT_DB_PASSWORD` lives in `.env.local`.)
- **Large or quote-heavy RPC payloads**: don't inline-quote SQL strings — build the JSON in a script, wrap it as `$J$<json>$J$::jsonb`, write a `.sql` file, run `psql -f`. Inline `jsonb_build_object` string literals broke on apostrophes in live testing; the JSON-file pattern is verified.
- **Docs are markdown** — write real `##` headings (they power the narrative jump list); set `covered_through` on every summary rewrite (the RPC defaults it to `now()`).
- **Exhibit bytes need the service key** (hr_agent covers metadata only): fetch it via the management API — `GET https://api.supabase.com/v1/projects/<ref>/api-keys?reveal=true` with `SUPABASE_MGMT_TOKEN` from `.env.local` — then `POST /storage/v1/object/hr-files/<person_id>/<uuid>-<sanitized-name>` and insert the `person_file_attachments` row as `hr_agent` in the same session.
- **Sanity check after a write session**: entries/attachments counts, `person_files` lengths, and the roster dot — a summary left amber means fold entries in (or bump `covered_through` if the content already covers them).

## Pending reports (v2.2235)

Masters and devs write observations about a person from the Dashboard's
**HR Report** card (collapsed, just above My Team). Rows land in
`person_reports` (subject person, author user + denormalized name,
`occurred_date` vs `created_at`, free text, status pending/filed/dismissed —
**no DELETE**; migration `20260824170000`). The queue renders at the top of
People → HR (dev-only, hides when empty) with per-report **File / Open their
file / Dismiss…** (reason required). Since v2.2895 (journey-map #40) it lists
**oldest first** with an age chip per row — amber at 3 days, red at 7
(`HR_PENDING_REPORT_AGE` in `src/lib/ageState.ts`; kernels
`sortPendingReportsOldestFirst` / `summarizePendingReportAging` in
`src/lib/people/hrPendingReports.ts`) — and the dev's Needs You card carries an
`hr-reports-pending` item once the oldest report is `HR_REPORTS_MIN_AGE_DAYS`
(3) old (`usePendingHrReportsNudge`, action → `/people?tab=hr`). Clicking
**Open their file** on an amber/red row records `aging_item_opened`.

Since v2.6392 a waiting report also stands on the person's Timeline with **File to the record** and **Dismiss…** on its own line, so the dev files it while reading the person. Filing goes through `file_person_report(p_report_id)` — appends the
append-only `person_file_entries` row (source `report`, `entry_date` =
`occurred_date`, "Reported by <author> — " preamble), links it back via
`filed_entry_id`, marks the report filed. `dismiss_person_report(p_report_id,
p_reason)` keeps everything. Both are `is_dev() OR hr_agent` and idempotent.

**Agent review duty**: drain the queue each run — `select * from
person_reports where status='pending'`, then per report either
`file_person_report` (optionally passing tightened `p_content` — keep the
author's facts, and the entry text always carries the byline) or
`dismiss_person_report` with a reason; then fold the new entries into the
person's summary/narrative as usual. From the dev seat the same two RPCs sit
behind `plan_person_report` → `apply_person_report` since v2.6430
([`dev-mcp/README.md`](./dev-mcp/README.md)): one report a plan, the plan
showing the entry as it would be filed, the apply refused once the report is
no longer waiting. Authors see their report's status flip on
their Dashboard card, so don't leave pendings sitting.

## Agent recipes

- Everyone's freshness in one query: entries `select person_id, created_at` + files `select person_id, kind, updated_at` → run through `derivePersonFileFreshness` per person.
- Rebuild a summary: read all entries for the person ordered by `entry_date`, rewrite `person_files.content` (upsert on `(person_id, kind)`), and stamp nothing else — `updated_at` defaults handle coverage.
- Files outlive employment: archived people keep their files and stay listed (collapsed) in the tab.
