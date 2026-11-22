# 20261121234000_bid_site_permits_one_order.sql (2026-11-21, v2.8220)

Bids and permits: the read behind a bid's site answers in one order ([v2.8220](../recent-features/v2.8220.md), punch list #307, PR 5's leftover; `to-dos/bid-permits/`). One function replaced in place with the same arguments and the same columns. No table, column, index, policy or grant changes.

## What was wrong

`bid_site_permits` ordered by the day, the permit's number and its type ([`20261110220345`](./20261110220345_bid_site_permits.md) holds that body). The table's unique key also holds the source, so one permit that sits in both of a city's feeds on one day ties, and Postgres may put a tie either way from one call to the next.

The client reads the answer a page at a time since v2.6933, and each page is a call of its own. The function stops at 5,000 rows. With a tie on the last place, one call could keep one twin and the next call the other, so a page could lose a row or bring one twice.

## What changed

| Object | What it does |
|---|---|
| `bid_site_permits(p_city, p_numbers)` | `p.id` ends the `ORDER BY`: the day newest first with no day last, the number, the type, then the id. Nothing else in the body changed. |

The function's comment says the order.

## What it changes for a reader

Nothing on a screen today. No two rows tie on prod (read on 2026-11-21: no pair of permits with an address shares a city, a day, a number and a type), and the largest real ask is under a fifth of the limit. The client still cuts its pages by `id` and puts the answer back newest first with `sitePermitOrder`, whose order is now the function's own.

## Safety

- `SET lock_timeout = '3s'` first. One `CREATE OR REPLACE FUNCTION`, one comment, the rights it already had restated. No lock on a table.
- Idempotent: a second run changes nothing.
- The function stays `SECURITY INVOKER`, so it reads `permits` under the caller's own row security.
- Prod's stored body was the one in `20261110220345`, read line for line on 2026-11-21 before the file was written. No open PR and no later migration on `origin/main` redefines the function.
- The bed `bid-site-permits` (`npm run test:pg:bid-site-permits`, in `scripts/sql-beds.txt`) applies the file twice on the whole schema and reads the order, the cut at 5,000 rows and the rights. The earlier body fails its first line.

## Release order

Either side of the merge. The client asks for nothing new, so the app reads the same before and after the push.

```bash
supabase db push
```
