# 20261109011500 — gc_trade_files_note (v2.6746)

Punch list #205, row 3 (PR 4): a trade partner company's **Send Click a file** from its portal, a photo or a ticket that belongs to no record, with a one-line note as its name. The file lands in the job's Drive folder under Team only → From trades → the company, and its `gc_trade_files` row carries `purpose = 'note'`.

- Widens `gc_trade_files_purpose_known` to `('submittal', 'change', 'quote', 'waiver', 'coi', 'note')`, the P5b migration's way (drop, add `NOT VALID`, validate), so the check never scans the table under a lock.
- Nothing else: no table, so no fence calls; `gc_trade_files_job_or_company` already holds a `note` file to a project.

Deploy order: push this **before** `submit-gc-trade-portal` is deployed, since the function writes the new purpose; the client ships first (it reads a slice with no `files` as no block, and a refused write says so). Then deploy `submit-gc-trade-portal` and `gc-trade-portal`.

**Applied** to prod 2026-11-09 about 02:25Z with `supabase db push` from a clean checkout of `origin/main` after #7375 merged (the dry run listed this file alone), then `submit-gc-trade-portal` and `gc-trade-portal` deployed from main with the four other functions behind for v2.6746 (`gc-trade-email`, `messages-email`, `send-contract-for-signature`, `submit-portal-request`). Read the same day through the dev seat's `check_migration_ledger`: 1185 versions applied, this one newest, against the 1185 files on `main`; `npm run check:edge-drift` on main read all 182 functions current.
