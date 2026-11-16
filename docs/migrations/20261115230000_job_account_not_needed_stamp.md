# 20261115230000_job_account_not_needed_stamp.sql (2026-11-15, v2.7356)

Job accounts: who said *not needed*, and when. A job's account at a supply house (`job_supply_house_accounts`) stamped who asked and who opened it, and nobody when it was marked not needed. Taunya found three such rows on a test job on 2026-11-13, with nothing on the job to say where they came from, and asked on 2026-11-15 for the stamp as its own PR. The words and the presses shipped in v2.7345; this is the record under them.

## What it makes

No table, so no fence call is owed. Two columns, one backfill, one trigger function restated, one function dropped and remade with two more columns.

- **`job_supply_house_accounts.not_needed_by`** (`uuid`, references `users`, `ON DELETE SET NULL`) and **`not_needed_at`** (`timestamptz`), both nullable. They are the server's: the trigger fills them and a value the client sends is never kept.
- **The rows already marked** (32 on prod the day this was written) take their last write, `updated_at`, as `not_needed_at`. Nobody recorded who, so `not_needed_by` stays null and the sheet says only the day. The stamp trigger is set aside for that one statement, inside a `DO` block, so `updated_at` keeps the time it is being read from.
- **`job_supply_house_accounts_stamp()`** restated from 20260914210000 with one more branch. A row that becomes not needed, or whose reason (`note`) changes while it is, takes `now()` and `auth.uid()`. A not-needed row written with neither change keeps the pair it had. Any other status carries none, so marking an account opened clears it. The requested and opened pairs are stamped as before.
- **`list_job_account_strip(uuid[])`** dropped and remade from 20260914280000 with **`not_needed_at`** and **`not_needed_by_name`** at the end of its row; a `RETURNS TABLE` cannot grow in place. The name comes through the function because the crew reads the strip and cannot read `users`; a blank name answers null. The gate, the fifteen columns before them, and the grants (`authenticated`, `service_role`; not `anon`) are as they were.

Both bodies were compared with prod before they were restated: the `prosrc` of each on prod hashed the same as the repo's latest definition.

## Order and proof

The client reads the two new columns as absent until the push, and then draws no stamp line, so the push can follow the merge at leisure; `npm run check:calls-ahead` warns on the remade function as it does for every restated body. The old client reads the remade function's first fifteen columns and ignores the rest.

Proved by CI's `job-account-not-needed-stamp` bed (`scripts/pgtest-job-account-not-needed-stamp.sh`, `supabase/tests/job_account_not_needed_stamp/`): the migration applied twice over the old shapes; an old not-needed row takes its day, no name, and keeps its `updated_at`; a mark names the signed-in person and ignores a stamp the client sends; a write that changes neither status nor reason keeps the stamp; a new reason through the Mark opened window's upsert moves it; marking opened clears it and stamps the opened pair; a requested row carries none; a write with nobody signed in keeps the day and no name; the strip hands the crew the day and the name, nulls where there is none, and holds its gate and its grants.

## Not changed

The table's policies, the read-only and archived fences, `list_bid_job_account_strip` (the Bid Board's chips do not show the stamp), and the roster's read of the table.

**Applied** to prod by 2026-11-16: `npm run check:migration-drift` read 1326 local files against 1326 applied, this version among them (run in the docs pass after #8111); `database.ts` on `main` carries `not_needed_by`, `not_needed_at`, `list_job_account_strip`.
