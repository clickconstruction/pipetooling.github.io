# 20261030080000_bill_answer_on_a_kept_file.sql (2026-10-30, supply-house bill capture, punch list #179)

A bill on a supply house's thread can be answered. `message_attachments.paper_answer` (`filed` · `not_it`) was made for the trade partner's W-9 and certificate offers. The check `message_attachments_answer_to_a_guess` let it be set only on a file the reader guessed was one (`paper IS NOT NULL`).

v2.6095 put a bill offer on any kept PDF or picture on a supply house's line, and a bill has no such guess. So both of its answers were refused with 23514, found on the live walk of 2026-10-30:
- *Not a bill* failed in words.
- *Record this bill*'s `filed`, which `markRecorded` writes after Save, failed quietly. The offer stayed under a bill already on a row. The house's count still dropped it, because the row's `bill_attachment_id` takes it off.

**What it does:**
- It adds `message_attachments_answer_to_an_offer`, `CHECK (paper_answer IS NULL OR paper IS NOT NULL OR bucket_path IS NOT NULL)`. An answer stands on a guessed paper, or on a file we keep a copy of.
- It then drops the old check and validates the new one.
- A link never has a copy (`message_attachments_link_or_file`), so it takes no answer, and neither does a file left in Gmail.
- `message_attachments_stamp_answer` already stamps who and when for any answer, so `message_attachments_answer_stamped` holds.

**Locks:** `lock_timeout` is 3 s. The add is `NOT VALID`, a moment's lock with no scan, and the drop is a moment too. `VALIDATE` reads the rows under a lock that lets reads and writes go on. Every row passes, since the old check was the stricter one. It is idempotent: the add is guarded by name, and the drop is `IF EXISTS`.

**Order:** any time. No client change waits on it. Until the push, the thread's two bill answers keep failing as they do today.
