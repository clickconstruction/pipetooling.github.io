# 20261117220000_job_required_papers.sql (2026-11-17, v2.7641)

Papers before a job opens: the ground. Step 1 of seven. The owner asked on 2026-11-17 for a job that can require papers, one or several, that a person signs before the job opens to them, and settled the same day that everyone signs, the office too. This migration makes the papers a job requires, a person's signed copy tied to that job, the one question every lock will ask, and the functions the next two steps' screens call. No screen calls any of it yet.

**It locks nothing.** No policy on a table in use changes. Until the office requires a paper on a job the new table is empty, and the lock question answers *open* for every job after one look at it.

## What it makes

One table, so the four fence calls close the file. Two columns on `person_contract_documents`. Ten functions.

- **`job_required_papers`**: one row per paper a job requires. `job_id` cascades. `book_document_id` is the Contract Book entry it was picked from, set null if that entry goes. The words are the job's own: `paper_name`, `body_html`, `body_format`, `canonical_document_url`, `form_template_id` (a form a job requires cannot be deleted). Then `required_by`, `required_at`, `removed_at`, `removed_by`. One live row per job per Book entry. The partial index `job_required_papers_live_job` holds live rows only and is the look every lock begins with.
- **Its read rule**: the office reads it (`is_office_staff()`). There is no insert, update or delete policy and no such grant: rows are written by `job_papers_require` and `job_paper_remove` alone.
- **`person_contract_documents.job_id` and `.job_required_paper_id`**: one person's copy of one required paper, both set null if the job or the requirement goes, so a signed paper outlives its job. One copy per person per required paper (`person_contract_documents_one_per_job_paper`).
- **`job_closed_to_me(job)`**: true when the signed-in user still owes a paper the job requires. A `CASE` keeps the order: no login, then one probe of the live rows for that job, and only a job that requires a paper reaches the caller's own papers. False for the service role.
- **`jobs_closed_to_me()`**: the same answer as an array of job ids, for a list's lock marks and for a policy that asks once a statement.
- **`job_papers_mine(job)`**: the prompt's read, `{job_number, linked, papers[{id, paper_name, is_form, document_id, status, signed_at}]}`. The number comes only with a job that requires a paper. Nothing else of the job is returned.
- **`job_paper_start(required paper, person?)`**: the id of one person's copy, made from the job's words the first time and handed back as it is after that. The caller's own by default. The office and the service role may name someone else.
- **`job_papers_require(job, book entries[])`** and **`job_paper_remove(required paper)`**: the office's two writes.
- **`job_papers_roster(job)`**: for the office, everyone who can open the job today against each paper. The office (dev, master technician, assistant, controller, with a login, no twin and no sample account), the job's team, anyone on its schedule since last Monday week, its subs (a labor sheet or a live work order on the job), and anyone else already holding a copy.
- **`job_papers_needing_me()`**: the jobs that wait on the caller's signature and are theirs to open. Every closed job for the office. For anyone else, the closed jobs they are on.
- **`job_papers_for_person(job, person)`** and **`job_paper_job_number(job)`**, internal: the service role alone runs them. The sub's page reads the first in step 6.

## Rules it settles

- **Who must sign**: everyone with a login, the office too. There is no audience column.
- **What counts**: a copy with status `signed` whose person is tied to the caller's login. A paper the office marks signed by hand counts the same.
- **The person is found by `people.account_user_id`**, never by name. A login tied to no roster person reads as owing, `linked` is false, and `job_paper_start` refuses in words.
- **The job keeps the paper's words.** Requiring a paper copies the Book entry as it stands. A Book edit later changes nothing a job asks for. A paper with no words (no body, no form, no link) is refused.
- **Taking a paper off keeps every signature.** Requiring the same Book entry again brings the old row back, signatures and all, when the Book's words have not changed since. Changed words make a new row and ask for new signatures.
- **A job's copy is named with the job's number**, `<paper> (job <number>)`. The Book's name-keyed paths never match it: `materializePacketForPerson`, `create_pending_contract_versions_after_book_save` and the rename inside `update_contract_book_entry` all look a paper up by person name and document name.
- **Before signing a person sees the job's number and the papers' names**, and any signed-in user may ask for them and sign. The clock-in search can lead anyone to a job.
- **Training mode cannot sign.** `job_paper_start` writes a row, and the training-mode statement trigger refuses every write. A training account sees the prompt and stays behind it.

## What it leaves alone

The policies on `person_contract_documents`: only the office reads or writes a paper's row, as before. A person reaches their own copy through the functions here and through the signing page's token.

## Order and proof

Nothing in the client calls these names, so the push follows the merge and no deploy waits on it.

Proved by CI's `job-required-papers` bed (`scripts/pgtest-job-required-papers.sh`, `supabase/tests/job_required_papers/`, a line in `scripts/sql-beds.txt`, `npm run test:pg:job-required-papers`), on the whole schema with the migration applied twice. It counts the scans a transaction starts (`pg_stat_xact_user_tables`): with no required paper anywhere, a hundred asks of the lock question start a hundred scans of `job_required_papers` and none of `person_contract_documents` or `people`. CI was its first run: this Mac had neither Docker nor a free local Postgres.
