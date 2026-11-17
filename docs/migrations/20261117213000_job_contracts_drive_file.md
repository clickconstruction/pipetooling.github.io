# 20261117213000_job_contracts_drive_file.sql (2026-11-17, v2.7643)

Signed contracts in Google Drive (punch list #377, PR 2). Seven nullable columns on `job_contracts` that say where a signed paper's copy in Drive is, written by the edge function `job-contract-drive` with the service role and read by the Contract window, Documents → Where files go and the Contract sweep's Drive pass.

| Column | What it holds |
|---|---|
| `drive_file_id` | The Drive file that is this paper's copy. Null until it is filed. |
| `drive_filed_at` | When it was filed or adopted. |
| `drive_file_origin` | `filed`, the app uploaded it under its own name and mark, or `adopted`, the office already kept it in the jobs drive and nothing was copied, moved or renamed. |
| `drive_file_hold` | Why it is not in Drive, as one of eight kinds. |
| `drive_file_hold_words` | The same in the words a person reads: the kind's own, the job's folder hold, or Drive's refusal. |
| `drive_file_tried_at` | When the function last tried. A held paper is taken again an hour on. |
| `drive_void_marked_at` | When a voided paper's filed copy was renamed to start with `VOIDED · `. |

Three checks keep the columns honest: the origin is one of its two words, a Drive copy has an origin and nothing else does, and the hold is one of its eight kinds. Two partial indexes serve the sweep's queue and a read by Drive id.

No new table, so no fence calls. `signed_document_url` is not touched: it stays what the office typed. Row security is as it was: the four office roles read and write `job_contracts`.

**No cron here.** The sweep is switched on by PR 4's migration, after PR 3 teaches the Contract sweep's Drive pass to leave a filed copy alone.

**Order**: push this right after the merge, then deploy `job-contract-drive`, which reads the columns on every call. Nothing in the client reads them yet, so the Pages deploy does not wait on the push.
