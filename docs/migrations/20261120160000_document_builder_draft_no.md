# 20261120160000_document_builder_draft_no.sql (2026-11-20, v2.8143)

The Document builder: a draft has a number, punch list #404. Database only: the tab names the number in the PR after the push. It is the ground for two faults the review of 2026-11-20 found: a tab left open could publish over a newer revision, and the usual's publish to every job wrote each job's draft from the page as it was loaded.

- **`document_builders.draft_no`** and **`document_builder_sheets.draft_no`**: an integer, 0 on a new row. It goes up one each time the row's `draft` or its `revision` changes.
- **The number is the row's own.** Each table's stamp (`document_builders_stamp`, `document_builder_sheets_stamp`, both replaced in place with nothing else changed) sets it from the row as it was. A number the client sends on an insert or an update is dropped.
- **A save and a publish name it.** The page reads the number with the row and writes `WHERE ... AND draft_no = <the number it read>`. A row that moved on matches nothing, so a write from a page that fell behind lands on no row, and the page reads the row again to say what happened. This is the same guard a publish already had on `revision`, which a draft saved by someone else does not move.
- **A read mark does not move it.** It changes neither the draft nor the revision. Marking a revision as read in one tab does not refuse a save from another.
- **A draft saved as it already reads does not move it.** So a save sent twice, after a reply was lost on the way back, is told apart from someone else's change by reading the row.
- **An old page keeps working.** A page loaded before the client that names the number saves as it did, unguarded, until it is reloaded. Nothing refuses a write that names no number.
- Additive and idempotent: `ADD COLUMN IF NOT EXISTS` with a constant default, which rewrites no row, and `CREATE OR REPLACE` for the two stamps. It opens with the lock timeout. It makes no table, so it does not call the four fences.
- **Two migrations now define each stamp.** A later migration that replaces either starts from this file's body, not the table's own.

Checked before the push: section 4b of `supabase/tests/document_builders/20_scenario.sql` and section 2b of `supabase/tests/document_builder_sheets/20_scenario.sql`, in the beds `document-builders` and `document-builder-sheets`. Each bed's script applies the table's migration a second time and then this one, in that order, since each replaces the stamp.

Apply: `supabase db push` after the merge. No client names the number yet.
