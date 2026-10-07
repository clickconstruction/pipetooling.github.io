# 20261008020000_gc_company_record.sql (2026-10-08, v2.4833)

GC mode, the real build, the Board's B1: the company record, from the prototype's model (`to-dos/gc-mode/BOARD_REAL_BUILD.md` → *The tables*, B1, on branch `spike/gc-mode`). A trade partner is a company, not a person. Every other GC lane reads this record: the trade portal, the schedule's trades, Building's RFIs and draws, and New project's set email. Nothing on screen reads or writes it yet. B3 brings the board and Trade partners.

- **`gc_companies`**: a trade partner company (`Partner`).
  - The main contact on the row: `contact_name`, `phone`, `email`, and `contact_gets` (null means every kind).
  - `trades text[]`, at least one, with a GIN index.
  - `address` (where they drive from and their pay application's) and `max_miles`. A point comes from `address_geocodes`, as the Bid Board's map reads one.
  - `license`, `lang` (`en` or `es`) and `portal_opened_on`.
  - The vetting: `vetting_status` (null means known and approved), `vetting_limit` (only on an approval), `vetting_decided_on`, `vetting_decided_by` and `vetting_note`.
- **`gc_company_people`**: the others at a company, with the kinds of email each gets and who added them. `removed_at` keeps someone taken off.
- **`gc_company_vetting_forms`**: one per company, the form a company new to us sends from its portal. The prototype's `references` is `reference_list` here, since `references` is a reserved word.
- **`gc_invites`**: an ask, one company on one trade (`Invite`), unique per trade and company.
  - Its status, the day asked and by whom, and `seen_rev`.
  - The decline: `declined_why`, `decline_reason`, `decline_note` and `declined_on`.
  - The office's own numbers, which the portal never reads: `plugs`, `exclusion_covers` and `taken_alternates`.
- **`gc_quotes`**: a company's quote on an ask (`SubBid`), append only, the newest counts. Its nested parts keep the prototype's shapes as `jsonb`, with a type check each. `source` is office or trade.
- **`gc_company_contacts`**: one call log, append only.
  - `invite_id` null is a note about the company. Set, it is a line of that ask's story, keyed with the company to the ask, so a line is always the ask's own company.
  - `promised_by` is a quote day they gave, only on an ask.
- **`gc_trade_promises`**: a day a company gave us for something other than a quote (`TradePromise`). The kinds are the prototype's `PromiseKind` words. There is one open per company, kind, job and trade, held by a partial unique index.
- **`gc_trade_promise_moves`**: each earlier day a promise moved from, append only.
- **On `gc_projects`**: eight nullable columns. They are `our_bid_sent_on`, `permit_on`, `start_date`, `owner_contract_sent_on` and `started_on`, plus Start anyway's `started_anyway_by`, `started_anyway_reason` and `started_anyway_missing`.
- **Seven foreign keys** to `gc_companies(id)`, on the columns main's GC tables were waiting with:
  - `gc_plan_questions.company_id` and `gc_plan_set_sends.company_id`.
  - `gc_schedule_late_notices.company_id`, `gc_schedule_move_tells.company_id` and `gc_schedule_move_answers.company_id`.
  - `gc_schedule_lookahead_marks.marked_by_company_id` and `gc_schedule_crew_counts.company_id`.

  Each is `ON DELETE RESTRICT`, so a company with records on a job is not deleted out from under them. Each is added `NOT VALID` and then validated in its own statement.

**On prod when this was written** (2026-10-07, read only through the management API's query endpoint): every one of the seven columns was empty or null. `gc_plan_questions` has 1 row (the test question) with `company_id` null, and the other six tables have no rows. So the validation has nothing to check. The `NOT VALID` step is there so a row that appears before the push fails only the second statement.

**Seven office functions**, `SECURITY INVOKER` so RLS decides who may, granted to `authenticated` and revoked from `anon`:

- `gc_add_company(jsonb)`: the company with its main contact and people, in one transaction. It comes in not vetted unless `known` is true, and refuses a blank name or no trade.
- `gc_vet_company(company, status, limit, note)`: approve (with an optional limit on one award) or decline.
- `gc_record_promise(jsonb)`: writes a new promise, or moves the open one for the same thing and keeps its old day. The same day twice changes nothing.
- `gc_keep_promise(promise, on)`: *It came*.
- `gc_keep_promises(company, kind, project, package, on)`: the thing came, so the open promise for it is kept, or nothing when none is open. Building's writes and the trade portal's verbs call it inside their own transactions, so its signature is a seam. It is also granted to `service_role`, as is `gc_record_promise`.
- `gc_invite_companies(package, companies[])`: one ask per company, skipping one already asked. It refuses a lost bid, our own trade, an empty list and a company not on record. It sends nothing.
- `gc_office_decline(ask, why, reason, note)`: will not or cannot, a reason, and their words when the reason is something else.

**Append only**, by privileges: `gc_company_contacts`, `gc_quotes` and `gc_trade_promise_moves`. `authenticated` has no UPDATE, DELETE or TRUNCATE on them. A row still goes with its company or ask by cascade.

RLS: each table has one `FOR ALL` policy for `(SELECT public.is_dev())`, dev only while it is built (decision 8). The board's door swaps each to the GC office audience. `anon` has no privilege on them. The trade's own writes are the Portal lane's `SECURITY DEFINER` functions, granted to `service_role` only, so no column here needs `auth.uid()`.

It ends with `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`.

Apply order: after every GC migration on main, whose tables these reference. It must go before Building's U1 and anything else keyed to `gc_companies` (`BOARD_REAL_BUILD.md`). It is idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP ... IF EXISTS` before each policy and key, `CREATE OR REPLACE`). Run twice on a local Postgres (PGlite) over main's four GC table migrations, it applied both times. Each foreign key takes a short lock on its table and on `gc_companies`. The `ALTER TABLE gc_projects` lines take a short lock on `gc_projects`, which New project reads. In a busy moment the push stops at the 3-second lock timeout; run it again later.

## Checked before the push

On a local Postgres (PGlite 0.3.6), with main's four GC table migrations applied first and stubs for `users`, `projects`, `customers`, `bids`, `email_send_log`, `auth.uid()` and the house functions:

- `gc_add_company` made a company not vetted, in Spanish, with a second person who gets pay. It refused a blank name, no trade, a kind of email not in the four, and a call with nobody signed in.
- `gc_vet_company` approved up to $50,000 with who decided. It refused a limit on a decline and a status not in the two.
- `gc_record_promise` wrote a promise, did nothing on the same day again, and moved it, keeping the old day. It refused a kind not in the ten. Once the promise was kept, the next one for the same thing was new.
- `gc_keep_promises` kept nothing for the wrong job, kept the matching one, then nothing on a second call.
- `gc_invite_companies` made one ask, then nothing on a second call. It refused our own trade, an empty list and an unknown company.
- A contact line with a quote day and no ask was refused, and so was an ask's line under another company. A quote whose `includes` is not an object was refused.
- `gc_office_decline` refused "other" with no words, then wrote the ask's decline.
- A question naming an unknown company was refused by the new key, and deleting a company that a question names was refused.

## Verify after the push

1. **Each table is there, with RLS on, its own policy and the house rules.** Run it read only.

   ```sql
   BEGIN READ ONLY;
   SELECT c.relname AS table_name,
          c.relrowsecurity AS rls_on,
          count(*) FILTER (WHERE p.policyname = c.relname || '_dev') AS dev_policy,
          count(*) FILTER (WHERE p.policyname LIKE 'read_only_users_cannot_%' AND p.permissive = 'RESTRICTIVE') AS read_only_blocks,
          count(*) FILTER (WHERE p.policyname LIKE 'digital_twin_write_fence_%') AS twin_fences,
          (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid = c.oid AND t.tgname = 'read_only_block_stmt') AS stmt_trigger
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
   LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = c.relname
   WHERE c.relname IN ('gc_companies', 'gc_company_people', 'gc_company_vetting_forms', 'gc_invites',
     'gc_quotes', 'gc_company_contacts', 'gc_trade_promises', 'gc_trade_promise_moves')
   GROUP BY c.oid, c.relname, c.relrowsecurity
   ORDER BY 1;
   ROLLBACK;
   ```

   Expect eight rows, each with `rls_on` true, `dev_policy` 1, `read_only_blocks` 3, `twin_fences` 3 and `stmt_trigger` 1.

2. **The seven keys are there and validated.**

   ```sql
   SELECT conrelid::regclass AS on_table, conname, convalidated
   FROM pg_constraint WHERE conname LIKE 'gc\_%\_company\_fkey' AND confrelid = 'public.gc_companies'::regclass
   ORDER BY 1;
   ```

   Expect seven rows, each `convalidated` true. `gc_company_contacts_invite_fkey` is keyed to `gc_invites` and is not among them.

3. **A read-only user's insert is refused.** This runs in a transaction that rolls back. The statement trigger refuses before any row is looked at.

   ```sql
   BEGIN;
   SELECT set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true)
     FROM public.users WHERE read_only LIMIT 1;
   SET LOCAL ROLE authenticated;
   INSERT INTO public.gc_companies (name, trades) VALUES ('A check, rolled back', ARRAY['Concrete']);
   ROLLBACK;
   ```

   Expect `ERROR: Read-only (training) mode: changes are blocked.` If the first `SELECT` returns no row, no user is in training mode yet and this check waits for one.

4. **What is never changed stays that way, even for a dev.** Run each line in its own transaction as a dev who is not read-only (step 3's opening with `WHERE role = 'dev' AND NOT read_only`), then `ROLLBACK`.
   - `DELETE FROM public.gc_company_contacts;` gives `ERROR: permission denied for table gc_company_contacts`.
   - `UPDATE public.gc_quotes SET note = note;` gives `permission denied for table gc_quotes`.
   - `DELETE FROM public.gc_trade_promise_moves;` gives `permission denied`.
   - `UPDATE public.gc_trade_promises SET what = what;` gives `UPDATE 0`: a promise moves and is kept.

5. **The functions refuse what they should.** Do this from the app, signed in as a dev, through the page's `supabase` client.
   - `rpc('gc_add_company', { company: { name: ' ', trades: ['Concrete'] } })` gives *Give the company a name.*
   - `rpc('gc_invite_companies', { p_package_id: <a trade id that matches nothing>, p_company_ids: [] })` gives *No trade with that id.*
   - `rpc('gc_vet_company', { p_company_id: <an id that matches nothing>, p_status: 'approved' })` gives *No company with that id.*

6. **Nobody signed out reaches them.** With the anon key, `select` from `gc_companies` gets 401 `permission denied for table gc_companies`.

Then `npm run check:migration-drift`, and the types PR (`npm run gen-types:linked`).

**The plan's own check** (BOARD_REAL_BUILD.md, B1) writes test rows on prod, so it waits for the owner's word on test rows (call 13). If he says yes, it runs from the app as a dev:
- `gc_add_company` makes "GC test trade company, delete me" with a second person who gets pay.
- `gc_vet_company` approves it up to $50,000.
- A promise moved once keeps its first day.
- `gc_invite_companies` on the test project's Concrete asks it once, and a second call adds nothing.

## Rollback

Nothing on screen reads these tables yet, and other lanes' tables will key to `gc_companies` once they land. Going back before they do is a new migration that:

1. Drops the seven `*_company_fkey` constraints.
2. Drops the seven functions.
3. Drops the tables in this order: `gc_trade_promise_moves`, `gc_trade_promises`, `gc_company_contacts`, `gc_quotes`, `gc_invites`, `gc_company_vetting_forms`, `gc_company_people`, `gc_companies`.
4. Drops the eight new `gc_projects` columns.

## Status

Written 2026-10-07 for the Board's B1.

Applied to prod on 2026-10-07 by the lead with `supabase db push` from a clean checkout of main, first in the batch, before Building's U1. `npm run check:migration-drift` read 782 local and 782 remote. The types are in #4876. What the verify steps said:

- **Step 1**, through the management API's query endpoint, read only: all eight tables read `rls_on` true, `dev_policy` 1, `read_only_blocks` 3, `twin_fences` 3 and `stmt_trigger` 1. `anon` has no SELECT on any of them.
- **Step 2**, through the same endpoint: all seven company keys read `convalidated` true, on `gc_plan_questions`, `gc_plan_set_sends`, `gc_schedule_late_notices`, `gc_schedule_move_tells`, `gc_schedule_move_answers`, `gc_schedule_lookahead_marks` and `gc_schedule_crew_counts`. All eight tables were empty.
- **Step 3**, through the same endpoint, in a transaction that never committed: the training-mode user's insert into `gc_companies` got `Read-only (training) mode: changes are blocked.`
- **Step 4**, through the same endpoint, as a dev who is not read-only, each in a transaction that rolled back:
  - A DELETE on `gc_company_contacts`, an UPDATE on `gc_quotes` and a DELETE on `gc_trade_promise_moves` were each refused with `permission denied for table …`.
  - `UPDATE gc_trade_promises SET what = what` went through on 0 rows.
- **Step 5**, from the app (the dev server on this branch, signed in as the dev account, `read_only` false) through the page's `supabase` client:
  - `gc_add_company` with a blank name answered *Give the company a name.*
  - `gc_invite_companies` with a trade id that matches nothing answered *No trade with that id.*
  - `gc_vet_company` with a company id that matches nothing answered *No company with that id.*
  - `gc_companies` still read 0 rows after the three calls.
- **Step 6**: a signed-out read of `gc_companies` with the anon key got `permission denied for table gc_companies`.

The plan's own check, which writes "GC test trade company, delete me" and its ask and promise, waits on the owner's word on test rows (call 13).
