# 20261108090000 — person document archive guard (v2.6693)

`dev_person_doc_write(p jsonb, p_dry_run boolean DEFAULT true)` replaced whole — the v2.6613 body from `20261107040000` with one check added where the `doc_id` row is read (punch list #277, open call 1, `to-dos/hr-named-documents/`): a named document whose `archived_at` is set takes `archive: false` alone and nothing else. `markdown`, `ops`, `counsel_only` or `archive: true` on it are refused with the document's title, the day it was archived and the way back (*bring it back first (archive: false, alone), then edit it*). The app's Documents view draws an archived document read-only and offers Unarchive; the seat's `plan_person_doc` meets the same refusal in its dry run.

- Everything else is as v2.6613 left it: the target (kind, doc_id or title), the three section ops, `expect_updated_at`, the counsel mark and the archive flag with their `changes` entries, the dry run's shape, and `person_documents_archive_revision`, the trigger, untouched.
- No table is created, so no fence is owed. Additive and idempotent (`CREATE OR REPLACE`).
- The old client reads nothing differently (the app's own Archive press sends `archive` alone, which the function took before), so the push may follow the merge at any time.

Deploy order: merge, push this migration, `supabase functions deploy dev-mcp` (server 0.41.0). The coordinating session pushes; this file's **Applied** line is written then.
