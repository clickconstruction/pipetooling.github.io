# 20261112090000 — dev_seat_reads_counsel_only (v2.6986)

The dev seat reads counsel-only material, for now, on the owner's word of 2026-11-11.

- **`counsel_only_held_from_seat()`**: `IMMUTABLE`, `SELECT false`. Whether counsel-only material is held from the dev seat. Executable by `authenticated` and `hr_agent`.
- **Six restrictive policies altered** (`ALTER POLICY … USING`), each as it stood with `AND public.counsel_only_held_from_seat()` added beside `public.request_is_dev_seat()`: `person_file_evidence_counsel_only_seat` and `person_file_attachments_counsel_only_seat` (`20261106020000`), `file_index_counsel_only_seat` (`20261108200000`), `legal_matter_documents_counsel_only_seat` and `documents_matter_counsel_only_seat` (`20261108230000`), `person_file_amendments_counsel_only_seat` (`20261112050000`). With the switch false each lets every row through, so the planner folds them away.
- **`dev_matter_doc_read`**: the body of `20261108233000`, the counsel-only refusal now also asking the switch. Nothing else in it changes (the test compares the two bodies).
- Not touched: `request_is_dev_seat()`, the `hr_agent` policies, the Drive filer, the portal and print. No table is created, so no fence call is owed.

**To put the fence back**: one migration with `CREATE OR REPLACE FUNCTION public.counsel_only_held_from_seat() RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT true $$;`. No policy or function needs rewriting, and the seat's replies name the hold again on their own.

**Order**: after `20261112050000` (the amendments policy it alters). Push after the merge, then deploy `dev-mcp`, `legal-portal` and `hr-evidence-drive`.

**Applied** to prod by 2026-11-13: the dev seat's `check_migration_ledger` read 1274 applied, this version among them, against 1274 files in `supabase/migrations/` (read in the docs pass after #7659).
