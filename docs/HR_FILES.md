# HR files (People → HR, dev-only)

---
file: docs/HR_FILES.md
type: Feature reference + agent writing convention
purpose: The dev-only per-person HR files system — schema, access model, the People → HR tab, and (most importantly) the convention any agent or dev follows when writing to it.
audience: Developers, AI Agents
last_updated: 2026-08-23
---

## What this is

Per-person HR files, visible to **devs only**, maintained mostly by an AI agent connected to Supabase. Three layers per person, keyed on `people.id`:

| Layer | Table | Mutability | What it is |
|---|---|---|---|
| **Raw entries** | `person_file_entries` | **Append-only** (no UPDATE/DELETE policies exist) | Dated facts: what happened, when, from where. The source of truth. |
| **Summary** | `person_files` (`kind='summary'`) | Rewritten freely | ≤1 page: trajectory, reliability, pay, watch items. Read first. |
| **Narrative** | `person_files` (`kind='narrative'`) | Extended, occasionally consolidated | The chronological story, oldest → newest. |

Shipped in the v2.2220–v2.2221 train: migration `20260824025109_person_hr_files.sql` (see `docs/migrations/`), tab `src/components/people/PeopleHrTab.tsx`, freshness kernel `src/lib/people/personFileFreshness.ts`.

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
- The tab derives "covers N of M entries" and staleness from `person_files.updated_at` vs entry `created_at`s (`personFileFreshness.ts`). Clearing amber roster dots — summaries with newer entries behind them — is the agent's standing job.

### Narrative (`kind='narrative'`)
- Chronological, oldest first; extend at the bottom as entries land. Group by natural chapters (season, role change), not by entry.
- Consolidate every few months when it gets baggy — tighten prose, never drop events.

## The tab

People → **HR** (dev-only cluster, next to Review/Scoreboard; `?tab=hr`, no URL gate — Scoreboard's async-`isDev` pattern). Left: roster grouped by kind, searchable, archived collapsed; freshness dot (green current / amber stale + days behind / grey empty) and entry count per person. Right: person header, then **Summary | Narrative | Raw entries**. The composer on Raw entries is the **only UI write**; curated docs are read-only in the UI and written by the agent directly (Supabase MCP / SQL).

## Agent recipes

- Everyone's freshness in one query: entries `select person_id, created_at` + files `select person_id, kind, updated_at` → run through `derivePersonFileFreshness` per person.
- Rebuild a summary: read all entries for the person ordered by `entry_date`, rewrite `person_files.content` (upsert on `(person_id, kind)`), and stamp nothing else — `updated_at` defaults handle coverage.
- Files outlive employment: archived people keep their files and stay listed (collapsed) in the tab.
