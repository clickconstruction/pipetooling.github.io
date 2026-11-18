# 20261117150000_sub_paper_ack_targets.sql (2026-11-17, v2.7569)

What a sub answers from their page is kept on the thing itself (punch list #371, step 1). Columns and indexes on `sub_paper_acks`. No function, no new table.

**Why.** `sub_paper_acks` (`20261117040000`) hung every answer on a paper in the register: `paper_id`, `NOT NULL`. A sub can mark a payment received whose record the office has not made, or say something is wrong on a sheet whose work statement the office has not made. Those have no row in the register. The page must not make one: a work statement registered from the page would hold the place the office's first number goes, which is the page giving out a number.

**What.**

- `paper_id` and `revision` may be null. They are filled where the office has made the paper: the copy the sub saw.
- `person_id`: whose page the answer came from.
- `labor_job_id`: the sheet, for *something is wrong* on a work statement.
- `sending_id`: the sending, for *got it* or *something is wrong* on a payment.
- `payment_id`: the one payment row, for a payment recorded before sendings.
- Each of the four points at its table with `ON DELETE SET NULL`, so an answer outlives the row it was about.
- `sub_paper_acks_received_sending_key` and `sub_paper_acks_received_payment_key`: unique where `kind = 'received'`. A payment is marked received once, whatever two presses at one moment do.
- `sub_paper_acks_person_idx` and `sub_paper_acks_sheet_idx`, for the page's read and the Pay view's.
- The table's comment and the six columns' comments say the same.

**Nothing else changes.** The policies and the grants of `20261117040000` stand: the office reads, nobody signed in writes, and the `sub-portal` function writes with the service key. The table holds no row yet, so nothing is backfilled.

Starts with `SET lock_timeout = '3s';`. No new table, so no fence calls. Idempotent. Adding the four references takes a brief lock on `people`, `people_labor_jobs`, `sub_payment_sendings` and `people_labor_job_payments`, and the timeout fails the push fast if one is busy.

**Order.** Pushed right after its merge, and before `sub-portal` is deployed with the answers. Until the push, the function's read shows no answers and a write is refused. Nothing on a screen calls either yet.

**Checked.** The bed `sub-papers` gains a second scenario, `supabase/tests/sub_papers/30_ack_targets.sql`: an answer needs no paper, a second *received* on one sending or one lone payment is refused by its index, a note can be sent again, an answer stays when its payment row goes, the office reads, nobody signed in writes or changes a row, and an estimator reads nothing. The runner re-applies both migrations.

**Not checked.** Not run on this Mac, which has no Docker. The SQL beds workflow in CI is its first run.

**Verify**, read-only on prod after the push:

- `select column_name, is_nullable from information_schema.columns where table_name = 'sub_paper_acks' order by 1` names `person_id`, `labor_job_id`, `sending_id` and `payment_id`, and reads `YES` for `paper_id` and `revision`.
- `select indexname from pg_indexes where tablename = 'sub_paper_acks' order by 1` names the two `received` keys.

**Applied** to prod on 2026-11-17 by `supabase db push --include-all` from a checkout at `origin/main` (5223c4c540, after the merge of #8498). The dry run named this one file. `--include-all` was needed because `20261117160000` and `20261117170000` were already on prod. `check:migration-drift` reads 1,349 versions on both sides. A read of `sub_paper_acks` that names the four new columns answers, with no rows. The indexes were not read back: the file applies whole or not at all. The types follow in a PR of their own.
