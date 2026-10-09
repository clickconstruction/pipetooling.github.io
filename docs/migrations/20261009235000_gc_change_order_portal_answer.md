# 20261009235000_gc_change_order_portal_answer.sql

GC mode, Owner Billing's O7c: the customer answers a change order in their portal (v2.5025). The plan is `to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md` → O7's third PR, and the SQL is `to-dos/gc-mode/mockups/owner-billing-o7.md`'s *O7c's SQL as built*, word for word, on branch `spike/gc-mode` as merged by the lead on 2026-10-09. It restates O3's `gc_answer_change_order` (`20261008110000`) and adds a column to O1's `gc_change_orders` (`20261008010000`).

**Why:** O3's function refused every call with no signed-in user, so the portal's press, which `submit-portal-request` makes as the service role, could not land. A signed-in user could also say `how = 'portal'`.

## What it does

1. **`gc_change_orders.declined_note`**, text, empty to start, at most 300 characters on one line (`gc_change_orders_declined_note_short`): the customer's reason for declining, never required (the lead's call, 2026-10-09).
2. **`gc_answer_change_order(p_id, p_signed, p_on, p_how = 'office', p_note = '')`**, SECURITY INVOKER. O3's four-argument function is dropped first, since a new parameter changes the signature. The new one:
   - takes O7a's acceptance gate first: `portal` runs only as the service role, `office` needs a sign-in, and nothing else is a way;
   - keeps O3's checks and words as they were: the change order there, waiting on the customer, a day given, not before it went;
   - refuses a reason over a line (*Keep the reason to one short line.*);
   - keeps the reason, trimmed, on a decline only; a signature clears it.
   The office's three-argument call still works. Grants: the signed in and the service role, never anon.

`gc_record_acceptance` (O7a) already has the gate, so the portal's acceptance calls it as it is.

## The lock note

`ALTER TABLE … ADD COLUMN` with a constant default and the guarded `ADD CONSTRAINT` take a short lock on `gc_change_orders`, a small table only the money team's windows read. `DROP FUNCTION` and `CREATE FUNCTION` take no table lock. `SET lock_timeout = '3s';` heads it as every migration's does.

## Verify after the push

1. **One function, five arguments.** `SELECT count(*), min(pronargs) FROM pg_proc WHERE proname = 'gc_answer_change_order';` gives `1, 5`, and `has_function_privilege('anon', 'public.gc_answer_change_order(uuid, boolean, date, text, text)', 'EXECUTE')` is `false`.
2. **The column.** `SELECT count(*) FROM gc_change_orders WHERE declined_note <> '';` gives `0`.
3. **The functions**: the lead deploys `customer-portal` and `submit-portal-request` after the push. Nothing presses a change order or an acceptance on prod for a check without Grace's yes.

## The SQL beds

`scripts/pgtest-gc-owner-billing.sh` re-applies this migration with Owner Billing's others; `20_scenario.sql`'s four-argument calls pass on it unchanged. `60_portal_answers.sql` checks:
- one function of five arguments with its grants, and the column with its check;
- a signed-in user saying portal, a way that is neither, a reason on two lines and one too long, each refused with nothing written;
- the office signing by the old three arguments, and declining with a blank reason;
- an estimator stopped;
- the service role saying office refused; their portal's decline keeping its reason, trimmed; a second answer refused.
