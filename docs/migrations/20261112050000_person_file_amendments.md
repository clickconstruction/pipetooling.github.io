# 20261112050000 — person_file_amendments (v2.6969, punch list #315 upgrade 1)

Corrections as links on a person's HR file. The file is append-only: a wrong entry is corrected by a new entry that says so in its words. Nothing but those words joined the two, so the older entry never read as corrected and a document that rested on it was not flagged.

**`person_file_amendments`** — one row says a thing on a person's file (`from`: an HR entry or a piece of evidence, the newer one) corrects or completes an older one (`to`).

- Columns: `person_id`, `from_kind` / `from_id`, `to_kind` / `to_id` (kinds `hr_entry`, `hr_evidence`, the words `legal_theme_marks.target_kind` uses), `how` (`corrects` · `completes`), `created_by`, `author_label`, `created_at`, and the withdrawal stamps `withdrawn_at` / `withdrawn_by` / `withdrawn_why` (set together, the reason 1 to 200 characters).
- One live link a pair (`person_file_amendments_live_once`); a thing never amends itself.
- **`person_file_amendments_guard`** (before insert or update, definer so it reads both ends past the caller's RLS): both ends exist and belong to `person_id`; the newer end was not written before the older one; no live link already stands between the two, either way round. After the insert nothing changes but the withdrawal stamps, once.
- RLS: devs select, insert and update (the guard decides what an update may be); no delete policy. The HR agent's key (`hr_agent`) selects and inserts. A restrictive policy refuses the dev seat (`request_is_dev_seat()`) a link that touches a counsel-only evidence record, and the agent's read policy leaves those out too.
- Ends with the four fence calls.

**Why a table and not a column on the entry.** The first plan was a nullable reference on `person_file_entries`. A table is better on four counts: no existing table or row changes; a correction may name several things and a thing may be corrected twice; evidence records, which follow the same "a correction is a new record" rule, are covered; and the corrections already written in prose can be linked later by adding rows, where a column would have meant stamping existing entries.

**`hr_agent_write(jsonb)`** — the live body (the repo's `20260824141540` with `report` among the sources, read from prod 2026-11-11) with three keys added; nothing it did before changes:

- `entries[].corrects` / `entries[].completes` — what a new entry amends: an entry id, `{ kind, id }`, or a list of them.
- `amendments[]` — a link between two things already on the file: `{ from_id, to_id, how, from_kind?, to_kind? }` (kinds default to `hr_entry`).
- `withdraw_amendments[]` — `{ id, why }`.

The reply gains `amendments_inserted` and `amendments_withdrawn` only when a link was named, so a payload with none answers as it always did.

**`dev_hr_entry_write(jsonb, boolean)`** — the same wrapper; its reply names each link by its two ends (`amendments`: the how, the new entry by its place in the list or the standing thing by kind, id, day and first words; `withdrawn`: the link as it stands with the reason). The words come from the payload and from rows that stood before the call, never from an id the run made, so a plan and its apply hash alike. A counsel-only record is named as *a counsel-only record*, never by its title. The dev seat's `plan_hr_entry` hands its payload over whole, so the three keys work through the seat with no deploy.

Two helpers, executable by nobody but the functions above: `person_file_thing(kind, id)` (a thing in a few words) and `person_file_amendment_targets(jsonb, label)` (the shapes `corrects` / `completes` take).

Held by `npm run test:pg:person-file-amendments` (`supabase/tests/person_file_amendments/`, in `scripts/sql-beds.txt`): 33 checks. Before the PR the scenario ran on a local Postgres 15 with stand-in tables and the migration applied twice; three mutants each failed it (no seat policy, a guard without the one-person rule, a reply carrying an id the run made).

Deploy order: push this migration. No client reads the table yet and no function is redeployed.
