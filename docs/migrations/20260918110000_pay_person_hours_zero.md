# 20260918110000_pay_person_hours_zero — set_person_hours clears by setting to 0, and raises when rows survive (v2.3585)

**What**: `CREATE OR REPLACE` of `set_person_hours(p_person, p_from, p_to, p_hours, p_reason)`. With `p_hours = 0` it now sets every existing row in the range to 0 hours (the Hours grid's own convention — nothing is deleted) and raises if any row in the range still carries hours afterwards; with `p_hours > 0` it upserts every date and raises if fewer days took the value than were set. The audit payload carries `existing`, `zeroed`, `set`, before and after. Idempotent on a second clear.

**Why**: `people_hours` has no DELETE policy for payroll users (only "team leads … for members"), so the v2.3584 delete matched nothing under RLS and reported `removed 0` on Mike Z's cleanup (2026-09-18). UPDATE is allowed to pay-access users, which is how the grid clears a day. See `docs/recent-features/v2.3585.md`.

**Verified**: `30_person_admin.sql` — three rows zeroed and kept, no hours left, a second clear is a no-op, eight audit rows.

**Idempotent**: `CREATE OR REPLACE FUNCTION`. No data touched.
