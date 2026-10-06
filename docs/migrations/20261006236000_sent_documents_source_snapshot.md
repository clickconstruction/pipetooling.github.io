# 20261006236000_sent_documents_source_snapshot.sql (2026-10-06, v2.4714)

One column on `sent_documents`:

- `source_snapshot jsonb` (a check keeps it an object or null) — what the source record said when the copy went. A pay application's workbook files its lines and the G702's totals (`payApplicationSnapshot` in `src/lib/aiaPayApplicationHistory.ts`), so when the saved application is changed after it went out the history names each amount that moved against what the GC was given, instead of guessing from timestamps. Other papers leave it null.

Additive; the table stays append-only and its policies are unchanged. No new table, so no fence footers.

Apply order: **client first or with the merge**. The old client never names the column. The new client writes it with the row and, on a database that lacks it (PGRST204), writes the row again without it; a read that is refused (42703) goes again without the column (`src/lib/sent/sentCopiesIo.ts`). So a workbook generated before the push is filed with no snapshot, and the history says nothing about changes to it. Regenerate `src/types/database.ts` after the push.

Test: none in SQL (no `sent_documents` bed yet); the kernel's `aiaPayApplicationHistory.test.ts` covers the snapshot and the comparison.
