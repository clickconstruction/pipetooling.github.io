# 20261012180000_change_orders_from_messages.sql (2026-10-12, v2.5280)

Messages, cut 4b: a change order started from a customer's message (`to-dos/gc-mode/messages/BUILD_PLAN.md` on branch
`spike/gc-mode`, *A change order from a message*; decision 11 taken as the split: anyone in the office drafts it, and the
money team sends it). The kernel is `src/lib/changeOrders/fromMessage.ts` (v2.5272). It needs the spine's `contacts`
and `messages` (`20261012010000_messages_spine.sql`, v2.5258), so it lands after that file.

## What it does

1. **Two columns on `gc_change_orders`**:
   - `signer_contact_id`: the customer contact who signs it. It references `contacts`, set null on delete.
   - `source_message_id`: the message it started from. It references `messages`, set null on delete.
   - A partial unique index keeps it to one change order a message, which is what its chip names. An index on the signer.
   - `gc_change_orders_keep_what_went` is unchanged. These are our record of who and where from, not what went to the
     customer, and freezing them would also block a message's delete through the foreign key's set null.
2. **`gc_change_orders_office` gains the two at its end**, so the office draws the message's chip ("became CO 2") and
   the order's line back to the message. It is still never `cost`, `price` or `pct_done`. Its grants are restated
   (every verb revoked, `SELECT` back to `authenticated`), and Owner Billing's bed pins the new fourteen columns.
3. **`gc_draft_change_order_from_message(p_message_id, p_draft)`**, the office's draft. It is `SECURITY DEFINER`, because
   the table stays the money team's. Widening its insert policy alone could not work: `gc_draft_change_order` numbers
   the next order from the rows its caller sees and returns the new row, and the office sees none.
   - It holds `gc_office_team()` in its body. In words it refuses a training account, a digital twin, and anyone
     outside the office.
   - It refuses a message that is not there, one that is not a customer's ("This message is with a trade partner."),
     one with no job, and a job still bidding or lost.
   - A message that became a change order already is refused ("This message became change order 2 already.").
   - It refuses what `gc_draft_change_order` refuses in its own words: no description, a reason not known, a cost,
     price or days that is not a number, days below zero, a trade of another job.
   - It numbers the order under the job's lock and keeps the signer and the source. It returns the id and the number
     only, never a money column.
   - Cost and price may be 0: the money team prices the draft, and `gc_send_change_order` refuses one with no price
     and no days.
4. **`gc_change_order_sends`**, each send of a change order to sign, in `gc_owner_contract_sends`' shape with the
   change order in place of the price by line:
   - what it keeps: the project, its customer, `first`, `sent_on`, `sign_by`, the line, the file's path, name and
     SHA-256, `sent_by`, and once signed, the signer's day, printed name, signature path, consent time, IP and user agent;
   - the same named CHECKs: sign-by on or after the day it went, a line of 500 characters at most, a file named, a
     64-hex fingerprint, a signature whole;
   - the money team's, through one policy: signed in, read it and insert the send's own columns; no update or delete;
     the signer's fields are the service role's;
   - the three fences at the end.
5. **The bucket `gc-change-orders`**: private, with files under `<project id>/`. The money team reads and adds one; a
   training account or a twin adds none. There is no update or delete policy.
6. **`gc_send_change_order_to_sign(p_id, p_sign_by, p_note, p_file_path, p_file_name, p_file_sha256)`**, the money
   team's send. It is `SECURITY INVOKER`, so RLS decides.
   - In words it refuses a training account, a twin, and anyone off the money team.
   - It refuses a change order that is not there or is answered already.
   - It refuses a sign-by day before today, a line over 500 characters, a file missing, not this job's, not
     fingerprinted or not uploaded.
   - The first send marks a draft sent through `gc_send_change_order`; later ones are reminders (`first` false). It
     returns the send's id.

`SET lock_timeout = '3s'`. Adding the two columns takes `gc_change_orders`' lock for a moment, and the foreign keys a
share lock on `contacts` and `messages`. Every statement is idempotent: a second run changes nothing, which the bed
checks.

## The bed

`scripts/pgtest-gc-change-orders-from-messages.sh` plays `supabase/tests/gc_change_orders_from_messages/20_scenario.sql`
after every migration, and again after this file a second time. Rosa (an assistant) drafts change order 2 from Priya's
text asking for a sink in exam 3, and Maria (the controller) prices it and sends it to sign. The bed checks:
- Rosa reads it through the office's view only, with the text and the signer, and never a money column.
- Each refusal comes back in words: a second order from the same text, a text with no job, a job bidding or lost, a
  trade partner's text, no description, another job's trade, a message not there.
- Rosa neither sends nor writes a send.
- A superintendent, a training account and a twin are refused.
- Maria finds the draft unpriced, and its send is refused with "nothing to sign". Maria prices it.
- A missing file, another job's file and a past sign-by day are refused. Then Maria sends it, and a reminder after.
- Nobody changes or deletes a send, and Rosa reads none.

It runs on GitHub's runners through `scripts/sql-beds.txt`. The office Mac has no Docker.

## Verify after the push

1. **The columns, the view and the table.**

   ```sql
   SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'gc_change_orders_office';
   SELECT count(*) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'gc_change_orders' AND column_name IN ('signer_contact_id', 'source_message_id');
   SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'gc_change_order_sends' GROUP BY grantee ORDER BY grantee;
   ```

   Expect:
   - the view's fourteen columns, ending in `signer_contact_id,source_message_id`;
   - `2`;
   - `authenticated` with `INSERT,SELECT` and no `anon` row (the owner's and `service_role`'s rows as Supabase makes them).
2. **The functions' rights.** `SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('gc_draft_change_order_from_message', 'gc_send_change_order_to_sign');`
   Expect `true` for the draft and `false` for the send.
3. `npm run check:migration-drift` is clean.

## Rollback

```sql
DROP FUNCTION IF EXISTS public.gc_send_change_order_to_sign(uuid, date, text, text, text, text);
DROP FUNCTION IF EXISTS public.gc_draft_change_order_from_message(uuid, jsonb);
DROP POLICY IF EXISTS gc_change_orders_files_insert ON storage.objects;
DROP POLICY IF EXISTS gc_change_orders_files_select ON storage.objects;
DROP TABLE IF EXISTS public.gc_change_order_sends;
-- The view first, back to its twelve columns, then the two columns.
CREATE OR REPLACE VIEW public.gc_change_orders_office WITH (security_barrier = true) AS
  SELECT c.id, c.project_id, c.number, c.description, c.reason, c.schedule_words, c.package_id,
         c.status, c.sent_on, c.answered_on, c.days, c.days_on_chart
  FROM public.gc_change_orders c WHERE (SELECT public.gc_office_team());
```

A view's columns cannot be dropped by `CREATE OR REPLACE`, so a full rollback drops the view and recreates it from
`20261010081000`. It then drops `gc_change_orders.signer_contact_id` and `source_message_id`. The bucket stays; it is
empty until the window ships.

## Status

A draft stacked on the spine's PR. Not pushed: `supabase db push` only after it is on `main`.
