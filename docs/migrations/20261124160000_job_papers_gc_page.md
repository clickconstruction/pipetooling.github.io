# 20261124160000_job_papers_gc_page.sql (2026-11-24, v2.8503)

What a GC reads about the papers a job requires (punch list #389 step 5, `to-dos/sub-nda-builder/README.md`). The customer-portal function reads it for the jobs a customer is the GC on. No clause wording is written.

## What it makes

No table, no column and no policy, so no fence call. Every statement is safe to run twice.

- **`job_papers_roster_now(p_job_id)`**, new and internal. It is the body of `job_papers_roster` as `20261118020000` left it, copied by script, with the guard taken off. Nobody is granted it, the service role included.
- **`job_papers_roster(p_job_id)` replaced**, with the same name, the same guard, the same grants and the same answer. It now calls `job_papers_roster_now`.
- **`job_papers_gc_page(p_job_ids uuid[])`**, new, for the service key alone. For each job asked about that requires a paper built from settings it answers `{ job_id, papers }`.

## What `job_papers_gc_page` answers

One entry for each live required paper that carries settings, in the order the papers were required:

- `id`, `paper_name` and `settings_revision`, the row's number in its chain.
- `level`: the first level of the Book's settings list whose picks are exactly the job's, as `{ key, label, aligned_with }`. Null for a mix of its own.
- `said`: the picks in the list's own plain words, from `contract_paper_said`, in English.
- `signed` and `total`: how many people on the roster have signed this row, and how many are on the roster.
- `businesses`: one line for each sub business, as `{ name, people, signed, signed_on }`.

## Rules it settles

- **The count is the office's own roster.** Both read `job_papers_roster_now`, so a GC's count and the office's table cannot disagree. The roster holds the office, the job's crew and its subs, so all of them are in `total`.
- **No worker is named.** A line is written only for a person who comes to the job as a sub. Their line is the trade company on their file (`person_signs_for`), or their own roster name when none is on file. People of one company fold into one line.
- **A business has a day only when all of its people signed.** `signed_on` is the last of their days. Until then it is null.
- **A change after a signature starts the count again.** The count is for the live row, and a change after a signature makes a new one.
- **Left out:** a job with no paper, a paper in prose or a form, a paper taken off, and a paper whose Book entry is gone or no longer built from settings.
- **At most 500 jobs** are read in one call, each once.

## Safe under what is deployed

- The app on Pages calls `job_papers_roster` as before and reads the same answer.
- No deployed function calls `job_papers_gc_page`. The customer-portal function of this release reads it and answers an empty list until the migration is pushed.
- Nothing is written by any of the three functions.

## Tested

- The bed `job-papers-gc-page` (`supabase/tests/job_papers_gc_page`, 21 assertions), run locally: the level, the plain words, the count against the office's roster, one business of two people with one and then both signed, a helper who counts and is never named, a mix after a change, a prose paper and a job with none left out, and who may call what.
- The beds `job-required-papers` and `job-papers-lists`, which read the office's roster, run beside it in CI.
