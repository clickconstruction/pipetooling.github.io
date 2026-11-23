# 20261123010000_gc_statement_in_kind_apart.sql (2026-11-22, v2.8309)

`get_gc_statement_email_payload` (last defined in `20260928213000`) leaves out a bill an in kind deal pays. Punch list #301, the owner's call of 2026-11-22.

A row whose job carries `jobs_ledger.in_kind_arrangement_id` is no longer in a group's `rows`, and no sum counts it: not `subtotal`, `job_count`, `oldest_age_days` or `grand_total`. Each group gains `in_kind_rows`, the same row shape, and `in_kind` (`count`, `dollars`), the bills with more than a cent open by this function's own netting. The payload gains `in_kind`, the sum over its groups. A group whose every bill is on a deal stays, with no rows and a subtotal of 0.

The row object is built once in a new CTE, `rows_obj`, so both lists hold one shape. The body is otherwise verbatim: who pays, the row keys, the address order, the collections flag and what paid each bill. Grants are unchanged, service role only.

Readers: `gc-statement-email-dispatch` and `send-gc-statement-email` (through `_shared/gcStatementGateIo.ts`) net `in_kind_rows` by the payment rule and count them with `setInKindApart`. `get_statement_week_for_office` calls this function, so its amounts, its over 90 days and its $10,000 line leave such a bill out with no change of its own.

**Apply order:** push right after the merge, then deploy the two functions. A function deployed before the push sees no `in_kind_rows` and sets nothing apart, as before. A function not yet deployed after the push lists fewer rows and smaller sums, with no line saying why.

## Applied

On the prod ledger, read on 2026-11-23 with the dev seat's `check_migration_ledger` during a docs catch-up. The push's own time and checks were not recorded here.
