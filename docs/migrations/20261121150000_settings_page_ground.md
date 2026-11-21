# 20261121150000_settings_page_ground.sql (2026-11-21, v2.8182)

The ground under the office's settings page (punch list #389 step 4, `to-dos/sub-nda-builder/README.md`). Taunya answered the four calls the page stood on, and two of them change the database. No screen rides with it. No clause wording is written.

## What it makes

No table, so no fence call. Every statement is safe to run twice.

- **Three columns on `job_required_papers`.** `basis`, the level the office picked before walking the topics, and `notice_read_by` with `notice_read_at`, who ticked the notice's box and when. All null on every row there today.
- **`job_paper_set_settings` replaced**, with the same three names. After the first signature it takes any change.
- **`job_papers_require` replaced**, with the same three names. An entry of `p_settings` may now carry `basis`, and `notice_read`.
- **`job_paper_set_basis(p_required_paper_id, p_basis)`**, the office's. It answers the basis as kept.
- **`contract_paper_settings_def_problem` replaced**, the database's stop on a settings list, started word for word from `20261120050000`. Two stops are added at its end.
- **Four helpers** nobody signed in may call: `contract_paper_lines_bad`, `contract_paper_note_bad`, `contract_paper_has_notice` and `job_paper_basis_clean`.

## Rules it settles

- **Any change after the first signature.** Step 3 took a stricter change only. Now a looser one, or one that tightens one setting and loosens another, is taken too. It is still a new row in the old one's place, and everyone signs again. The answer's `change` says which way it went: `stricter`, `looser`, `mixed` or `same`.
- **The notice's box, once for a paper on a job.** A settings list may open on a notice (`notice.lines`). A paper whose list has one is required only with `"notice_read": true` in its entry, else: *… opens on a notice. Tick its box before you require it.* The row keeps who and when. A change of settings asks for no second tick, and the new row a change makes carries the first one. A list with no notice asks for none.
- **The basis marks the page, never the paper.** It is a level of the Book's list, by key. It is not in the paper, its plain words or its seal. So `job_paper_set_basis` moves it in place whoever has signed, and nobody signs again. A level that is not on the list is refused. An empty basis clears it.
- **The lines a settings list may hold.** A choice may carry `breach` and `site`, with `breachEs` and `siteEs`: lists of twenty plain lines at most, each with words and 400 characters at most. The list may carry a `notice` and a `siteNote`: a title, twelve lines at most, and a few plain words. A settings list is JSON the database stores as given, so these needed no column. What is new is the stop on a shape that is not lines.

## Safe under what is deployed

- The app on Pages calls `job_papers_require` with two names, for plain papers. Nothing changes for it.
- No screen calls `job_paper_set_settings` or `job_paper_set_basis` yet.
- No settings list on prod has a notice, so no require is refused for a tick.
- The edge functions read none of the new columns. The paper `job_paper_clauses` hands back is unchanged, key for key, so the freeze and the seal are as they were.

## One thing to know

Two beds apply step 3's file a second time, which puts its `job_paper_set_settings` and `job_papers_require` back. Both now apply this file after it, as prod has them (`scripts/pgtest-job-paper-settings.sh`, `scripts/pgtest-job-required-papers.sh`).

## Tested

`supabase/tests/job_paper_settings/20_scenario.sql` (`npm run test:pg:job-paper-settings`), 123 assertions. The two looser changes after a signature are each taken and rolled back, so the rest of the bed stands on the stricter one as before. A new section walks the ground: the stop on the shape of the lines, a list with none of the new keys reading as before, the notice's box, the basis kept and moved, who may move it, and a looser change that keeps the basis and the first tick.

**Applied** to prod on 2026-11-21, about 19:10 UTC, by `scripts/db-push.sh` from a checkout at `origin/main`, with this file the only one pushed: a sibling's pending file was set aside for the push and put back. The dev seat's `check_migration_ledger` read 1,425 versions applied with this one newest, the drift check read 1,425 local files against 1,425 remote versions, and a read through the dev seat returned the three new columns. The SQL beds workflow passed all four legs on the whole schema in #9230. Types folded for these names alone in v2.8184.
