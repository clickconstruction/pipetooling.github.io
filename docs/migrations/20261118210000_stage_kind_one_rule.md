# 20261118210000_stage_kind_one_rule.sql (2026-11-18, v2.7850)

One rule for the stage a line's name reads as. Punch list #397, PR 6. It replaces one function and touches no table.

## Why

The app reads a job line's stage from its name in one place, `stageRank` in `src/lib/jobs/stageRecognition.ts`. `stage_checklist_kind_of` is the database's copy, used when a stage's checklist is filed as a record (`stage_checklist_record_settle`). The two had drifted, and neither knew two things the owner picked on 2026-11-18 after a read of the 35 real lines two app readers disagreed on.

## The rule

The same as the app's, word for word:

1. Lower-case the name, trim it, and drop a leading *stage 2 -*, *phase 1:* or *3.*.
2. The **start** of the name gives the stage: *rough…*, *top out* or *stack out*, *trim…* or *finish…*.
3. ***Set trim*** is the trim stage said the other way round.
4. A name that also holds the word of a **different** stage stands for none. *Rough in, top out and trim* is the whole job on one line, not its rough-in. Ground words sit with rough, and *final* and *punch* sit with trim, so *Rough in and underground* and *Trim and final* keep their stage.

Ground and Final carry no checklist, as before, so they answer `NULL`.

## What changes

| A name such as | Before | After |
|---|---|---|
| *Stage 2 — Top Out*, *Phase 1: Rough In*, *3. Trim Set* | no kind | its kind |
| *Set trim* | no kind | `trim_set` |
| *Rough in, top out and trim*, *Rough and top out* | the first word's kind | no kind |
| a name with tabs or a line break around it | no kind | its kind |

The signature is the same, so nothing that calls it changes. No row is rewritten: a filed record keeps the kind it was filed with. On 2026-11-18 no checklist answer and no record existed, so nothing filed reads differently.

## What holds the two in step

`STAGE_NAME_TABLE` in `src/lib/jobs/stageNameTable.ts`: 37 names and the stage each must read as. The app's unit test runs every row through `stageRank`, and checks that `supabase/tests/stage_kind/20_scenario.sql` asserts the same row against this function. A row added to the table fails that test until the scenario carries it.

## Checked

- A SQL bed, `scripts/pgtest-stage-kind.sh` (`supabase/tests/stage_kind/`): the function after a second run of the file, asked for every name in the table and for a padded name and no name. Docker does not start on the office Mac, so its first run is CI's.
- The function's body, run as a read-only query on the live database over the table's names and three more (40 in all), inside `BEGIN READ ONLY … ROLLBACK`, with no function created: 0 mismatches. The control, the same names through the function live that day: 11 mismatches, the rows of the table above.

## Applied

2026-11-19, about 01:15 UTC, with `supabase db push --include-all`, after the file landed on `main` (#8793).

- The landed file was compared with the reviewed one first: identical.
- It applied out of order. Two newer files, `20261118213000` and `20261118223000`, were pushed by their own sessions minutes before. No newer file on `main` names `stage_checklist_kind_of`, so applying this one last overwrote nothing. The dry run named this one file and no other.
- After the push the live function was asked for the same 40 names: 0 mismatches, against 11 before.
- `check:migration-drift` after: 1380 local files, 1380 remote versions, fully applied.
- No types change: the function's signature is as it was.
- The SQL bed ran for the first time on #8793's CI and passed.
