# 20261001180000_job_contracts_covers_group.sql (2026-10-01, v2.4301)

One column and one partial index, no function, no trigger, no policy change.

- **`job_contracts.covers_group_id uuid`** (nullable): the rows filed together as one signed paper for several named jobs share it; it is the first row's id. Null means a contract for its own job only. Coverage is still per job, so every covered job keeps its own signed row and nothing that reads `job_contracts` changes.
- **`job_contracts_covers_group_idx`** on `covers_group_id` where it is not null.
- **RLS**: unchanged; the table's office policies cover the new column. No new table, so no read-only blocks to apply.

Client: `src/lib/jobs/jobContractCoversWrite.ts` writes it (`fileContractForJobs`, `addJobToPaper`, `saveCoveredJobs`) and `src/lib/jobs/jobContractCovers.ts` groups rows by it (`coversGroupKey`). The column was hand-added to `src/types/database.ts` in the same PR; regenerate (`npm run gen-types:linked`) after the push.

Apply order: push right after the client merges. Until the column exists, filing several jobs at once fails at the step that links the rows (a single-job filing still works); reads do not depend on it.
