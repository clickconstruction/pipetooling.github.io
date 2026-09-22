# 20260922040000_drive_contract_scans.sql (2026-09-22, v2.3709)

`drive_contract_scans` — the Contract sweep's Drive pass, remembered for the whole office. One row per `scope` (`'contracts'`): `files jsonb` (the matched files `drive-contract-scan` returns), `stats jsonb` (`job_folders`, `roots`, `scanned`, `unattributed`, `folder_lookups`, `took_ms`), `scanned_at`, `scanned_by`. Until this, every browser tab ran its own minute-long scan on the sweep's first open; now the function answers from this row while it is younger than an hour, and scans again only when asked (`{ force: true }`) or when the row has aged.

RLS enabled with **no policies**: the service role (the function) is the only reader and writer; the client asks the function, never the table. Ends with `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`.

Apply order: **push before deploying the function** — the new `drive-contract-scan` selects and upserts this row (a missing table would fail every scan). The old function ignores the client's `force` flag, so the client can go out in any order.
