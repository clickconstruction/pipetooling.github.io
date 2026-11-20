# 20261120034225_document_builder_sheets.sql (2026-11-19, v2.7988)

The Document builder's ground for a job's sheet, its link and its sends, punch list #404 steps 3 to 5 (and 8 and 9, which reuse the link and the send). Database only: the tab, the public page and the send read it in the PRs after the push.

- **`document_builder_sheets`**: one row a job's sheet of a filled builder, one a builder and a job (`project_id` points at `projects`, as GC mode's tables do). It holds the job's own part as a `draft` and as `published`, the whole page as it read when published (`published_sheet`, what everyone outside sees), its `revision`, and `usual_revision`, the builder's revision it went out on.
- **The rules of a job's sheet**, kept by `document_builder_sheets_stamp`. Only a builder whose kind is `filled` takes a sheet. A sheet starts as a draft on revision 0 whatever the client sent. A revision goes up one at a time, only with its copy and its page, and only on the builder's published revision as it is now: never on a draft of the usual, and never on an older one. A published copy changes only with its revision. Which builder and job it is does not change.
- **`document_builder_links`**: one row a link to a published sheet, or to a builder when `sheet_id` is null, for someone with no page of their own. Only the SHA-256 of the link's code is kept (`code_hash`), with a `nonce` the edge function uses, with a secret it holds, to make the code again. One live link a sheet and one a builder, so a new link ends the old one. It keeps who made it, when it ended, and when and how often it opened.
- **`document_builder_sends`**: one row a send: a job's sheet to a trade partner (`company_id`), or a builder to a customer who is the GC on our jobs (`customer_id`), exactly one of the two. It keeps who it went to, the note, the job it is about for a customer (null means all their jobs), the revision that went, how many times, and the day and the revision they opened. One live send of one thing to one party. Taken off a page, the row stays as the record that it went, and its place is free for a new send.
- **Who writes what.** A dev alone reads all three, by `is_dev()`. A dev writes a job's sheet. A link is written only by the edge function with the service role: no signed-in caller holds a write grant on it. A send is written by the function too. A dev may only take a live send off a page, once: `document_builder_sends_guard` lets nothing else land from a signed-in caller and stamps who did it.
- **What goes with what.** A job that is deleted takes its sheet, and the sheet takes its links and its sends. A builder that has a sheet or a send cannot be deleted.
- The migration writes no row and no words. Additive and idempotent. It opens with the lock timeout and ends with the four fences.

Checked before the push: `supabase/tests/document_builder_sheets/20_scenario.sql`, the bed `document-builder-sheets` in `scripts/sql-beds.txt`.

Apply: `supabase db push` after the merge. No client calls any of it yet.

**Applied** to prod by 2026-11-20: the dev seat's `check_migration_ledger` read 1,410 versions applied against 1,410 local files, this version among them (read in the docs pass after #8832); types regenerated in #9012.
