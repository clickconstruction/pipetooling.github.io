# 20261123024500_statement_week_in_kind_line.sql (2026-11-22, v2.8320)

`get_statement_week_for_office` (last defined in `20260928040549`) answers one more key, `in_kind` (`count`, `dollars`). Punch list #301, the owner's call of 2026-11-22.

The week is built on `get_gc_statement_email_payload`, which since `20261123010000` keeps a bill an in kind deal pays off a GC's rows and sums. So the week's amounts, its over 90 days and its $10,000 line already leave such a bill out. The new key sums the payload's `in_kind` over its GC groups, a GC under the line included and the bucket of bills no GC pays left out. `statement-round-email-dispatch` prints one line from it.

The body is otherwise verbatim, copied from the function's own text. `get_my_statement_week()` calls this function and passes the key through. No new table. Grants are unchanged.

**Apply order:** after `20261123010000`. Pushed before it, the key reads zero. Push, then deploy `statement-round-email-dispatch`.

**Applied** to prod by 2026-11-23: `npm run check:migration-drift` read 1,454 versions applied against 1,454 local files, this version among them (read in the docs pass after #9274).
