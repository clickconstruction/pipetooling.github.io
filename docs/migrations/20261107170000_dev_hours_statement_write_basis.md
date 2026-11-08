# 20261107170000_dev_hours_statement_write_basis.sql (2026-11-07, v2.6654)

Signed hours statement (punch list #212, the dev MCP's charged and sheet papers): `dev_hours_statement_write` replaced so `make` takes the four `hours_statements` columns the Hours statement window has saved since v2.6097 and v2.6446 that the wrapper of [`20261103003000`](./20261103003000_dev_hours_statement_write.md) never took:

- `basis` — `paid` (the default) or `charged`; on `charged` the row's `with_pay` is forced off, as the table's `hours_statements_charged_no_pay` check wants, and a `kind` of `sheet` is refused (*a sheet paper is always as paid*), as the window holds its switch.
- `charge_rate` and `charge_words` — what a charged paper was priced by, kept on the row for the list and the print; null off the charged basis.
- `labor_company` — a sub's company on the attestation, at most 160 characters (the column's own check), null when none is named. Taken now so the card's third residual is a client change alone.

The dry run's `after` names all four. `mark_sent` and `file_on_matter` are the earlier body unchanged. Devs only; `CREATE OR REPLACE`, idempotent; no table is created, so no read-only fence is owed.

Apply from the main checkout after the PR merges (`supabase db push`), then `supabase functions deploy dev-mcp`. Before the push the old body ignores the new keys: an `apply_hours_statement` on the charged basis would land a row reading `paid` with no charge columns, so push before the seat is used for one. `src/types/database.ts` and the catalog do not change (no column is added).

**Applied** to prod on 2026-11-07 after #7246 merged, from a clean checkout of main with `supabase db push --linked` (20261107160000 rode along); `npm run check:migration-drift` read 1153 local files and 1153 remote versions, fully applied. `dev-mcp` deployed the same hour at 0.39.0.
