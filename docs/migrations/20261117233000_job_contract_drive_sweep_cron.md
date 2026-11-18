# 20261117233000_job_contract_drive_sweep_cron.sql (2026-11-17, v2.7645)

Signed contracts in Google Drive (punch list #377, PR 4): the sweep, switched on. One cron row, `job-contract-drive-sweep`, every ten minutes at six past the folder sweep's slot, posts `{ "sweep": {} }` to `job-contract-drive` with the cron secret from the Vault, as `job-drive-folders-sweep` is scheduled.

It calls only while a paper is due: a signed paper in force with no Drive copy that was never tried, was left with no reason, or was held and last tried over an hour ago; or a voided paper whose filed copy has not been renamed to start with `VOIDED · `. A quiet office makes no call. The rule mirrors `contractDriveDue` in `_shared/jobContractDrive.ts`.

The backfill is this row's first run: every signed paper already on file is due once.

Unscheduled first if it exists, so a second run leaves one row. No table and no column, so nothing to fence.

**Order**: push after `20261117213000` (the columns) and after `job-contract-drive` and `drive-contract-scan` are deployed. Pushed before the function exists, each call answers 404 and nothing is filed until it is deployed.
