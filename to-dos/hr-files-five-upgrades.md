---
name: "HR files, five upgrades: corrections as links, rows the system numbers, one approvals list, engagement history, one text with many views"
number: 315
group: gated
status: mapped 2026-11-11 (#7707) · the owner's go for the whole train 2026-11-11 · upgrade 1 PR 1 v2.6969 (#7716) live · live and walked on clicktooling.com 2026-11-13: v2.7098 the Timeline's links (#7879), v2.7104 the seat's reads of them (#7880, dev-mcp 0.81.0), v2.7107 the numbers on the screen and the Case view (#7882), v2.7108 section freshness (#7884) · merged with their migrations pushed: v2.7106 the numbers (#7881), v2.7111 engagements (#7886), v2.7122 the kept plans (#7903) · v2.7125 the Waiting on you list (#7911) · building resumed 2026-11-19 on Grace's word · live and walked 2026-11-20: v2.7976 the seat's reads of the numbers and plan_case (#8979, dev-mcp 0.118.0), v2.7991 the standing on the fact strip and the Timeline (#8987), v2.7999 the seat's notes out of its upload (#8996), v2.7987 the seat keeps, lists and drops a kept plan (#8998, dev-mcp 0.119.0), v2.8000 the seat reads and writes the standing (#9015, dev-mcp 0.120.0) · audited 2026-11-20: three screen fixes (v2.8061, v2.8071, v2.8082) and v2.8102, the seat refuses a kept plan that was taken off (dev-mcp 0.122.0), live and walked the same evening · two more of the audit's fixes merged the same night: v2.8129 the guide names the press that adds an entry (#9155), v2.8130 the People page's section row on a phone (#9158) · v2.8197 the seat's half of 5a (#9258, dev-mcp 0.124.0), brought to main 2026-11-21 once the seat's upload had room (v2.8126), not deployed yet · the owner's calls, not built: Apply and Drop from the tab, the mark on hours, 5b · 5c not started
summary: >
  One day of about ten agent sessions on the largest HR file showed where the system leans on prose.
  A correcting entry names what it corrects only in its words, so the old entry never reads as
  corrected. Open items, the log and the next exhibit number live in one document, so two sessions
  took the same number. Every pending plan lives in the session that made it, so the owner said
  Apply it in six places. The person row cannot say what a person was over time. The same text is
  copied to the matter and to Drive, and the copies go stale. Five upgrades, each a train of small
  additive PRs, mapped here with the tables, screens and seat verbs each touches.
ver: v2.6966, v2.6969, v2.7098, v2.7104, v2.7106, v2.7107, v2.7108, v2.7111, v2.7122, v2.7125, v2.7976, v2.7987, v2.7991, v2.7999, v2.8000, v2.8061, v2.8071, v2.8082, v2.8102, v2.8129, v2.8130, v2.8197
next: The train's buildable work is live and walked (2026-11-20), and audited the same day: see *The audit* below for what it found and what still waits. Waiting on the owner: the audit's findings that need a migration or his choice; who may press Apply and Drop on People → HR and whether a kept plan expires (3b); the report per person, then the mark on hours (4d, 4e); the list of kinds; whether the firm reads a referenced document live or as it stood when released (5b); the backfill of old exhibit numbers and moving prose items into rows, per person. Waiting on Taunya's go to deploy dev-mcp: the seat's half of 5a (v2.8197, server 0.124.0) is on main and not live, and its walk on the test person follows the deploy. 5c needs a Drive read on the server: see the notes below.
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
- **PR 3 (v2.7976, built, server 0.118.0):** `get_person_file`, `get_case_brief` and `search_case` carry `exhibit_no`; the brief gains `open_items` and `log`; `plan_person_evidence`'s reply names the number the record would take and the apply's the number it took; one new pair, `plan_case` → `apply_case`, over `dev_case_write`. The call log keeps a case change by its kinds and numbers, never its words.
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
- **PR 3a, the seat (v2.7987, built, server 0.119.0):** `keep: true` with `words` on `plan_hr_entry`, `plan_person_doc` or `plan_person_report` keeps the plan after its dry run; `list_kept_plans(person?, id?, show?)` reads the plans that wait and one whole by id, with its arguments and hash, so any session applies it on his yes; the apply that lands marks its plan applied, and an apply of the kept arguments whose dry run no longer matches marks it stale; `drop_kept_plan(id, why)` takes one off.
- **3b:** Apply and Drop from the tab. **3c:** evidence by Drive link and the case-item verbs join.
- **His calls:** who may press Apply (any dev, or him alone); whether a kept plan expires.

## 4. Engagement history

| | |
|---|---|
| Tables and RPCs | 4a: `person_engagements` (kind such as employee or subcontractor, from, to, the source of the change and its reference, a note), closed and never deleted, through `dev_engagement_write`. `people.kind`, `employment_stints` and `charge_standings()` stay as they are. 4b: a mark on `clock_sessions` for a row that is pay placed on a job from payroll, with kernel `isPresence`. |
| Screens | The fact strip reads the standing (*Subcontractor · since … · still engaged*) and opens **Standing…**; the Timeline's Employment source draws each change. 4b: the hours statement, the Hours grid, the attendance strip and utilization label or leave out a placed row. |
| Seat | `get_person_file` and the brief carry `engagements`; `plan_engagement` → `apply_engagement`; `get_hours_statement` says how many rows it left out as placed pay. |

- **PR 4a (v2.7111, built):** migration `20261113090000`, the table, the one door `dev_engagement_write` (no direct write to the table), the kernel (`standingOn(day)`, overlaps refused), the bed. Kinds built: employee and subcontractor.
- **4b (v2.7991, built):** the fact strip wears the standing and opens **Standing…** (`PersonStandingWindow.tsx`: record a stretch, change from a day, end the running one, take one off with its reason), and the Timeline's Employment source draws each change (`engagementLines`). The help guide has the steps.
- **4c (v2.8000, built, server 0.120.0):** `get_person_file` and `get_case_brief` carry `engagements`, the seat's Timeline draws each change, and `plan_engagement` → `apply_engagement` write through `dev_engagement_write`. `get_hours_statement` is untouched: it has nothing to leave out until 4d.
- **4d:** the mark on hours and `isPresence` in
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

- **PR 5a (v2.7108, built, #7884):** kernel `sectionFreshness` with tests, drawn as a fold that reads the prior versions only when opened (a chip on every section would read every version on every visit). The seat's half (v2.8197, built, #9258, server 0.124.0): `get_person_document { freshness: true }` on the summary's or the narrative's index. It is not deployed yet: see *The seat's half of 5a* below.
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

## Found on the live walks (2026-11-20)

- **v2.7976 (server 0.118.0), on `ZZ Test Hand`:** `get_case_brief` carries `open_items` and `log`, and the manifest counts the records the file numbered. The numbered record and its Timeline line carry `exhibit_no`, and so does a search hit on it. `plan_case` named the number a new item would take (Item 2) and wrote nothing; a second plan hashed alike; the apply landed; the same apply again was refused; the item closed as dropped through a second pair. `dev_mcp_calls` kept each change by its kind and number and none of its words. `plan_person_evidence` named Ev #2 and the apply took it.
- **The first plan was refused**, with *person … not found*: the words of `plan_case` said to take `person_id` from `find_person`, which answers a login's `users.id`. The doors take the roster row's `people.id`, as `get_case_brief` answers it in `person.id`. The words of `plan_case` and `plan_engagement` say so since v2.8000. `plan_hr_entry` and `plan_person_doc` still carry the old pointer; a note, not changed on Opus.
- **v2.7991 (4b), live on clicktooling.com:** the strip's press reads *Standing…* on `ZZ Test Hand` and opens the window, *Nothing on file yet*, dark theme, no console error. Before the merge, in the local app against prod: a stretch recorded, the standing changed from a day (one Timeline line saying both sides), the stretch ended, both taken off with a reason; the window fits 375 px.
- **v2.7987 (server 0.119.0), on `ZZ Test Hand`:** `keep: true` without words, and on a verb the list does not take, is refused before any dry run. A plan kept answers `kept_id`; keeping it again is refused by the door while the plan still stands in the session. `list_kept_plans` names who kept it, from which session and how long it has waited; with `id` it answers the plan whole with the call that applies it. That call, made from the kept arguments as another session would, filed the made-up entry and marked the plan applied. A second plan was dropped with a reason, and a second drop was refused. The row a plan keeps reads with exactly the columns *Waiting on you* selects. The pane's sign-in on clicktooling.com had expired by then, so the list itself was not looked at.
- **v2.8000 (server 0.120.0), on `ZZ Test Hand`:** an impossible day is refused in words before the door, and a login's `users.id` by the door. A made-up stretch opened, then changed to employee from a day (one Timeline line saying both sides), then ended, then both taken off with a reason. At each step `get_person_file`'s `engagements` and the Timeline's Employment lines read as the tab draws them; a stretch that overlaps one on file is refused by the table's guard. `dev_mcp_calls` kept the kind, the days and the stretch's id, never a reason. Nothing stands on the file after.
- **The browser pane held the old build** after the deploy, through the site's service worker. A reload once the new worker had installed brought the live build. `fix-cache.html` also resets storage, which would sign the pane out.
- **`dev-mcp` stands at its upload ceiling.** `npm run check:edge-bundles` holds 4.50 MB. Main was 4.47 MB after v2.7976, and the next seat pair alone added 38 KB. v2.7999 moved the per-version notes out of `index.ts` (46 KB) to `docs/dev-mcp/SERVER_NOTES.md`. That buys about four verb pairs. The lasting weight is the tool descriptions (218 KB), the generated catalog (409 KB) and `devMcpWrites.ts` (145 KB). Taking the descriptions and the catalog out of the upload is card 359's step 3, Grace's call. Since v2.8117 the seat deploys bundled and since v2.8126 its ceiling is 10 MB, so this no longer holds a seat PR.
- Test rows on `ZZ Test Hand`, all made up: case Item 2, opened and closed as dropped, with its three log lines; a counsel-only record, Ev #2, with one small text file, kept in the app only; one entry filed through a kept plan; three kept plans (one applied, two dropped); stretches on `person_engagements`, every one taken off with a reason.

## The seat's half of 5a: on main, not deployed

- `get_person_document { freshness: true }` is v2.8197, server 0.124.0 (#9258). It was built and tested on 2026-11-19 on the branch `claude/315-hr-seat-section-freshness`, numbered v2.8002 and server 0.121.0 there, and held on 2026-11-20 for room in the seat's upload: with it in, `dev-mcp` would have sat about 3 KB under the 4.5 MB ceiling. The room came with v2.8117, the seat deploys bundled, and v2.8126, `npm run check:edge-bundles` holds it to 10 MB. On 2026-11-21 the change was brought onto main as it was written, under the new numbers; with it in, `dev-mcp` reads 4.51 MB.
- **Not deployed.** The seat answers as 0.123.0 and ignores `freshness` until `dev-mcp` is deployed from main, on Taunya's go that names the function. After the deploy: ask for the summary's and the narrative's index with `freshness: true` on `ZZ Test Hand`, and add what it answered here.

## 5b and 5c, notes for the owner's call (not started)

- **5b, the reference.** `legal_matter_documents.storage_path` is `NOT NULL`, and every reader assumes a file: the Evidence row's open press signs a URL for it, `legal-portal` signs URLs for the firm, the file index's matter pass reads it. A reference row needs the column nullable with a check that a row has a file or a reference, a third path in `dev_legal_document_write` (every path today requires a stored file), and each reader taught first. Whether the firm reads the document live or as it stood when released decides whether the row also carries a pinned revision, so that call comes before the schema. The safe default if it is built before his call: the row is drawn for a dev on the person's Matter view, `legal-portal` does not serve a reference row (one filter where it selects documents, which also keeps it out of the printed packet), a counsel-only document makes a counsel-only row, and the guard holds the document to the person the matter stands on.
- **5c, the Drive chip.** `documents.source_sha256` is kept, but comparing it needs the Drive file read on the server, an edge function's action and its own deploy. A report by hash alone of the copies that no longer match comes first.

## The audit (2026-11-20)

A second session read every PR of the train, checked the live policies and grants, and walked the screens on `ZZ Test Hand`. The tables, the doors and the numbering are sound: every table is a dev's alone with its four fences, other roles read nothing, and no number repeats. No real file holds a standing, a case item or a kept plan yet.

**Fixed.**

- v2.8061: a failed read of the correction links, the evidence numbers or the standing is named on the file. A corrected entry used to lose its chip without a word.
- v2.8071: *Waiting on you* says when it could not be read, and names the plans on other files while a file is open.
- v2.8082: the entry composer drops a correction pick that was refused or belongs to another person's file.
- v2.8102 (dev-mcp 0.122.0): three things section 3 says of a kept plan did not hold, and now do. A dropped or stale plan is refused when a session applies it. A `plan_hr_entry` that rewrites the summary or the narrative commits to the text it replaces, so it turns stale. The call log keeps the plan hash on a long row, so one plan is not filed twice.
- v2.8129: the help guide sent a dev to *Raw entries*, a place no screen has. It names **+ Add entry** on the Timeline, and all seven sources the entry box offers.
- v2.8130: on a phone the People page's row of sections opened at its start, with the lit section cut off or out of sight. The row now moves to show it whole.

**Walked after the deploy.** The seat was deployed from main at 01:06 UTC on 2026-11-21 (the evening of 2026-11-20 in Chicago), after the database answered a plain read. All of it on `ZZ Test Hand`, with made-up words, and nothing was written.

- `whoami` answers `pipetooling-dev-mcp 0.122.0`.
- A `plan_hr_entry` that sends `narrative_append` answers `replaces: { narrative: <when the narrative last changed> }`. A plan with entries alone has no `replaces`, so its hash is what it was.
- An `apply_hr_entry` of the kept plan the earlier walk dropped, with its own arguments and hash, was refused: *Nothing written: this plan was kept for a yes and dropped by Robert …*. The three kept plans on the test file read as before: two dropped, one applied.
- Not walked: the hash kept on a log row past 4,000 characters, which needs a long apply that lands. The kernel test holds it.
- One fault in the new words: a reason that ends in a full stop reads with two (*… the list check..*). It was to ride the next seat change. It did not ride 0.123.0 (v2.8165), and still stands.

**Found, waiting on the owner.** Each needs a migration or his choice.

- A signed-in user who is not a dev can learn that a person has case Item N: the item guard answers *already stands* before the policy refuses, and the table grants INSERT. The fix is to revoke the direct grants or check the caller first in the guard.
- A number typed at the start of a new record's title moves the counter for good: the title floor is read over numbered records too. *Ev 2026-11-05 …* makes the next record Ev #2027.
- Another dev's key cannot apply a kept plan, and trying marks it stale: the keeper's name is in the hash. It follows his call on who may apply.
- The kept-plan door skips its counsel-only document check for a document id with a stray space. The seat's call log keeps the words of the older HR verbs, counsel-only ones too; the log is a dev's alone.
- The fact strip reads a change dated ahead as today's standing. The kernel is the seat's too, so the fix needs a deploy.
- `apply_engagement` answers *already applied* when a stretch is recorded, taken off and recorded again alike. `search_case` hides a failed read of the links.
- The words on a refused write are the database's own. The presses in Standing… and the Case view are under 44 px tall. Standing… draws its dates inside sentences.

## How to verify each PR

Kernel tests on made-up rows. A pgtest for each migration (the trigger refuses a link across people; a
role other than dev reads nothing). A live walk on `ZZ Test Hand` or a sample person, with every row made deleted
or named in the report. Never a real file.
