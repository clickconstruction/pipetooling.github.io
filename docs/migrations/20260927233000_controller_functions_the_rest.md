# 20260927233000_controller_functions_the_rest.sql (2026-09-27, v2.3900)

Batch 5 of the controller-access audit (punch list #48, `to-dos/controller-access.md`). `CREATE OR REPLACE FUNCTION` on the remaining 35 functions: job status and collections flags, reports lists, schedule shares and the schedule email, workflow step edits, estimate decline and catalog, bid pricing access, PO codes, tally, customer merge, and the four membership triggers. Each is its live definition with the controller named beside the assistant in its role check; nothing else in any body changes.

The definitions were read with `pg_get_functiondef` on production the same day. `CREATE OR REPLACE` keeps each function's owner, grants and comment. `SET lock_timeout = '3s'`. No client change is needed and the order with the client does not matter.

Verify after the push: the audit's function query (a body naming `'assistant'` and never `controller`) returns none of this batch's functions, and each still exists with its grants.
