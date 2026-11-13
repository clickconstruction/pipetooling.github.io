---
name: "HR files, five upgrades: corrections as links, rows the system numbers, one approvals list, engagement history, one text with many views"
number: 315
group: ready
status: mapped 2026-11-11 (#7707) · the owner's go for the whole train 2026-11-11 · upgrade 1 PR 1 v2.6969 (#7716) live · live and walked on clicktooling.com 2026-11-13: v2.7098 the Timeline's links (#7879), v2.7104 the seat's reads of them (#7880, dev-mcp 0.81.0), v2.7107 the numbers on the screen and the Case view (#7882), v2.7108 section freshness (#7884) · merged with their migrations pushed: v2.7106 the numbers (#7881), v2.7111 engagements (#7886), v2.7122 the kept plans (#7903) · v2.7125 the Waiting on you list (#7911) rides with this change · not built: the seat's verbs for the numbers, the case and the kept plans, Apply and Drop from the tab, the rest of upgrade 4 (the strip, the seat, the mark on hours), 5b and 5c
summary: >
  One day of about ten agent sessions on the largest HR file showed where the system leans on prose.
  A correcting entry names what it corrects only in its words, so the old entry never reads as
  corrected. Open items, the log and the next exhibit number live in one document, so two sessions
  took the same number. Every pending plan lives in the session that made it, so the owner said
  Apply it in six places. The person row cannot say what a person was over time. The same text is
  copied to the matter and to Drive, and the copies go stale. Five upgrades, each a train of small
  additive PRs, mapped here with the tables, screens and seat verbs each touches.
ver: v2.6966, v2.6969, v2.7098, v2.7104, v2.7106, v2.7107, v2.7108, v2.7111, v2.7122, v2.7125
next: Paused 2026-11-13 on Grace's word (finish and ship only, nothing new). When building resumes, in order: upgrade 2 PR 3 (the seat's reads of the numbers and plan_case), the seat's keep and list for the kept plans, Apply and Drop once the owner picks who may press, the rest of upgrade 4, 5b and 5c.
size: L as a train of five upgrades (S · M · M · M · M), about fifteen PRs
blocker: None. The calls that are the owner's are listed under each upgrade; the train builds the safe default and never runs a change on a real file.
opinion: build in the order given — each first PR is additive (a new table, a kernel), so nothing that works today is disturbed, and upgrade 1 pays back on the next correction anyone writes
mockup: hr-files-five-upgrades-case-and-approvals.html — the Case view as built (upgrade 2) and Waiting on you as proposed (upgrade 3), drawn before upgrade 3's screen PR; every other screen change is a chip or a door on a view that exists
---

# HR files: five upgrades (#315)

## The ask

2026-11-11, the owner, after a view of the HR files system as a whole: *"I think your five suggestions
are pretty good, Can you please help me make the changes? Do the reconciliation first, since it changes
nothing. Ship the upgrades one small PR at a time."*

2026-11-11, after the map: *"Build it all and let me know when it is live. Asking yourself along the way is this
the best we can do."* So each upgrade gets that question before it is built, and where the answer changed the plan
the section says so.

**What "build it all" does not decide.** Some calls change what rows on a real file mean (linking old
corrections, numbering old exhibits, marking old hours). The train builds each of those as a function with a dry
run and never runs it on a real file. Where a rule had to be picked to build at all, it takes the stricter
default and names it under *His calls*.

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

## PR 0, ahead of the train: done (v2.6966)

Found while mapping, built on the owner's yes the same day. `documents` and `document_revisions` took in a
matter's text documents three days after the five legal tables got their `*_person_dev_only` policies,
and did not get one. Migration `20261112030000` adds the two fences, held by
`npm run test:pg:person-matter-document-fence`. Only test rows sat behind the gap. Upgrade 5b builds on it.

## 1. Corrections as links

**Is this the best we can do?** The map planned a nullable reference on `person_file_entries`. A small table does
more and touches less, so the train builds that: no existing row or table changes, one correction can name several
things, evidence records are covered by the same rule, and the corrections already written in prose can be linked
by adding rows where a column would have meant stamping old entries.

| | |
|---|---|
| Tables and RPCs | `person_file_amendments` (v2.6969, migration `20261112050000`): from the newer thing to the older, kinds `hr_entry` · `hr_evidence`, how `corrects` · `completes`, withdrawn with a reason and never deleted, a guard that holds both ends to one person. `hr_agent_write` learns `entries[].corrects` / `entries[].completes`, `amendments[]` and `withdraw_amendments[]`; `dev_hr_entry_write` names each link by its two ends. `dev_case_search` stays as it is. |
| Screens | Timeline (`renderLine` in `PersonFilePanel.tsx`): the older line reads *Corrected Nov 3, 2026 ›* with a door to the newer, the newer *Corrects the entry of …*. A line's **Correct this entry…** opens the composer with the link set. The narrative's *Jump to* flags a section cited by a corrected entry. The By theme item window shows the same. |
| Seat | `plan_hr_entry` (pass-through, live with the migration), `get_person_file` (each line's links), `get_case_brief` (newest ten), `search_case` (a hit carries its links, joined in `devMcpCaseSearch.ts` as the transcript pair is). No new verb. |
| Kernel | `supabase/functions/_shared/personAmendments.ts` with the app's door: the live links, both ends indexed, corrected before completed, the latest word along a chain, the words either line wears. |

- **PR 1 (v2.6969, built):** the table, the two functions, the kernel with its tests, the bed
  (`npm run test:pg:person-file-amendments`), the docs. No screen reads the table and the seat is not
  redeployed. After the push an agent links a correction through `plan_hr_entry` at once.
- **PR 2 (v2.7098, built, #7879):** the Timeline, the composer, the flags on the narrative and the help guide. The links are a source of
  their own, read fail-soft, so the entries never disappear with them.
- **PR 3 (v2.7104, built, #7880, server 0.81.0):** the seat's reads and the search's pair, joined in the kernel so `dev_case_search` is untouched. Deployed: the seat answers as server 0.81.0 (2026-11-13).
- **Left of upgrade 1:** the chip on the Evidence view's rows and in the By theme item window; a search hit on a document section that cites a corrected entry is not flagged.
- **His call:** linking the corrections already written in prose. It adds rows and changes no entry, and it is
  still a write on a real file, so it runs per person on his word through `plan_hr_entry { amendments }`.

## 2. Rows the system numbers

**Is this the best we can do?** Three answers changed the map. A new exhibit number starts past the highest
number any old title opens with, so numbering is safe from the first push with no backfill run on a real file. An
item can be carried over with the number people already call it by, since notes and hand-overs cite those
numbers. And one door takes items and log lines together, so the seat needs one verb pair.

| | |
|---|---|
| Tables and RPCs | `person_file_counters`; `person_file_evidence.exhibit_no`, set by a before-insert trigger; `dev_evidence_number_backfill(person, dry_run, number_rest)`; `person_case_items` and `person_case_log`, written through `dev_case_write(p, dry_run)`. All in migration `20261113080000` (v2.7106), dev-only with the four fences. |
| Screens | Evidence row and Timeline line show *Ev #41* beside a title that does not already wear it. *Ev #41* in an entry's words opens the record. The Evidence view's **Number them…** shows the backfill's dry run and numbers what is clear. A **Case** view beside Documents lists the open items, the closed ones folded, and the log newest first. |
| Seat | `get_person_file`, `get_case_brief` and `search_case` carry `exhibit_no`; `plan_person_evidence`'s reply names the number the record would take (`person_file_next_exhibit_no`). One new pair, `plan_case` → `apply_case`; the brief gains `open_items` and `log`. |
| Kernel | `supabase/functions/_shared/personCase.ts` with the app's door. |

- **PR 1 (v2.7106, built):** the migration, the kernel with its tests, the bed
  (`npm run test:pg:person-file-numbers`), the docs. New records are numbered from the push on.
- **PR 2 (v2.7107, built, #7882):** the numbers on the screen, *Number them…*, the Case view, the help guide, the mock-up.
- **PR 3:** the seat's reads and `plan_case`.
- **His calls:** running the backfill on a real file, and what each clash and each lettered number it reports becomes. Whether the titles with no number are numbered after the highest.
  Moving a file's prose items into rows, with their numbers, per person. Whether a session may add a log line
  without his *Apply it*. *Agent notes* stays as prose for the standing rules and the map.

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

- **PR 3a, the database half (v2.7122, built):** migration `20261113120000`, the table, the two doors (`dev_kept_plan_keep`, `dev_kept_plan_decide`), the kernel, the bed. A plan with a file's bytes, a counsel-only plan and a change to a counsel-only document are refused at the door.
- **PR 3a, the list (v2.7125, built):** *Waiting on you* on People → HR and on a person's file, as words only, with no Apply or Drop press.
- **PR 3a, the seat (not built):** `keep` on a plan verb, `list_kept_plans` and `drop_kept_plan`, which need the pushed migration in the catalog.
- **3b:** Apply and Drop from the tab. **3c:** evidence by Drive link and the case-item verbs join.
- **His calls:** who may press Apply (any dev, or him alone); whether a kept plan expires.

## 4. Engagement history

| | |
|---|---|
| Tables and RPCs | 4a: `person_engagements` (kind such as employee or subcontractor, from, to, the source of the change and its reference, a note), closed and never deleted, through `dev_engagement_write`. `people.kind`, `employment_stints` and `charge_standings()` stay as they are. 4b: a mark on `clock_sessions` for a row that is pay placed on a job from payroll, with kernel `isPresence`. |
| Screens | The fact strip reads the standing (*Subcontractor · since … · still engaged*) and opens **Standing…**; the Timeline's Employment source draws each change. 4b: the hours statement, the Hours grid, the attendance strip and utilization label or leave out a placed row. |
| Seat | `get_person_file` and the brief carry `engagements`; `plan_engagement` → `apply_engagement`; `get_hours_statement` says how many rows it left out as placed pay. |

- **PR 4a (v2.7111, built):** migration `20261113090000`, the table, the one door `dev_engagement_write` (no direct write to the table), the kernel (`standingOn(day)`, overlaps refused), the bed. Kinds built: employee and subcontractor.
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

- **PR 5a (v2.7108, built, #7884):** kernel `sectionFreshness` with tests, drawn as a fold that reads the prior versions only when opened (a chip on every section would read every version on every visit). The seat's `get_person_document` does not carry it yet.
- **PR 5a as mapped:** kernel `sectionFreshness` with tests and the chips. No migration, so it can
  ship at any point in the train.
- **5b:** the reference, on PR 0's fence. **5c:** the Drive chip and a report, by hash alone, of the copies
  that no longer match.
- **His calls:** whether the firm reads the document live or as it stood when released; that a
  counsel-only document makes a counsel-only row and nothing else is allowed.

## The order proposed

1 → 2 → 3 → 4 → 5 as he accepted them, one PR merged, pushed and deployed before
the next starts on the same files. 5a touches no file the others touch and can go whenever a session is
free.

## Found on the live walks (2026-11-13)

- A cold load of `/people?tab=hr&person=<people.id>` opens the HR roster, and the `person` part of the address is gone. Seen locally and live. The People page's tab effect is not the cause. It is older than this train; a fix for whoever owns People → HR's deep links.
- `dev-mcp` passed Supabase's 5 MB upload limit with v2.7104. The upload carries `src/types/database.ts` (1.45 MB) through type-only imports in the generated edge kernels. It was deployed with that file stood in by a type stub, so the code that runs is main's. The lasting fix is to keep the type-only file out of the upload, likely in `scripts/edge-kernels.mjs`. Every later seat PR of this train needs one of the two.
- Test rows on `ZZ Test Hand`, all made up: two entries and one correction link, a narrative written twice, one counsel-only record numbered Ev #1, and case Item 1 (closed) with its two log lines.

## How to verify each PR

Kernel tests on made-up rows. A pgtest for each migration (the trigger refuses a link across people; a
role other than dev reads nothing). A live walk on `ZZ Test Hand` or a sample person, with every row made deleted
or named in the report. Never a real file.
