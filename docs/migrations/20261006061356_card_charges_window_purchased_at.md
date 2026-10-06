# 20261006061356_card_charges_window_purchased_at.sql (2026-10-06, v2.4665)

`list_card_charges_window` and its rows function `_card_charges_window_rows` return one more column, **`purchased_at`**: when the card was used, Mercury's `createdAt` from `raw`. Not named `created_at`: on a row of this read that would be taken for the table's own insert time. `RETURNS TABLE` gains a column, which `CREATE OR REPLACE` cannot do (42P13), so both functions are dropped and created again. Otherwise the bodies are the ones on prod: the rows function from 20261005235207, the wrapper from 20261005212106. Same signatures, same grants (the wrapper to `authenticated`; the rows function closed to `PUBLIC`, `anon` and `authenticated`), comments re-issued, both still `SECURITY DEFINER`, the rows function still `LANGUAGE sql` (checked in full when the push creates it).

## Why

Punch list #72, the Tally team queue, keys a holder's day on when the card was used. Mercury dates a card charge twice: `createdAt`, the purchase, and `postedAt`, the settlement, a median 8 hours later and on a different company day for 40% of charges (#72's measure). The queue's history read is this one, so until it carries the purchase time, store runs and same-day chips stay on the posting day.

## The column

- `purchased_at timestamptz`, after `posted_at`: `raw ->> 'createdAt'`, read in the same materialized pass (`w`) as the card id.
- It is **not** `mercury_transactions.created_at`, the row's insert time.
- Cast only when the text is shaped as an ISO timestamp (the hour to 23, the minute and second to 59, as the client's check reads it; Postgres alone takes 24:00 and :60 as the next day or minute) **and** `pg_input_is_valid(…, 'timestamp with time zone')` says the cast would succeed (Postgres 16+; prod runs 17.6). A missing or stray value reads `NULL` and can never fail the read for Spending, Review or the Tally queue. Without the second check, a value shaped like a timestamp on a day that does not exist (`2026-02-30T…`) would fail every read whose window held it; the bed shows it.
- Prod, read-only 2026-10-06 as the owner: 13,775 of 13,797 transactions carry an ISO `createdAt`, 22 carry none (none since July 2026), and none carries anything else.
- The window still filters and orders on `posted_at`, so People → Spending and Review's fuel on no job read exactly the charges they read before.

## House rules

Opens with `SET lock_timeout = '3s'`. Idempotent: `DROP FUNCTION IF EXISTS`, then `CREATE OR REPLACE`; the bed applies it twice. No table, so no read-only block calls. `src/lib/banking/cardChargesWindow.test.ts` holds the drops before the creates, both column lists equal (23, `purchased_at` after `posted_at`), the client row type naming every column, the two guards, the window on `posted_at`, the bodies equal to prod's but for `purchased_at`, and the grants and comments.

## Test bed

`npm run test:pg:card-charges-window` (`scripts/pgtest-card-charges-window.sh`, `supabase/tests/card_charges_window/`): a stand-in schema, the three card-charges migrations as they ship (this one twice), then scenarios. They cover the shape and the grants, a purchase the evening before it posted, an offset `createdAt`, none, `yesterday`, a day that does not exist, hour 24, second 60, an ACH, a charge posted after the window, a duplicate, a payroll-only charge for each role, and a field login refused. Docker's `postgres:17` by default; `PGTEST_PGBIN=/usr/local/opt/postgresql@15/bin` runs it on a local Postgres 15, where the schema stands in `pg_input_is_valid`. Passed 2026-10-06 on 15.14; with the validity check removed it fails on the `2026-02-30` row ("date/time field value out of range").

## Apply

`supabase db push` once this is on `main`. Either order with the client: an old client ignores the extra column, and the new client reads `purchasedAt` as null until the push. The drops and creates run in the one transaction, so no call finds the functions missing.

## Verify after the push

On the dev server, read-only, as an office user: `list_card_charges_window` over 90 days returns the same rows as before, `purchased_at` filled on all of them, in about the same time (the plan read 93 ms on 2026-10-06). For a few charges, `purchased_at` equals `raw ->> 'createdAt'`.
