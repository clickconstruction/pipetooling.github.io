# 20261010006000_gc_back_charges_change_requests.sql (2026-10-09, v2.5038)

GC mode, the real build, the trade partner portal's P4a (`to-dos/gc-mode/PORTAL_REAL_BUILD.md` → *The PRs, in order*, item 7; plan `to-dos/gc-mode/mockups/portal-p4.md`, on branch `spike/gc-mode`). It adds the portal's two records, each on the work a trade signed for (B6-a's `gc_sows`), and the SQL that writes them. Nothing calls them yet: Building's office screen, Owner Billing's two verbs (O3b) and P4b's two portal kinds will.

It is idempotent and additive. It needs B6-a (`20261009140000_gc_award_and_sow`) applied first, for `gc_sows`.

## What it does

1. **`gc_back_charges`**, a charge to a trade (`BackCharge`): cleanup, damage, or work we had to finish for it.
   - It hangs on the trade's statement of work (`sow_id`), with the project, the trade and the company on it.
   - The amount is above zero, with its cents. The reason is not blank and at most 2,000 characters. The photo is a Drive link, or none until P5a.
   - `answer_by` is generated: `sent_on + 5`, the kernels' `BACK_CHARGE_ANSWER_DAYS`. `src/lib/gc/backChargesSql.test.ts` reads the number from the migration.
   - The status is `open`, `agreed`, `disputed`, `kept` or `dropped`. CHECKs: an answer has its day, a dispute has its reason, a keep or a drop has its day and note, and a charge taken off a draw has both its draw and its day.
   - `taken_draw_id` has no FK yet. U6 adds it, with the verb that takes a charge off a draw.
2. **`gc_trade_change_requests`**, a change a trade asked for (`TradeChangeRequest`):
   - on the same statement of work, with what changed (not blank, at most 2,000 characters), why (`owner`, `field` or `plans`, `gc_change_orders`' three), the amount (above zero) and the working days (0 or more);
   - `change_order_id` points at the change order made of it, and is set null when that draft is deleted, so the request can be drafted again. `turned_down_on` and `turned_down_note` come together, with a reason, and never with a change order.
3. **Who reads and writes** (dev only until the trade wave, `src/lib/gc/doors.ts`):
   - one `<table>_dev` policy each, every verb, on `is_dev()`, with the training-mode and twin blocks;
   - `anon` has nothing. The client never deletes either record;
   - a charge's client grants are the columns the office types (`INSERT`) and its settled columns (`UPDATE status, settled_on, settled_note, settled_by`). The company's answer is written with the service role, and the draw by U6;
   - a request's client grant is the office's answer only (`UPDATE change_order_id, turned_down_on, turned_down_note`), for Owner Billing's two verbs. Only the service role makes one.
4. **The office's three verbs** (`SECURITY INVOKER` under the tables' policy, granted to `authenticated`). Each refuses anyone but a dev first, in words, before any other check or write (`devOnly`), as `gc_award` does: door 2 lets the office read the trades, so the refusal is said rather than left to the policy.
   - `gc_back_charge(package, amount, reason, photo)`: on the trade's statement of work once it is signed (`gc_sows.status = 'signed'`), the company the one on it. Returns the id;
   - `gc_keep_back_charge(id, note)`: after a dispute, or when the answer day went by with no answer;
   - `gc_drop_back_charge(id, note)`: any charge not dropped yet, a kept one too.
   Neither settles a charge taken off a draw.
5. **The trade's two verbs** (`SECURITY INVOKER`, revoked from `PUBLIC`, `anon` and `authenticated`, granted to `service_role` only; the link's company first, as P2a's):
   - `gc_trade_answer_back_charge(company, charge, agree, note)`: its own charge, still open and not taken, even after its answer day. A dispute says why;
   - `gc_trade_ask_change(company, package, description, reason, amount, days)`: only the company on the trade's signed statement of work, whose ask is the trade's award, on a job that is ours (`portalCanAskChange`). Returns the id.
6. **Refusals** are keys with the plain words in `DETAIL` (decision 11), `RAISE EXCEPTION '<key>' USING ERRCODE = 'P0001'`:

| Key | Raised by | When |
|---|---|---|
| `devOnly` | the office's three | anyone but a dev, first: "Only a dev charges a trade (keeps a charge, drops a charge) while GC mode is built." |
| `notFound` | all five | no trade or no charge with that id |
| `sowNotSigned` | `gc_back_charge` | the trade's statement of work is not signed, or there is none |
| `amountNeeded` | `gc_back_charge`, `gc_trade_ask_change` | an amount not above zero |
| `descriptionNeeded` | `gc_back_charge`, `gc_trade_ask_change` | a blank reason or description |
| `tooLong` | all five | a reason, a note or a description past 2,000 characters |
| `stillOpen` | `gc_keep_back_charge` | an open charge before its answer day passes |
| `alreadyAnswered` | keep, drop, the trade's answer | taken off a draw; kept, agreed or dropped already; answered already |
| `noteNeeded` | keep, drop, the trade's answer | a keep, a drop or a dispute with no note |
| `notYours` | `gc_trade_answer_back_charge` | another company's charge |
| `notAwarded` | `gc_trade_ask_change` | not the company on a signed statement of work, on a job that is ours |
| `badRequest` | the trade's two | neither agree nor dispute; a fourth reason; days below zero |

`alreadyAnswered`, `descriptionNeeded`, `notAwarded` and `noteNeeded` are new keys for the trade. P4b gives each its status in `TRADE_SQL_ERRORS` and its words in `TRADE_ERROR_WORDS`. Until then `gcTradeSubmit.test.ts` lists them as waiting on P4b, and it fails on any other key a `gc_trade_<verb>` raises without a status. `devOnly`, `sowNotSigned` and `stillOpen` are the office's alone and never reach the portal.

## Checked before the push

**Locally on Postgres 15**, with stand-ins for the tables outside GC mode (`users`, `projects`, `customers` and the rest), the real training-mode and twin blocks, and every GC migration on main, B6-a's included (Owner Billing's three sends were left out: they need Trades mode's billing tables and touch none of these): this migration applied twice with no error, and the bed `supabase/tests/gc_back_charges/20_scenario.sql` passed all 90 checks, and failed when one of its words was changed:
- who may call what: the office's three for signed-in users, the trade's two for the service role alone, and each column grant;
- an estimator, who reads the trades since door 2, is refused `devOnly` by each of the office's three, before any other check;
- every refusal above, by its key and its words;
- a charge on the work Iron Horse signed for, its answer day five days on and its cents kept; the client cannot write the company's answer, delete a charge or make one already kept;
- the company disputes it and the office keeps it, then drops it; an agreed charge cannot be kept but can be dropped; one with no answer by its day is kept; a charge taken off a draw cannot be kept, dropped or answered;
- each CHECK, the answer day never written, and a statement of work or a company with charges on it kept;
- a change request made only by the company on signed work on a job that is ours; the client cannot make one, rewrite it or delete it, and a dev turns one down in its two columns; deleting its draft change order frees it;
- deleting a trade takes its charge, its award and its statement of work with it, and deleting the awarded project in one statement takes its charges and requests, as the sweep of the test rows will (call 4). The keys to the statement of work stay `RESTRICT`: the charges and requests go by cascade from the project and the trade before the statement of work's check runs.

**The SQL bed on GitHub** (`npm run test:pg:gc-back-charges`, the `SQL beds` workflow's `gc-back-charges` job): the whole schema on Supabase Postgres 17, then this migration a second time, then the same scenario.

## Verify after the push

```sql
-- 1. The tables, empty, with their policy and blocks.
SELECT (SELECT count(*) FROM public.gc_back_charges) AS charges, (SELECT count(*) FROM public.gc_trade_change_requests) AS requests;
-- Expected: 0, 0.
SELECT polrelid::regclass, polname FROM pg_policy
WHERE polrelid IN ('public.gc_back_charges'::regclass, 'public.gc_trade_change_requests'::regclass) ORDER BY 1, 2;
-- Expected for each: the _dev policy, digital_twin_write_fence_{delete,insert,update}, read_only_users_cannot_{delete,insert,update}.

-- 2. Who may call what.
SELECT f, has_function_privilege('authenticated', f, 'EXECUTE') AS signed_in, has_function_privilege('service_role', f, 'EXECUTE') AS service, has_function_privilege('anon', f, 'EXECUTE') AS anon
FROM unnest(ARRAY['public.gc_back_charge(uuid, numeric, text, text)', 'public.gc_keep_back_charge(uuid, text)', 'public.gc_drop_back_charge(uuid, text)',
  'public.gc_trade_answer_back_charge(uuid, uuid, boolean, text)', 'public.gc_trade_ask_change(uuid, uuid, text, text, numeric, integer)']) f;
-- Expected: the office's three true/true/false; the trade's two false/true/false.

-- 3. The office's gate, rolled back, as a dev: the test project's Concrete trade has no signed statement of work.
BEGIN;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT id FROM public.users WHERE role = 'dev' AND NOT read_only LIMIT 1), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT public.gc_back_charge((SELECT package_id FROM public.gc_invites WHERE id = '115b6971-ee16-4459-9340-85fc35d5c1e3'), 100, 'Verify, delete me');
-- Expected: ERROR sowNotSigned, DETAIL "A charge goes on signed work. This trade's statement of work is not signed."
ROLLBACK;

-- 4. Anyone but a dev is refused first, rolled back, as an estimator.
BEGIN;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT id FROM public.users WHERE role = 'estimator' AND NOT read_only LIMIT 1), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT public.gc_back_charge((SELECT package_id FROM public.gc_invites WHERE id = '115b6971-ee16-4459-9340-85fc35d5c1e3'), 100, 'Verify, delete me');
-- Expected: ERROR devOnly, DETAIL "Only a dev charges a trade while GC mode is built."
ROLLBACK;

-- 5. The trade's gate, rolled back, as the service role: the test company asks for a change on work it has not signed.
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.gc_trade_ask_change('ff11d0fb-269e-44de-b92a-e7256c180f67',
  (SELECT package_id FROM public.gc_invites WHERE id = '115b6971-ee16-4459-9340-85fc35d5c1e3'), 'Verify, delete me', 'field', 100, 0);
-- Expected: ERROR notAwarded.
ROLLBACK;
```

## Rollback

Not expected. To undo: drop the five functions, then `gc_trade_change_requests` and `gc_back_charges`. Nothing else changed.

## Status

Prepared 2026-10-08 by the Portal lane (Helper 13) on `mockups/portal-p4.md` as amended (`spike/gc-mode` at cf6b09fc5, its SQL word for word). Cut on 2026-10-09 once B6-a (`20261009140000`, applied 09:13 UTC) and its types (#5101) were on main. The lead pushes it in the evening batch.
