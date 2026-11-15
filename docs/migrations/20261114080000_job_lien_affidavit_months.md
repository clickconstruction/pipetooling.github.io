# 20261114080000_job_lien_affidavit_months.sql (2026-11-14, v2.7270)

Punch list #356 part 2, the owner's door 1: the months a job's lien affidavit swears, set by hand with counsel's reason. One new table, `job_lien_affidavit_months` (`job_id` PK → `jobs_ledger`, `months text[]` as `YYYY-MM`, a non-blank `reason`, `set_by`, `set_by_name`, `set_at`, `updated_at`), RLS for the desk's own roles (dev, assistant-like, master: read, insert, update, delete), and the four house fences. No other table changes.

Apply order: the client reads the table with a read that tolerates its absence (the desk and the Lien window carry on with the record's months, and the pane's editor says it could not read), so the client may deploy first and the push follow in the same sitting. Until the push, **Set the months by hand…** fails with the table's refusal and nothing is written.
