# 20261005155515_lien_owner_record_requests.sql (2026-10-05, v2.4544)

`lien_owner_record_requests` — the Lien desk's trail of one owner asking for our records on their property: one row per request with the owner (`customer_id`), the saved property (`customer_address_id`), the GC (`gc_customer_id`), the job the window was opened on (`seed_job_id`) and every job the packet covered (`job_ids`), the names as the packet printed them (`owner_name`, `property_address`), and `file` — a jsonb object holding the four checks and the send as the window keeps them (`OwnerRecordsFile` in `src/lib/jobs/ownerRecords.ts`: `request`, `contractChecked`, `acknowledgment`, `sent`). `sent_at` mirrors `file.sent.at` so an open request sorts ahead of a sent one. Shipped with the window *An owner asked for records* (`LienOwnerRecordsModal`).

It is a table of its own, not a key on a notice's `fields`: a draft notice's fields are rewritten whole when it is approved again, and a request trail has to outlive that.

RLS: select / insert / update for the office set that works the Lien desk — `is_dev() OR is_assistant() OR role = 'master_technician'`, as `job_lien_desk_items`; delete is `is_dev()` only (a trail is not the office's to remove). `lien_owner_record_requests_stamp` sets `created_by` / `created_at` / `updated_by` / `updated_at` on the server, whatever the client sends. Ends with `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`.

Apply order: **client first**. `loadOwnerRecords` treats a failed read as "no request yet, saving not ready": the window opens, reads and prints the packet, says *Saving is not ready yet*, and offers no check to file until the push. Additive and idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE`).

Not rehearsed on a throwaway schema (docker was not running on the authoring machine); it follows `20261004145511_job_pay_applications.sql` statement for statement.
