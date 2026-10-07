# 20261007190000_lien_desk_skips_uncollectible.sql (2026-10-07, v2.4788)

Punch list #94, PR 4 ([v2.4788](../recent-features/v2.4788.md)): a Collections job marked Uncollectible (the columns of [20261007170000](./20261007170000_job_uncollectible.md)) leaves the Lien desk.

1. **`list_lien_notice_months`**, **`list_lien_affidavit_windows`**, **`list_lien_retainage_windows`** re-created with one clause each — `AND j.uncollectible_at IS NULL` beside the billed-status predicate (the first two) or the retainage predicate (the third). Bodies otherwise verbatim from their last definitions (`20261006120000`, `20261006120000`, `20260923200000`); same signatures, same grants, so `CREATE OR REPLACE` is enough.

Locks: three `CREATE OR REPLACE FUNCTION` — instant. Idempotent. Nothing else moves; the Lien desk's other reads (the calendar from the board rows, GC on notice, the owner-records picker) skip the mark on the client in the same PR.

## Order

After `20261007170000` (the column must exist). Merge, `supabase db push`; no types change (same return shapes).
