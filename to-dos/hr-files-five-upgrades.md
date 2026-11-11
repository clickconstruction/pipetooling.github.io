---
name: "HR files, five upgrades: corrections as links, rows the system numbers, one approvals list, engagement history, one text with many views"
number: 315
group: gated
status: mapped 2026-11-11 on claude/hr-files-upgrades-map · nothing built · waiting on the owner's go for the train and his yes on one small access fix that goes ahead of it
summary: >
  One day of about ten agent sessions on the largest HR file showed where the system leans on prose.
  A correcting entry names what it corrects only in its words, so the old entry never reads as
  corrected. Open items, the log and the next exhibit number live in one document, so two sessions
  took the same number. Every pending plan lives in the session that made it, so the owner said
  Apply it in six places. The person row cannot say what a person was over time. The same text is
  copied to the matter and to Drive, and the copies go stale. Five upgrades, each a train of small
  additive PRs, mapped here with the tables, screens and seat verbs each touches.
next: The owner's go on the order below, and his yes or no on PR 0. Then PR 1a, the corrections link in the database with its kernel, which changes no screen and needs no seat deploy.
size: L as a train of five upgrades (S · M · M · M · M), about fifteen PRs
blocker: The owner's go. He asked that the read-only reconciliation of the large file finish first.
opinion: build in the order given — each first PR is additive (a nullable column, a new table, a kernel), so nothing that works today is disturbed, and upgrade 1 pays back on the next correction anyone writes
mockup: not required — each screen change before upgrade 3 is a chip or a door on a view that exists; the approvals list (upgrade 3) and the Case view (upgrade 2b) get a mock-up beside this card before their screen PRs
---

# HR files: five upgrades (#315)

## The ask

2026-11-11, the owner, after a view of the HR files system as a whole: *"I think your five suggestions
are pretty good, Can you please help me make the changes? Do the reconciliation first, since it changes
nothing. Ship the upgrades one small PR at a time."*

No name, amount or word from any person's file belongs in this card, a test, a commit or a PR. Fixtures
are made up. Live checks run on a sample or a `ZZ Test` person.

## What the map rests on

Read in the code and the live schema on 2026-11-11.

- `plan_hr_entry` hands its `entry` whole to `dev_hr_entry_write`, which calls `hr_agent_write`. A key
  the function learns reaches the seat with no seat deploy. The plan hash covers the payload and the
  dry run's reply.
- The live `hr_agent_write` is the repo's body in `20260824141540` with `report` added to its sources.
- **Add entry** inserts straight into `person_file_entries` under RLS. The table has no trigger.
- A plan is stored nowhere. The only server memory is `dev_mcp_calls`, asked once per apply.
- The Timeline reads no clock sessions. `clock_sessions.origin` is `user_punch`, `salary_schedule` or
  `imported`. Nothing anywhere marks a row as pay placed from payroll.
- Nothing reads an exhibit number out of an evidence title. *Agent notes* is a title the brief looks
  for (`AGENT_NOTES_TITLE`), with no structure behind it.
- No flow copies a person's document to a matter by reference. A matter's text document is its own
  row in `documents`, owned by `matter_id`.
- Three seat PRs are open (#7686, #7680, #7679). Each moves the server version and the verb count, so
  a seat PR of this train rebases onto them and takes the next number.

## PR 0, ahead of the train (the owner's yes)

One small access fix on the tables behind a matter's documents, found while mapping. It is outside the
five, so it waits for his yes; its detail is with him and in the sessions' shared notes, and goes on its
migration page when it merges. Upgrade 5b does not ship before it.

## 1. Corrections as links

| | |
|---|---|
| Tables and RPCs | `person_file_entries` gains `amends_entry_id` (nullable, the same table) and `amends_kind` (`corrects` · `completes`), an index, and a before-insert trigger that holds the pair to one person. `hr_agent_write` learns `corrects_entry_id` / `completes_entry_id` on an entry; `dev_hr_entry_write`'s reply names the older entry. `dev_case_search` stays as it is. |
| Screens | Timeline (`renderLine` in `PersonFilePanel.tsx`): the older line reads *Corrected ›* with a door to the newer, the newer *Corrects the entry of …*. A line's **Correct this entry…** opens the composer with the link set. The narrative's *Jump to* flags a section cited by a corrected entry. The By theme item window shows the same. |
| Seat | `plan_hr_entry` (pass-through), `get_person_file` (each line's pair), `get_case_brief` (newest ten), `search_case` (a hit returns the pair, joined in `devMcpCaseSearch.ts` as the transcript pair is). |
| Kernel | `supabase/functions/_shared/personEntryAmends.ts` with the app's door: pairs, chains (a correction of a correction), the words, the flagged sections. |

- **PR 1a (first, S):** the migration, the two functions, the kernel with its tests, `HR_FILES.md`, the
  migration page. No screen reads the column and the seat is not redeployed. After the push an agent
  links a correction through `plan_hr_entry` at once.
- **1b:** the types PR. **1c:** the Timeline, the composer and the help guide. **1d:** the seat's reads
  and the search pair. **1e:** the flags on documents and themes.
- **His call, later:** linking the corrections already written in prose means stamping an existing
  entry once, through a dev-gated function that refuses a row already linked. That changes existing
  rows, so it runs per person on his word, or not at all.

## 2. Rows the system numbers

| | |
|---|---|
| Tables and RPCs | 2a: `person_file_evidence.exhibit_no`, unique a person, set by a before-insert trigger from `person_file_counters`. `dev_evidence_number_backfill(person, dry_run)` reads the number a title already carries and reports clashes and gaps. 2b: `person_case_items` (number from the same counter, what, owner, state open · done · dropped, opened and closed days, why) and `person_case_log` (append-only: when, who, which session, one line), written through `dev_case_item_write` and `dev_case_log_write`. All new tables dev-only with the four fences. |
| Screens | Evidence row and Timeline line show the number beside the title; titles stay as they are. A **Case** view beside Documents lists the open items, the closed ones folded, and the log newest first. |
| Seat | `get_person_file`, `get_case_brief` and `search_case` carry `exhibit_no`; `plan_person_evidence`'s reply names the number the record would take. New pairs `plan_case_item` → `apply_case_item` and `plan_case_log` → `apply_case_log`; the brief gains `open_items` and `log`. |

- **PR 2a (first, S):** the column, the counter, the trigger, the backfill function, kernel
  `exhibitNumberFromTitle` with tests. New records are numbered from the merge on.
- **2b:** the items and log tables with their functions. **2c:** the seat verbs. **2d:** the Case view.
- **His calls:** which title forms count as carrying a number; whether a record with none is numbered
  after the highest or left blank; each clash the backfill reports. Whether a session may add a log
  line without his *Apply it*. Moving a file's prose items into rows, per person, on his word. *Agent
  notes* stays as prose for the standing rules and the map.

## 3. One approvals list

| | |
|---|---|
| Tables and RPCs | `dev_seat_kept_plans`: the person, the plan verb, its arguments, the plan hash, the dry run's reply as shown (capped), one paragraph of words, who kept it and from which session, state waiting · applied · dropped · stale, who decided and why. Dev-only, the four fences. |
| Screens | **Waiting on you (n)** at the top of People → HR beside the pending reports, and on the person file: who planned, when, the words, **Apply** and **Drop…** with a reason. |
| Seat | `keep: true` on a person-file plan verb stores the row and answers `kept_id`. `list_kept_plans(person?)` and `drop_kept_plan`. The tab's Apply calls `dev-mcp` on a signed-in route as that dev, which runs the same `apply_` verb with the stored arguments and hash. |

**The hash rule does not change.** A kept plan is the same arguments and the same hash, held on the
server instead of in a transcript. Apply runs the dry run again, compares, asks the call log whether the
plan was applied, and logs the call. A plan that no longer matches turns *stale* with the mismatch in
words, and the agent plans again.

**What stays in the session:** a plan that carries bytes (evidence sent as `content_base64`, a matter
document's file), since the bytes are not kept; every verb that is not about a person's file; and the
right to apply in the session on his word, as today.

- **PR 3a (first, M):** the table, `keep`, the list verb, and the list on the tab as words only.
- **3b:** Apply and Drop from the tab. **3c:** evidence by Drive link and the case-item verbs join.
- **His calls:** who may press Apply (any dev, or him alone); whether a kept plan expires.

## 4. Engagement history

| | |
|---|---|
| Tables and RPCs | 4a: `person_engagements` (kind such as employee or subcontractor, from, to, the source of the change and its reference, a note), closed and never deleted, through `dev_engagement_write`. `people.kind`, `employment_stints` and `charge_standings()` stay as they are. 4b: a mark on `clock_sessions` for a row that is pay placed on a job from payroll, with kernel `isPresence`. |
| Screens | The fact strip reads the standing (*Subcontractor · since … · still engaged*) and opens **Standing…**; the Timeline's Employment source draws each change. 4b: the hours statement, the Hours grid, the attendance strip and utilization label or leave out a placed row. |
| Seat | `get_person_file` and the brief carry `engagements`; `plan_engagement` → `apply_engagement`; `get_hours_statement` says how many rows it left out as placed pay. |

- **PR 4a (first, S):** the table, the function, the kernel (`standingOn(day)`, overlaps refused).
- **4b:** the strip and the Timeline. **4c:** the seat. **4d:** the mark on hours and `isPresence` in
  the statement's reader (`hoursStatementRead.ts` takes its first recorded day from every row today).
  **4e:** the other readers.
- **His calls:** the list of kinds. And 4d changes what existing rows mean: which rows get the mark is
  a report per person that he reads first, never a guess.

## 5. One text, many views

| | |
|---|---|
| Tables and RPCs | 5a: none; it reads `person_files`, `person_file_revisions` and the entries' `created_at`. 5b: `legal_matter_documents.person_document_id`, with a pinned revision if he chooses so; `dev_legal_document_write` learns the reference. 5c: none; `documents.source_sha256` is already kept. |
| Screens | 5a: each section of the summary and narrative shows when it last changed and how many entries are newer. 5b: the matter's Evidence row opens the person's document in place of a copy, with the lock when it is counsel-only. 5c: a chip when the Drive file and the text no longer match. |
| Seat | `get_person_document`'s index carries each section's freshness; `plan_matter_document { person_document_id }`; the brief names a reference as one. |

- **PR 5a (first, S):** kernel `sectionFreshness` with tests and the chips. No migration, so it can
  ship at any point in the train.
- **5b:** the reference, after PR 0. **5c:** the Drive chip and a report, by hash alone, of the copies
  that no longer match.
- **His calls:** whether the firm reads the document live or as it stood when released; that a
  counsel-only document makes a counsel-only row and nothing else is allowed.

## The order proposed

PR 0 on his yes. Then 1 → 2 → 3 → 4 → 5 as he accepted them, one PR merged, pushed and deployed before
the next starts on the same files. 5a touches no file the others touch and can go whenever a session is
free.

## How to verify each PR

Kernel tests on made-up rows. A pgtest for each migration (the trigger refuses a link across people; a
role other than dev reads nothing). A live walk on `ZZ Test Hand` or a sample person, with every row made deleted
or named in the report. Never a real file.
