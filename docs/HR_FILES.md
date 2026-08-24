# HR files (People → HR, dev-only)

---
file: docs/HR_FILES.md
type: Feature reference + agent writing convention
purpose: The dev-only per-person HR files system — schema, access model, the People → HR tab, and (most importantly) the convention any agent or dev follows when writing to it.
audience: Developers, AI Agents
last_updated: 2026-08-24
---

## What this is

Per-person HR files, visible to **devs only**, maintained mostly by an AI agent connected to Supabase. Three layers per person, keyed on `people.id`:

| Layer | Table | Mutability | What it is |
|---|---|---|---|
| **Raw entries** | `person_file_entries` | **Append-only** (no UPDATE/DELETE policies exist) | Dated facts: what happened, when, from where. The source of truth. |
| **Summary** | `person_files` (`kind='summary'`) | Rewritten freely — **prior versions auto-archive** (v2.2232) | ≤1 page: trajectory, reliability, pay, watch items. Read first. |
| **Narrative** | `person_files` (`kind='narrative'`) | Extended, occasionally consolidated — **prior versions auto-archive** (v2.2232) | The chronological story, oldest → newest. |
| **Doc history** | `person_file_revisions` | Written only by trigger; dev read-only | Prior version of every summary/narrative rewrite (v2.2232). |

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
- Name the `source`: `conversation` | `payroll_event` | `incident` | `review` | `milestone` | `job_event`.
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

People → **HR** (dev-only cluster, next to Review/Scoreboard; `?tab=hr`, no URL gate — Scoreboard's async-`isDev` pattern). Left: roster grouped by kind, searchable, archived collapsed; freshness dot (green current / amber stale + days behind / grey empty) and entry count per person. Right: person header, then **Summary | Narrative | Raw entries**. The composer on Raw entries is the **only UI write**; curated docs are read-only in the UI and written by the agent directly (Supabase MCP / SQL).

## Exhibits (v2.2231)

Files attach to a person's HR file (and optionally a specific entry) via
`person_file_attachments` + the **private `hr-files` bucket**. UI: Exhibits
panel + composer "Attach files" on the Raw entries view; chips open 10-minute
signed URLs. No UPDATE path — replace and note, like entry corrections.

- **Agent uploads**: metadata inserts work as `hr_agent`; the byte upload needs
  the storage API (service key) — `POST /storage/v1/object/hr-files/<path>`.
  Path convention: `<person_id>/<uuid>-<sanitized-filename>`; insert the
  metadata row in the same session.
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

## Agent credentials & the write RPC (v2.2232)

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
- Doc history: `select * from person_file_revisions where person_id = … order by replaced_at desc`.

## Agent recipes

- Everyone's freshness in one query: entries `select person_id, created_at` + files `select person_id, kind, updated_at` → run through `derivePersonFileFreshness` per person.
- Rebuild a summary: read all entries for the person ordered by `entry_date`, rewrite `person_files.content` (upsert on `(person_id, kind)`), and stamp nothing else — `updated_at` defaults handle coverage.
- Files outlive employment: archived people keep their files and stay listed (collapsed) in the tab.
