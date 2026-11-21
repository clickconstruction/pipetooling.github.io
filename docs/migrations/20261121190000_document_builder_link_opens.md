# 20261121190000_document_builder_link_opens.sql (2026-11-21, v2.8187)

The Document builder: who opened a link, punch list #404. Database only: the function that writes a row, and the desk that reads them, come in the PR after the push. Taunya asked for it on 2026-11-21.

- **`document_builder_link_opens`**: one row each time a link is opened. Until now a link kept a count, the first open and the last (`document_builder_links.open_count`, `opened_at`, `last_opened_at`). Those stay, and still count only someone outside.
- **Who it was.** `viewer` is `outside`, `staff` or `preview`, as every public page of the app tells them apart. `user_id` is the account when the person was signed in to the app.
- **Someone with no account.** `client_ip` is the address the request came from. `user_agent` is the browser's own name for itself. `device` is what the page reports: its language, time zone, screen and platform. It is a small object, held to 2,000 characters by a check. It is never a script-made fingerprint.
- **A person with an account is kept by the account alone.** The function leaves the address, the browser and the device empty for them.
- **`revision`** is the revision the open was shown.
- **Who reads and writes.** Only the edge function writes, with the service role. A dev reads (`is_dev()`). Nobody outside reads it, and no client has insert, update or delete.
- A link that is deleted takes its opens with it (`ON DELETE CASCADE`). An account that is deleted leaves the open and empties its `user_id`.
- No row is ever cleared by a job. How long an address is kept is Taunya's call and is not set here.
- Additive and idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and a policy dropped before it is made. It opens with the lock timeout and closes with the four fences.

Checked before the push: section 3b of `supabase/tests/document_builder_sheets/20_scenario.sql`, in the bed `document-builder-sheets`, with the fences in section 0, the readers in sections 5, 6 and 8, and the cascade in section 9. The bed's script applies this file a second time.

Apply: `supabase db push` after the merge. Nothing reads or writes the table until the function that follows is deployed.
