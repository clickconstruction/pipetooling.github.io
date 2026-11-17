# 20261117090000_lien_filing_applied_from.sql (2026-11-16, v2.7505)

A lien notice applied from a paper already on record: the columns, alone. No screen writes them yet, so the merge holds no deploy. The Lien desk's route is the next PR.

**Why.** One § 53.056 notice can go out for several jobs at a property. It is then recorded on some of them, or with the months it printed and not the month the desk later asks about. The desk kept asking such a job for a notice that went, and offered to print and mail a second one. The office had no way to say that the paper on record stands for this job's month, short of typing the paper in again.

**What.** Four columns on `job_lien_filings`, a check and an index.

- `applied_from uuid REFERENCES job_lien_filings(id)`: set on a notice row that applies a paper already on record to this job. It points at the filing that holds the paper, on this job or on another job at the same property. NULL on every row that records its own paper.
- `applied_from_label text`: that row's job number as the office read it, so the new row can say *as part of the notice on job N*.
- `applied_reason text`: why the paper stands for the months, typed when the desk warned.
- `applied_by_name text`: who applied it, beside `created_by`.
- `job_lien_filings_applied_from_chk`: an applied row is a `notice_53_056` and never points at itself.
- `job_lien_filings_applied_from_idx`: partial, on the rows that point.

**The shape of an applied row.** It sits on the job it is applied to. `months_covered` holds the months that job stands on. `sends`, `fields`, `packet_id`, `printed_claim` and the saved copy are the paper's, copied from the row it points at. `amount` is this job's own share. `by_hand` is true.

**Nothing else changes.** The paper's own row is never written. Undo is the void every filing has (`voided_at`). The readers of a job's notices (`list_lien_notice_months`, `list_lien_affidavit_windows`, the affidavit's notice paragraph) read filing rows, so an applied row counts with no change to any of them. The policies are the table's own: the office inserts and voids.

Starts with `SET lock_timeout = '3s';`. No new table, so no fence calls. Additive and idempotent: `ADD COLUMN IF NOT EXISTS`, the check added only when missing, `CREATE INDEX IF NOT EXISTS`. A foreign key to the same table on a column that is NULL on every row validates at once.

**Order.** Push right after the merge. The route's client writes `applied_from`, so its PR merges only after this push.

**Applied** to prod on 2026-11-16 by `supabase db push` from a checkout at `origin/main`: the dry run named this one file, and `supabase migration list` reads 20261117090000 on both sides. The types followed in their own PR.
