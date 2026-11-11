# 20261111013000_permit_policies_once.sql (2026-11-10, v2.6894)

Permits: the access rule is read once per statement, not once per row (punch list #292). Found after the first pull of Austin, New Braunfels, San Marcos and Seguin, when a plain open of Prospects → Permits passed the database's statement limit.

## What it does

Thirteen `ALTER POLICY` statements, run from one loop, each only where its policy exists. Every policy on the Permits tables that named `public.user_can_research_permits()` bare now names it inside a scalar subquery, `(SELECT public.user_can_research_permits())`:

- **The reads**: `permits_select`, `permit_verdicts_select`, `permit_pulls_select`, `permit_lookups_select`, `builders_select`, `builder_marks_select`, `builder_customer_answers_select`.
- **The writes**: `permits_insert_file`, `permit_verdicts_insert`, `builders_insert`, `builders_update` (its USING and its WITH CHECK), `builder_marks_insert`, `builder_customer_answers_insert`. The row's own test (`source = 'file'`, `decided_by = auth.uid()` and the like) stays beside the rule.

Nothing else changes: not the function, not who it lets in, not a grant, not a column, not any of the three reads' bodies.

## Why

A policy's expression is evaluated for every row a statement touches. Written bare, the function ran again per row, and each run looks the caller up in `users`. Inside a scalar subquery the planner runs it once, as an InitPlan. The function is `STABLE` and reads only who the caller is, so once per statement gives the answer once per row gave. `archived_fence` on these same tables was already written that way.

Measured on a local bed with every migration applied and about 11,000 made-up permits (the live table's size), signed in as an estimator:

| Read | Before | After |
|---|---|---|
| `SELECT count(*) FROM permits WHERE city = …` | 310 ms | 0.9 ms |
| `research_permits_v2` (San Antonio) | 600 ms | 140 ms |
| `research_builders` | 501 ms | 140 ms |
| `permit_skim_wait` | 519 ms | 136 ms |

The 140 ms that is left is the plumbing pairing's join, which `20261111003750_permit_reads_indexed` rewrites. The two migrations touch nothing in common and land in either order.

## Tested

`npm run test:pg:permit-policies` (`supabase/tests/permit_policies/`, in `scripts/sql-beds.txt`): the whole schema applied, this file applied twice, then nineteen assertions. No policy on the seven tables is left bare and thirteen carry the subquery form; the row's own test stands on each write; an estimator reads all five tables, answers in their own name and no other, marks a builder, and inserts a dropped file's row and no other; the plan of a read shows an InitPlan; a helper reads and writes nothing; anon is refused.

## Release order

Merge the PR, then `bash scripts/db-push.sh` from a clean checkout of `main`. The client needs nothing: no name it calls is added, renamed or removed, so it is correct on either side of the push. `ALTER POLICY` takes a brief exclusive lock on each table; `lock_timeout = '3s'` fails the push fast if a table is busy, and it is then run again.

**Applied** to prod by 2026-11-11: `npm run check:migration-drift` read 1239 local files and 1239 remote versions, fully applied (read in the docs pass after #7525); no change to `database.ts`, since the migration alters policies alone.
