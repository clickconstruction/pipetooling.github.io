# 20260924050000_day_book_followup_rule.sql (2026-09-24, v2.3800)

**Purpose**: the Day book estimating strip's "No follow-up in 7 days" counts a follow-up the way the office writes one — any entry on the bid from the first send through seven days after, no contact method required.

**Changes**
- `public.day_book_payload_for(uuid, date, date, uuid)` re-created: the body of `20260922190000_day_book_queue_snapshots.sql` with one predicate changed in the `strip_sent` CTE's `unfollowed_n`: `NOT EXISTS (… bids_submission_entries f WHERE f.bid_id = s.bid_id AND (f.occurred_at AT TIME ZONE 'America/Chicago')::date BETWEEN fs.first_sent AND fs.first_sent + 7 AND COALESCE(f.notes, '') NOT LIKE 'Win/Loss changed from %')`. Before: `f.contact_method IS NOT NULL AND f.occurred_at::date <= fs.first_sent + 7` (no lower bound, and a method required).
- The two doors (`get_day_book_payload`, `get_day_book_payload_for_user`) and their grants are untouched.

**Idempotent**: `CREATE OR REPLACE`. No new table, so no read-only block calls. **Order**: after `20260922190000`.
