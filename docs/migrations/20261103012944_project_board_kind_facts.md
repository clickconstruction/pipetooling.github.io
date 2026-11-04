# 20261103012944_project_board_kind_facts.sql (2026-11-02, v2.6402)

The Projects board's gate reads the job's kind (punch list #238 and #242). The kernel, `jobKindOfRow`, reads the office's press, the bid or GC project behind the job, the first day of work and the billing-only flag beside the job's number, price, status and lines. The board's one read, `list_project_board` (`20261102163008_project_board_read.sql`, v2.6352), answered with none of those five. A second read of `jobs_ledger` from the page would not do: a superintendent's RLS shows no Working job, so his board and the leader's would disagree.

## What it does

**`list_project_board(p_job_ids uuid[] DEFAULT NULL)`** is replaced, its signature, its grants and its comment unchanged. Each job in what it returns gains `kind`, `bid_id`, `project_id`, `first_work_date` and `billing_only`. The body is the v2.6352 body with those five columns in two places, the `jobs` read and the returned object, and nothing else: `diff` of the two function blocks shows those lines alone.

## What stays

No table changes. Nothing writes. The wages stay inside the function, and no dollar joins what it returns; `projectBoardRead.test.ts` reads the newest file that replaces the function, so its pins (no labor dollar out, the Burn's margin, the gate's roles) now hold this copy, and it fails if a fact the kind reads goes missing. Two of the new values are ids a superintendent could not otherwise read; they are opaque, and the client uses them only as "there is a bid" and "there is a GC project".

## Checked before the push

The function's statement, with the gate and the parameter taken out, ran read-only on prod (`BEGIN READ ONLY … ROLLBACK` through the management API, no DDL) over every Working job. `parseProjectBoardRead` and `isWorkingProject` then gave the same board as `jobKindOfRow` over a direct read of the same jobs.

## Order with the client

`check:calls-ahead` labels the PR *push right after the merge*, since the client reads what only this body returns. An older body is safe in the meantime: a read with no `kind` key keeps the board's old guess (`isWorkingProject`), so no job drops off between the deploy and the push. An older client ignores the new keys, so the push is safe at any moment.

## After the push

The function's signature and return type do not change, so `database.ts` and the dev-mcp catalog do not move and no `chore(types)` PR is owed for this file. Read `npm run check:migration-drift`, then call `list_project_board` as the dev and confirm each job carries `kind`.

**Applied** to prod by 2026-11-04: `npm run check:migration-drift` read 1105 local files and 1105 remote versions, fully applied (read in the docs pass after #6888); `check:edge-drift` read every one of the 178 functions deployed and current the same day; no change to `src/types/database.ts` (`list_project_board` keeps its signature, as above).
