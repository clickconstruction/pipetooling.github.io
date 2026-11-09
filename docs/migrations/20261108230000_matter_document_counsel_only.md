# 20261108230000_matter_document_counsel_only.sql (2026-11-08, v2.6720)

Counsel-only on a matter document, punch list #288 PR 2 ([v2.6720](../recent-features/v2.6720.md)), the HR file's v2.6554 mark brought to the matter.

- **`legal_matter_documents.counsel_only boolean NOT NULL DEFAULT false`**: for counsel alone — set on filing or from the row's menu.
- **The seat refused**: `legal_matter_documents_counsel_only_seat` (restrictive, `NOT (counsel_only AND request_is_dev_seat())`) and `documents_matter_counsel_only_seat` (restrictive on `documents`: a matter row whose Evidence row is counsel-only, through the definer `matter_text_document_is_counsel_only(id)`), so the seat sees neither the row nor the words. `hr_agent` has no policy on either table and needs none.
- **`matter_counsel_only_count(p_matter_id)`**: how many live counsel-only documents the matter holds — a count for a dev or an office role, 0 otherwise — so a read can name the hold.
- **`dev_legal_document_write`** replaced (from `20261108210000`): `p.counsel_only` on the Evidence row and on the `documents` row when the paper is text; the dry run names it.
- **`dev_case_search`** replaced: the body #285's `20261108220000` leaves (the `file` source, the three trailing record columns) with v2.6716's sectioned text-document union, `AND (f.source <> 'matter_document' OR d.text_document_id IS NULL)` on the file branch so a `.md`/`.txt` is not found twice, the named documents from `documents`, and the two `matter_document` branches and a matter document's file hit marked `counsel_only` from the row. The highest stamp of the three, so the body prod keeps.

Additive and idempotent; no `CREATE TABLE`, so no fence is owed.

## Order

After `20261108210000` (v2.6716, the rename and `text_document_id`) and `20261108220000` (#285 PR 2, `file_index.source` from its PR 1 `20261108200000`): the search body names their columns. Push, then `supabase functions deploy legal-portal` and `supabase functions deploy dev-mcp`.
