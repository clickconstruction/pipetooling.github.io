# 20261007230000_legal_matter_documents.sql (2026-10-07, v2.4810)

Documents from the office on a legal matter ([v2.4810](../recent-features/v2.4810.md)).

1. **`legal_matter_documents`** (new): `matter_id`, `title`, `shows` (one line the firm reads), `storage_path`, `mime`, `size_bytes`, `original_name`, `added_by` / `added_at`, `held_reason` (`''` = goes to counsel), `voided_at` / `voided_by`. Title and the line are required by check. The office cohort (`legal_office_can_read()`: dev, master, assistant, controller) selects, inserts and updates; no delete policy, a document is retired. Index on `(matter_id, added_at)` where live.
2. **`legal_matter_documents_stamp()`**, a BEFORE INSERT OR UPDATE trigger: `added_by` / `added_at` from the session on insert, `voided_by` from the session when `voided_at` is first set, so who did it never comes from the browser.
3. **Bucket `legal-matter-documents`**, private. One `storage.objects` policy for the office cohort, all verbs, under a folder named by a matter uuid. The `legal-portal` function reads as the service role and mints 15-minute signed links.
4. The three fences.

Locks: the CREATE TABLE and the bucket row touch nothing live; `SET lock_timeout = '3s'` first. Idempotent.

## Order

Merge, `supabase db push`, regenerate types, then `supabase functions deploy legal-portal` (the function tolerates the table's absence until then).
