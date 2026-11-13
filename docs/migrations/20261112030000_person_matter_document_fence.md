# 20261112030000 — person_matter_document_fence (v2.6966)

A matter that stands on a person (`legal_matters.kind = 'person'`, the HR file's Matter view) is a dev's alone. `20261105220000` said so with a restrictive `<table>_person_dev_only` policy on each of the five tables that hung on a matter then. Three days later `20261108210000` made `documents` the one documents table and let it hold a matter's text documents (`matter_id`), with the office's permissive policies beside the devs' (`matter_id IS NOT NULL AND legal_office_can_read()`), and `document_revisions` the same. Neither table got the fence.

**What was open.** The words of a `.md` or `.txt` filed on a person matter, and their prior versions, could be read at the table by a master, an assistant or a controller, and on `documents` changed or added to, while the matter and its Evidence row (`legal_matter_documents`) were closed to them. No screen offered the door: the Evidence row that leads to the words is fenced. The counsel-only mark did not close it either, since `documents_matter_counsel_only_seat` binds only the dev seat's header. Read on prod the day it was found (2026-11-11, policy text and counts only): two such rows, both on a `ZZ Test` person's matter from an earlier walk, none on a real person, no prior versions. Whether anyone outside the devs ever read those two test rows cannot be told from the database.

**What this adds.** Two restrictive policies, `FOR ALL TO authenticated`, in the form of the other five:

- `documents_person_matter_dev_only` on `documents`
- `document_revisions_person_matter_dev_only` on `document_revisions`

each `USING` and `WITH CHECK` `(matter_id IS NULL OR NOT legal_matter_is_person(matter_id) OR is_dev())`. Restrictive, so they only narrow what the permissive policies allow:

- A person's own documents (`person_id` set, `matter_id` null) read and write as before: devs alone, by the permissive policies.
- An account matter's text documents read and write as before for the office roles.
- A person matter's text documents and their history are a dev's on every verb. The office's update of one touches no row, an insert on the matter is refused, and so is moving an account matter's document onto it (`WITH CHECK`).
- The firm's portal (`legal-portal`) and the file index read as the service role and are not bound. `dev_legal_document_write`, `dev_case_search` and `dev_matter_doc_read` are dev-gated already.

No table is created, so no fence call is owed. Idempotent: each policy is made only when it is missing.

Held by `npm run test:pg:person-matter-document-fence` (`supabase/tests/person_matter_document_fence/`, in `scripts/sql-beds.txt`): a dev, a master, an assistant, a controller and an estimator against a person matter's document, an account matter's and a person's own. Before the PR the scenario ran on a local Postgres 15 with the live policies as stand-ins; three mutants each failed it (no fence: the master read the person matter's document; `documents` fenced alone: the master read its prior version; a select-only fence: the assistant's insert landed).

Deploy order: push this migration. No client or function change rides with it.

**Applied** to prod by 2026-11-13: the dev seat's `check_migration_ledger` read 1274 applied, this version among them, against 1274 files in `supabase/migrations/` (read in the docs pass after #7659).
