# 20261014020000_contact_for_customer.sql (2026-10-13, v2.5437)

Messages, residential R2 PR 3a (customer communication helper 9, directed by the customer communication lead). The door a customer's name opens their thread through. The plan is `to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` → R2 on spike/gc-mode. The button that presses it comes with R2 PR 3b, so nothing changes for anyone until then.

## Why

The spine's seed (`20261012010000_messages_spine.sql`) made a contact only for the customers on GC projects, and nobody signed in may insert a contact. So most of our own customers have no contact, and a press on their name had no thread to open.

## What it does

1. **`contact_for_customer(customer)`** answers the customer's own contact: the one on their `customers` row with no name, as the seed and Who is this? point it.
   - With none there, it makes one, kind `customer`, with the number and the address the customer's row keeps in `contact_info`. A value that is neither is left out, as the seed leaves it. The people at the customer keep their own contacts, and none is made for them here.
   - Two presses at once make one contact: the second meets the spine's one-contact index and reads the first's.
   - A number a stranger already texted from stays on that stranger's contact. Who is this? folds it into the customer's, so the office decides, never the function.
   - It is `SECURITY DEFINER`, since the office cannot insert a contact. So it holds the office team, `gc_office_team()`, in its body. It refuses in words anyone signed out (*Sign in to open a customer's messages.*), anyone off the office team (*Only the office opens a customer's messages.*) and a customer not there (*That customer is not there.*).
   - Finding a contact is a read, which a training account and a digital twin may do. Making one is a write, which the house fences would refuse them and a definer passes. So the function refuses them in words: *A training account cannot start a customer's thread.* and *A digital twin cannot start a customer's thread.*
   - `anon` cannot run it. The signed in and the service role can.
2. **`contacts_keep_thread_on_customer_delete`**, a `BEFORE DELETE` trigger on `customers`. The screens delete a customer outright (Edit customer, the customer's page), and `contacts.customer_id` is `ON DELETE RESTRICT`. Without it, a customer with a contact could no longer be deleted.
   - Before the delete, the customer's contacts become numbers nobody has named, kind `unknown`, that keep the name, as the spine does for a roster person. Their lines stay.
   - The people at the customer go with it by cascade, so their contacts do the same first. The spine's trigger on `customer_contact_persons` then finds none to move onto a customer that is going.
   - A merge moves the contacts to the survivor before its delete, so the trigger finds none there.
   - A function of its own, so the spine's `contacts_keep_thread_on_delete` is not redefined here. R0's SQL (`20261013180000`, #5593) redefines that one.

No new table, so no house calls.

## Checked before the push

The SQL bed `contact-for-customer` (`npm run test:pg:contact-for-customer`) runs every migration on Supabase Postgres 17, then this one a second time, which must change nothing, then the scenario. Docker does not run on the office Mac, so it runs in the SQL beds workflow once the PR is ready.

- A superintendent is refused in words, and anyone signed out cannot run it. A customer not there is refused.
- A training account and a twin are refused before the first write, and nothing is made.
- Rosa makes Dana's own contact with her number and her address as their keys. Mark, at Dana's house, keeps his own.
- A second press, by a dev, finds the same contact: still one contact and two channels.
- Once it is there, the training account and the twin find it.
- Joe, with nothing on file, gets a contact with no channel. The architect's contact the seed made is found as it is, kind and all.
- A dev deletes Dana. Her contact keeps her name, her number and her line as a number nobody has named. Mark's keeps his name.

## Verify after the push

```sql
-- 1. The function: signed in only, and a definer.
SELECT p.proname, p.prosecdef, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'contact_for_customer';
-- expect: true, true, false

-- 2. The trigger on customers.
SELECT tgname, pg_get_triggerdef(oid) LIKE '%BEFORE DELETE%' AS before_delete FROM pg_trigger
WHERE tgrelid = 'public.customers'::regclass AND tgname = 'contacts_keep_thread';
-- expect: one row, true

-- 3. Nothing made yet: the button comes with R2 PR 3b.
SELECT count(*) FROM public.contacts WHERE kind = 'customer' AND customer_id IS NOT NULL AND name IS NULL;
-- expect: the same count as before the push
```

## Rollback

```sql
DROP TRIGGER IF EXISTS contacts_keep_thread ON public.customers;
DROP FUNCTION IF EXISTS public.contacts_keep_thread_on_customer_delete();
DROP FUNCTION IF EXISTS public.contact_for_customer(uuid);
```

The contacts the function made stay. They are rows of the spine like any other.
