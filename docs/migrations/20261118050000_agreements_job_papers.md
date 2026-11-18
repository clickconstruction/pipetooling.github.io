# 20261118050000_agreements_job_papers.sql (2026-11-18, v2.7726)

Papers before a job opens: where the papers show. Step 7 of seven. Each person's copy of a paper a job requires becomes a line on Documents → Agreements with its job.

## What it makes

No table and no function. The view `agreements_on_file` (punch list #376), restated with `CREATE OR REPLACE VIEW` from its newest definition, `20261117210000_agreements_on_file_gc.sql`. Only the person branch changes:

- `person_docs` left-joins `jobs_ledger` on the paper's `job_id` and `job_required_papers` on its `job_required_paper_id`, under the caller's own policies (`security_invoker`, as before).
- Its filter keeps a paper of the kind `agreement`, as before, or any paper a job requires.
- The branch answers the paper's job in `job_id`, `job_hcp_number`, `job_click_number`, `job_name` and `job_address`, where it answered nulls.
- `paper_name` is the required paper's own name when there is one, else the filed name as before.
- `find_text` adds the words *job paper*, the job's numbers with a J, its name and its address.

The columns are the same and in the same order, so the tab, its search and every grant stay as they are.

## Rules it settles

- **A person's paper with no job reads exactly as before.** Every join is a left join and every added word is null for it.
- **Who reads a job paper's line** is who reads `person_contract_documents`: the office. A primary and a sub read none, their own included.
- **The filed name stays off the screen.** `<paper> (job <number>)` keeps the Contract Book's name-keyed paths off a job's copy. The line shows the paper's own name and the job beside it.

## Order and proof

No client change rides with it, so the push follows the merge.

Proved by CI's `agreements-on-file` bed (`scripts/pgtest-agreements-on-file.sh`), which now re-applies this file as its second run, with a section for job papers added to `supabase/tests/agreements_on_file/20_scenario.sql`.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
