# 20261122021800_coi_checked_against_a_sheet.sql (2026-11-21, v2.8253)

The Document builder, punch list #404, step 6: a trade's certificate held against a job's insurance sheet. One certificate for each job (Taunya, 2026-11-21). Database only: no screen names any of it until the PR after the push.

- **Seven columns on `person_contract_documents`**, all null on every row today:
  - `sheet_project_id`: the job, a GC project, the certificate was checked for. It goes null when the job is deleted.
  - `sheet_revision`: the revision of that job's sheet it was checked against.
  - `sheet_asks`: the sheet's lines it was marked good against. The page reads them off the published sheet (`sheetAsks`): each name, the place, the certificate holder, each coverage with its amount. A certificate is outdated when the job's published sheet no longer reads the same lines.
  - `sheet_checked_at`, `sheet_checked_by`: when it was marked good, and who marked it good or sent it back.
  - `sheet_sent_back_at`, `sheet_missing`: when it was sent back, and the lines it did not show.
- **Only a company's certificate takes a job.** The check `person_contract_documents_sheet_is_a_company_coi` refuses a job on any other paper.
- **`document_builder_coi_mark_good(paper, sheet, asks, good until)`.** A dev alone. The sheet must be published. The paper must be a certificate a company sent or had filed. The company must be on a trade of that job. At least one line and a day that has not passed. It files the certificate (`status` signed) with its last day, the job, the revision and the lines, and clears anything sent back.
- **`document_builder_coi_send_back(paper, sheet, missing)`.** The same checks, with at least one line named. It keeps the lines and the day. The paper's own state is left as it is, so a certificate that is good for the company stays good for the company.
- **A certificate checked for one job is never moved to another.** Both functions refuse it. A second job takes a second certificate.
- **A newer upload after a send-back.** `gc_trade_coi` sets `sent_at` when a company uploads again. A row whose `sent_at` is later than its `sheet_sent_back_at` holds a new certificate, waiting for a look. Nothing here changes that function.
- Both functions run as the caller, so row-level security and the training fences hold as they do for the table. Neither is granted to `anon`.
- Additive and idempotent: `ADD COLUMN IF NOT EXISTS`, the check made once and validated, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE`. It opens with the lock timeout. It makes no table, so it does not call the four fences.
- **It leaves the other cards' columns alone:** `party_*` and `signer_*` (#403), and the reminder and signed-copy columns (#376).

Not changed here, and still true: the trade's upload files one waiting certificate for a company, with no job on it (`gc_trade_coi`, `gc_trade_files`). The check gives a certificate its job. GC mode's start gate still reads the company's own certificate.

Checked before the push: `supabase/tests/coi_checked_against_a_sheet/20_scenario.sql`, in the bed `coi-checked-against-a-sheet`. Docker is down on this Mac, so the bed's first run is CI's.

Apply: `supabase db push` after the merge. No client calls either function yet.
