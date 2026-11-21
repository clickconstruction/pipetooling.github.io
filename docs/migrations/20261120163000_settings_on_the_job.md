# 20261120163000_settings_on_the_job.sql (2026-11-20, v2.8145)

Settings on the job, the ground (punch list #389 step 3, `to-dos/sub-nda-builder/README.md`). A job carries the picks of a paper built from settings on its required paper's row. That row alone lifts step 1's refusal: a copy of such a paper is made for the job, and signed only as the database reads it. No screen rides with it. No clause wording is written.

## What it makes

No table, so no fence call. Every statement is safe to run twice.

- **Seven columns on `job_required_papers`.** `settings` (the picks) and `fields` (the typed blanks), `book_revision` (the Contract Book revision they were set against), `settings_revision` (the row's number in its chain), `revision_of` (the row it replaced), `settings_set_by` and `settings_set_at`. All null on every paper a job requires today. One check holds them whole or absent.
- **`job_papers_require` with a third name**, `p_settings`: `{"<book document id>": {"settings": {...}, "fields": {...}}}`. The two-name function is dropped here, because a new parameter is a new function. The old two names still call it.
- **`job_paper_set_settings(p_required_paper_id, p_settings, p_fields)`**, the office's. It answers `{state, id, revision, change, sign_again}`.
- **`job_paper_clauses(p_required_paper_id, p_lang)`**, the job's paper as the database puts it together: `contract_paper_clauses()` for the row's picks and blanks, with `jobPaperId`, `settingsRevision`, `said` and `sha256`. The service role and the office.
- **A trigger on `job_required_papers`**, `job_paper_settings_locked`.
- **`contract_copy_refuses_bare_settings` replaced**, the trigger function step 1 put on `person_contract_documents`. The trigger itself is not remade, so that table takes no lock.
- **Nine helpers** nobody signed in may call: `job_is_zz_test`, `contract_paper_picks_change`, `contract_paper_said`, `contract_paper_seal`, `job_paper_picks_clean`, `job_paper_typed_clean`, `job_paper_read_problem`, `job_paper_settings_check` and `job_paper_clauses_now`.

## Rules it settles

- **A paper built from settings is required with its picks.** Without them it is refused: *… is built from settings. Require it with its settings.* The picks are checked whole before the job takes them: one for every setting, a paper that goes together, and the read-revision rule. A pick that is not on the list is left behind.
- **A plain paper takes no settings**, and its row, its copy and its signature take the paths they took before. A row is born with settings or without and never changes kind.
- **The read-revision rule.** A job that is not a ZZ Test job takes a paper built from settings only at the revision an attorney read (`read_revision = revision`). It is asked where the paper is required, where its settings change, and where it is read or signed. So a clause edit stops signing on every such job until the new revision is marked as read. A ZZ Test job takes any revision. The ZZ rule is `isZzTestJob`'s: the job's own name or its stored customer name starts with ZZ.
- **The words are the Book's, read live.** The row keeps no body. Each signer signs the Book's revision of that day, and their copy freezes it. `book_revision` records what the office last set the settings against.
- **The lock at the first signature.** Until a copy is signed the office changes the row in place. Once one is signed the row keeps its settings as signed, whatever writes the table.
- **A change after the lock makes a new row, and may only tighten** (until 20261121150000, which takes any change). The old row is taken off and keeps its signatures. The new one stands in its place in the job's order, and everyone signs it again. A looser change, or one that tightens one setting and loosens another, is refused: *To loosen it, take the paper off the job and require it again.* The same picks with new typed words, or at a newer Book revision, are a change too.
- **Stricter is a place in a list.** A choice's place in its setting's list is its strictness, the loosest first. A setting the old picks never had counts from the loosest. An old pick the list no longer has cannot be placed, so the change reads as mixed.
- **A copy is signed only as the database reads it.** The sign path sends the paper it read. The trigger puts the job's paper together again in that language and refuses anything else, or nothing: *The paper changed since you opened it.* So the freeze holds whatever the functions do.
- **The seal.** `sha256` is a SHA-256 over the paper's id, its language, the picks, the blanks and each clause with its id, version, number and words. Each piece is written as its length in bytes, a colon, the piece and a comma. The revision and the heading are not in it, so the same settings and the same clause versions seal the same.
- **Taking a paper off and requiring it again** brings the row back with its signatures when the picks, the blanks and the Book's revision are the same. Otherwise it is a new row.

## One pick taken from the card

The card leaves *a change after signing starts* open, with the pick *allowed, as a new revision, with the count who sign again*. This file takes that pick, and holds a change after the first signature to stricter only. Taunya flipped it on 2026-11-21: [`20261121150000_settings_page_ground`](./20261121150000_settings_page_ground.md) takes the `looser` and `mixed` refusal out of `job_paper_set_settings`, so any change is a new row that everyone signs again.

## Safe under what is deployed

- The app on Pages calls `job_papers_require` with two names. It gets the default, and a plain paper is required as before.
- The edge functions deployed on the day of the push refused every paper built from settings before they read anything else (`SETTINGS_PAPER_BARE`), so a job could require such a paper and nobody could open or sign it. Nothing was signed bare in the meantime: the trigger refuses a signature with no frozen paper. The sign path's functions were deployed on 2026-11-21, and a ZZ Test paper was signed on prod (v2.8156's fragment has the walk).
- No Book entry but a ZZ test one has a settings list, and no job on prod requires a paper, so nothing changes for anyone on the day this is pushed.

## One thing to know

`scripts/pgtest-job-required-papers.sh` applies the older gate migration a second time, which makes the two-name function again. It now applies this file after it, as prod has them. The file is not named `*_job_paper_settings.sql`: two older beds find step 1's migration by `*_paper_settings.sql`.

## Tested

`supabase/tests/job_paper_settings/20_scenario.sql` (`npm run test:pg:job-paper-settings`), 105 assertions, green on the whole schema in the SQL beds workflow on its first run (#9180). One set of cases runs through the database: which way a change of picks goes, the picks in plain words, and the seal. Then: a job with no settings as before, a paper required with its picks and refused without, the read-revision rule on both jobs, who sets a job's settings, a copy made for the job and never bare, a copy signed only as the database reads it, the lock, a stricter change after it, a typed blank alone after it, a clause edit leaving the signed words alone, and taking a paper off and requiring it again.

**Applied** to prod on 2026-11-21, about 06:20 UTC, by `scripts/db-push.sh` from a checkout at `origin/main`, with this file the only one pending. The dev seat's `check_migration_ledger` read 1,419 versions applied with this one newest, and the drift check read 1,419 local files against 1,419 remote versions. Proved on the `ZZ TEST sink` job with a `ZZ Test` Book entry of placeholder clauses: required with its picks and refused without, read in English and Spanish with a seal the kernel's text reproduces, changed in place, a copy with no job refused, and a write by hand refused. The row was then taken off. Types folded for these names alone in v2.8154.
