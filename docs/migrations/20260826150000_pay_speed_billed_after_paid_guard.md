# 20260826150000_pay_speed_billed_after_paid_guard.sql — billed-after-paid guard (v2.2337)

A bill date after the bill's own payment is a fabrication (retro-created
paperwork stamped with its creation day); the old clamp scored it +0d. Three
CREATE OR REPLACEs:

- `get_billed_customer_pay_speeds` **v11**: `samples` adds
  `paid_on >= COALESCE(chicago(billed_at), estimated_bill_date)` — such pairs
  never reach medians, receipts, or the measurable count.
- `get_pay_speed_transactions` **v5**: `is_linked_dated` adds the same
  condition (rows fall to the `unlinked` bucket); `gapDays` is NULL when
  `paid_on < billed_on` instead of a lying 0.
- `get_undated_bill_worklist` **v2**: the worklist also includes dated bills
  whose earliest payment precedes the date; payload gains `billedYmd`
  (non-null only for those rows) so the client can name the contradiction.

Same gates as before; anon revoked. CREATE OR REPLACE only, no schema change.
