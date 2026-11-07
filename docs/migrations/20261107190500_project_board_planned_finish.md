# 20261107190500_project_board_planned_finish.sql (2026-11-07, v2.6665)

The Projects board reads the planned finish (punch list #234 PR 2). `superintendentLine` has taken a `plannedFinishYmd` since v2.6320 and the board handed it null; `20261107190000_job_planned_finish.sql` freezes one on `job_budgets` at award.

## What it does

**`list_project_board(p_job_ids uuid[] DEFAULT NULL)`** is replaced, its signature, its grants and its comment unchanged. Each job in what it returns gains `planned_finish`, a date. The body is the v2.6402 body (`20261103012944_project_board_kind_facts.sql`) with the one column in two places, the `budgets` read and the returned object, and nothing else.

## What stays

No table changes. Nothing writes. The wages stay inside the function and no dollar joins what it returns; `projectBoardRead.test.ts` reads the newest file that replaces the function, so its pins (no labor dollar out, the Burn's margin, the gate's roles) hold this copy.

**Apply**: with `20261107190000_job_planned_finish.sql`, in one `supabase db push` after the merge. The client reads `planned_finish` as optional, so an older function leaves the line reading hours alone, as before.
