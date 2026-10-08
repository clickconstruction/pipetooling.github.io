# 20261008110000_gc_change_order_rpcs.sql (2026-10-08, v2.4915)

GC mode, the real build, Owner Billing's O3: change orders to the customer get their writes. O1
(`20261008010000_gc_owner_billing_tables`) made `gc_change_orders`; this adds four RPCs and a
trigger, as approved in `to-dos/gc-mode/mockups/owner-billing-o3.md` on branch `spike/gc-mode` (the
SQL is that mockup's, byte for byte). Nothing calls them yet: the Change orders window is O3-ui, after
this migration's types.

**The trigger, `gc_change_orders_keep_what_went`** (BEFORE UPDATE OR DELETE): what went to the
customer keeps what it said.
- A change order keeps its project and its number.
- It moves draft → sent → signed or declined, never back.
- Once sent, only its percent done changes: its description, reason, schedule words, trade, cost,
  price, days, moves, set and sent day stay.
- Once answered, the answer stays.
- Only a draft deletes. A project's delete still reaches the others by cascade, because a nested
  trigger runs at `pg_trigger_depth() > 1`.

**The RPCs**, all `SECURITY INVOKER` (RLS decides who may: O1's dev-only policies) and for
`authenticated` only:
- **`gc_draft_change_order(p_project_id uuid, p_draft jsonb)`** (the prototype's
  `draftChangeOrder`): the next number under a lock on the project's row. It refuses, in words, a
  job still bidding or lost, a blank description, an unknown reason, a cost, price or days that is
  not a number, a zero cost (a credit is below zero), days below zero, and a trade or a set of
  another project. Cost and price are rounded to dollars. Empty schedule words read `+N days` or
  `none`.
- **`gc_draft_time_extension(p_project_id, p_description, p_reason, p_days, p_move_ids uuid[])`**
  (`draftTimeExtension`, G-141): no price, its days from the named schedule moves. Each move must be
  this job's and not undone, and none asked for already by a change order that is not declined.
- **`gc_send_change_order(p_id uuid, p_on date)`** (`sendChangeOrder`): a draft only. One with no
  price and no days has nothing to sign.
- **`gc_answer_change_order(p_id uuid, p_signed boolean, p_on date, p_how text DEFAULT 'office')`**
  (`ownerSignChangeOrder`, `ownerDeclineChangeOrder`): a sent one only, not before the day it went,
  recorded by the office or (O7b) pressed in the customer's portal.

Editing a draft and setting a signed one's percent done are plain updates under RLS.

It is idempotent (`CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`). Before review it ran twice on a
local Postgres 15 after O1, with stand-ins for the tables it names, and every rule was tried (the list
is in the mockup). **Locks:** creating the trigger takes a short lock on `gc_change_orders`, a dev-only
table with no rows on prod; the functions take none. It can go in any batch.

## Verify after the push

1. **The four functions and the trigger are there, and anon cannot call them.**

   ```sql
   SELECT proname FROM pg_proc WHERE proname IN ('gc_draft_change_order', 'gc_draft_time_extension', 'gc_send_change_order', 'gc_answer_change_order') ORDER BY 1;
   SELECT tgname FROM pg_trigger WHERE tgname = 'gc_change_orders_keep_what_went';
   SELECT has_function_privilege('anon', 'public.gc_draft_change_order(uuid, jsonb)', 'EXECUTE');
   ```

   Expect four names, one trigger, and `false`.

2. **A training-mode user's draft writes nothing.** Use O1's step 3 opening, then
   `SELECT public.gc_draft_change_order(gen_random_uuid(), '{}');`, then `ROLLBACK`. Expect either
   the read-only block's words or "That GC project is not there." (the row lock reads first). Either
   way, nothing is written.

3. **A dev's whole walk, rolled back, on the test project** (`ef8905d1-039a-4cbc-9d69-9468cfea50e0`).
   Inside one transaction, as a dev:
   - set the project's `stage` to `building`, unless a check already left it there;
   - draft one on its first trade, which gives number 1;
   - send it on today;
   - answer it signed on today;
   - set `pct_done = 40`;
   - `UPDATE … SET price = 1`, which is refused with "went to the customer";
   - `DELETE` it, which is refused;
   - `ROLLBACK`.

4. **The schedule's moves still take a change order's key.** Inside a rolled-back transaction, a
   signed change order's id written to a move's `change_order_id` goes through. A stranger id is
   refused by O1's key.

5. **Nobody signed out reaches them.**
   `BEGIN; SET LOCAL ROLE anon; SELECT public.gc_send_change_order(gen_random_uuid(), current_date); ROLLBACK;`
   gives `permission denied for function gc_send_change_order`.

Then `npm run check:migration-drift`, and the types PR (`npm run gen-types:linked`).

## Rollback

Nothing calls these yet. Going back is a new migration that drops the trigger and its function, then
the four RPCs, with `DROP … IF EXISTS`.

## Status

Written 2026-10-08 for Owner Billing's O3; not applied. The lead pushes it once its PR is on
`main`, and records here what steps 1 to 5 said.
