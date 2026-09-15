# 20260915140258_lien_rule_needs_first_notice.sql (2026-09-15, v2.3469)

`CREATE OR REPLACE` of `public.job_lien_desk_items_guard()` (the Lien desk approval trigger from `20260914180000_lien_desk.sql`). One new branch: an approval with `approval_mode = 'rule'` on a `notice_53_056` item is refused with `23514` unless a non-voided `job_lien_filings` row of kind `notice_53_056` already exists on some job with the same `gc_customer_id` as the item's job — a GC's first notice always comes to the leader; the standing rule starts with the second. Leader and spoken-word branches unchanged. Function comment updated.

Ships with the v2.3469 client, which routes the first notice to the leader in the kernel; deploy order does not matter (the old client's "send" path would now be refused by the trigger with a readable message). No new table, so no read-only appliers.
