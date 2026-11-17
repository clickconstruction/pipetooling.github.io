# 20261117200000_agreements_on_file.sql (2026-11-17, Documents → Agreements' one list, punch list #376)

The read behind the coming Documents → Agreements tab. The app keeps agreements in three tables, each with its own window, and the Documents page listed none of them as agreements. Shipped as v2.7612; the rules are `src/lib/documents/agreementsLedger.ts` (v2.7604) and the read is `agreementsLedgerIo.ts`.

- **`agreements_on_file`**, a view, `WITH (security_invoker = true)`, three branches under one shape:
  - `job_contracts` where `status <> 'draft'`: kind `job_contract`, `job_warranty` or `their_paper`. One signed paper filed over several jobs (`covers_group_id`) is one row, on the first job filed, with `more_jobs` counting the rest and every covered job's words in `find_text`. Live and ended rows of one group stay apart.
  - `person_contract_documents` where `doc_type = 'agreement'`, `status IN ('sent', 'signed')` and `company_id IS NULL`: kind `partner_agreement` when it has a `partnership_id`, else `person_agreement`, with `people.kind` as `person_kind`. A row another row supersedes is `ended`, with `facts.replaced`.
  - `step_commitments` where `status <> 'draft'`: kind `work_order`, on its job through `job_id`.
- **The columns**: `id` (`<kind>:<uuid>`), `kind`, `source_id`, `state` (`waiting`, `signed`, `ended`), `paper_name`, `with_name`, `job_id`, `job_hcp_number`, `job_click_number`, `job_name`, `job_address`, `more_jobs`, `person_id`, `person_kind`, `at` (the moment the list sorts on), `at_day` (its day in America/Chicago: the signed day, the sent day, or the day it ended), `facts` (the few columns of the kind's own table its words are made from, empty ones stripped, and no money column) and `find_text` (lower-case words for the find box).
- **A work order's offer that ran out** reads `ended` from the day after `offer_expires_at`, in America/Chicago, as `workOrderCoverage.ts` reads it.
- **The gate** is each table's own: `security_invoker`, so `job_contracts` and `person_contract_documents` answer the office, and `step_commitments` also the estimator, a superintendent on their own jobs and the sub named on the row. The joins on `jobs_ledger`, `customers` and `people` run under their own policies and are left joins, so a row the caller may read never disappears for a job or a person they may not. No policy changes.
- **No table is made**, so the fence calls are not needed; nothing here writes. `GRANT SELECT` to `authenticated`.

Not in it yet: a trade company's paper (`company_id`), GC mode's owner contract and statement of work. They join in a later migration of the same card.

**The bed**: `agreements-on-file` (`scripts/pgtest-agreements-on-file.sh`, `supabase/tests/agreements_on_file/20_scenario.sql`, `npm run test:pg:agreements-on-file`). On the whole schema it proves the office's list in order with each row's state, name, party, job and day; the paper over three jobs as one line; drafts, an unsent paper and a W-9 absent; the facts without an amount; and each role's reach: an estimator work orders alone, a primary and a superintendent nothing, a sub their own work order, a caller not signed in nothing.

Apply order: no screen reads the view in this PR, so nothing waits on the push. Push after the merge, before the tab's PR is armed. The view is new, so the generated types gain it at the next regen; the client casts once in `agreementsLedgerIo.ts` until then.
