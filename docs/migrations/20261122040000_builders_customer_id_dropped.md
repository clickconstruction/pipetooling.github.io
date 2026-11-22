# 20261122040000_builders_customer_id_dropped.sql (2026-11-21, v2.8261)

Permits: the customer column on `builders` is dropped ([v2.8261](../recent-features/v2.8261.md), punch list #307, PR 6's leftover; `to-dos/bid-permits/`). One column and its foreign key go. One read is dropped and made again without that column in its return. No other table, index or policy changes.

## What was wrong

`builders.customer_id` came with the table in [`20261110090000`](./20261110090000_permit_skim.md), to say which of our customers a name on the permits is. Nothing ever wrote it. The answer on a name went to a table of its own the same day, `builder_customer_answers` ([`20261110223054`](./20261110223054_builder_customer_answers.md)), which keeps every answer with who gave it and when. One name can be tied to more than one customer there, which one column could not say.

The column stayed, null on every row. `research_builders` still returned it, and the client's `BuilderRow` carried it to no screen.

## What changed

| Object | What it does |
|---|---|
| `research_builders(p_city)` | Dropped and made again in the same file. Its return has no `customer_id`. The body is the one in [`20261120150000`](./20261120150000_research_builders_our_bids.md) with that one column gone. The comment says where a tied customer is kept. Closed to `PUBLIC` and `anon` by name again and granted to `authenticated` and `service_role`, since a function made new takes the default grants. |
| `builders.customer_id` | Dropped, and `builders_customer_id_fkey` with it. |
| `builders`, the table's comment | No longer says the table holds the customer a name is. It names `builder_customer_answers`. |

The return loses a column, which `CREATE OR REPLACE` cannot do, so the function is dropped first. The file still writes `CREATE OR REPLACE FUNCTION public.research_builders(` after the drop, so `src/lib/research/ourBids.test.ts` reads this body as the newest and holds it to the one rule for our bids.

## What it changes for a reader

Nothing on a screen. No screen read the field. A client from before the merge gets a list with one field fewer, and a client from after it gets one field more until the push. Neither reads it.

## Read on prod before writing

Read only, on 2026-11-21:

- `builders` holds no row, so no value is lost.
- The column's one dependent is its own foreign key. No view, policy, index or trigger names it.
- `research_builders` is the one function whose body reads it. `permit_funnel` has an alias of the same letters, and it stands for `bids` there.
- No other function calls `research_builders`.
- The stored body of `research_builders` was the one in `20261120150000`.

No open PR redefines `research_builders` (the open PRs were read before the stamp was claimed, and again before the PR was opened).

## The older files do not run a second time

Four files wrote `research_builders` before this one: `20261110090000`, `20261111003750`, `20261119063000` and `20261120150000`. Each body reads the column, so none of them runs again once it is gone. The bed `permit-skim` used to run the first of them a second time and then the later ones in order. It now runs this file a second time in their place, and then [`20261122032000`](./20261122032000_permit_first_plumbing_day.md) again, which adds a read of its own and names no builder's customer.

A later file that rewrites `research_builders` starts from this body.

## Safety

- `SET lock_timeout = '3s'` first.
- `ALTER TABLE … DROP COLUMN` takes the table's strongest lock for an instant. The table is empty, and its readers are `research_builders`, `research_permits` and the builder's sheet. With the timeout the push fails fast when one of them holds the table.
- Idempotent: `DROP FUNCTION IF EXISTS`, then `CREATE OR REPLACE`, then `DROP COLUMN IF EXISTS`. A second run leaves the same function and the same table.
- The function stays `SECURITY INVOKER` with `search_path = public`.
- To take it back: add the column again as `uuid REFERENCES public.customers(id) ON DELETE SET NULL`. No value was in it.

## Tested

- A local Postgres 15 with stand-in tables, before the PR: the body of `20261120150000` first, then this file twice. The read lists a name with its mark, its plumber and our bids. Its return has no `customer_id`, `builders` has no foreign key left, and `anon` cannot run it.
- `supabase/tests/permit_skim` (`npm run test:pg:permit-skim`, the SQL beds workflow) on the whole schema, with this file applied twice: the read's return, the table's columns and its foreign keys are asked for by name, beside every line the bed already held.

## Release order

Either side of the merge. `npm run check:calls-ahead` finds no call ahead of the migration, so the deploy is not held on the push. The push follows the merge all the same, so the function and the client's row read alike.

```bash
supabase db push
```
