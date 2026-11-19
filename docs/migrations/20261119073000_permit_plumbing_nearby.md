# 20261119073000_permit_plumbing_nearby.sql (2026-11-19, v2.7935)

Permits: a row says when a plumbing permit sits at its address and does not count ([v2.7935](../recent-features/v2.7935.md)). One function added. Nothing replaced, no table, column or index changes.

## Why

Since [`20261119063000`](./20261119063000_permit_plumbing_ties.md) a San Antonio plumbing permit at a job's street address counts for the job only when the same applicant filed it. The ones that do not count were dropped from the read. A skimmer could not see that a plumber, or another tenant's builder, was at work at the address.

## What it adds

| Object | What it does |
|---|---|
| `research_permits_v3(p_city, p_since, p_residential)` | `research_permits_v2`'s rows with four columns more. `plumbing_nearby` is how many plumbing permits sit at the row's street address and do not count for it. `plumbing_nearby_on`, `plumbing_nearby_by` and `plumbing_nearby_what` are the newest one's day, contact and work (`project_name`, else `permit_type`). `SECURITY INVOKER`, `STABLE`, closed to anon. |

- It **reads v2 and joins the four columns on**. No body is copied, and v2 keeps its shape for a client that has not updated.
- A plumbing permit is left uncounted by the same test that counts one: another number, inside the same 30 days, and `NOT permit_address_plumbing_counts(...)`. The two can never disagree.
- Only a row with no plumbing permit of its own carries the columns. A row that reads as taken has `plumbing_nearby = 0`.
- In Austin, New Braunfels, San Marcos and Seguin the address always ties, so nothing is ever left uncounted and the count is 0 on every row.

## The client

`loadResearchPermits` asks for v3, then v2, then the first read, each standing in while the next migration is not pushed (PostgREST's `PGRST202`). The client works before and after the push; before it, no row carries the note.

## Tested

`npm run test:pg:permit-skim`: the whole schema with this file applied, then applied again. New in the probe: the open San Antonio row carries the two permits at its address inside the 30 days, the newest first with its work, and never the year-old one; rows with a plumbing permit of their own carry none; v3 less its four columns equals v2 row for row; a city where the address always ties leaves nothing uncounted; anon cannot run v3.

## Release order

Merge after [#8901](https://github.com/clickconstruction/pipetooling.github.io/pull/8901), then `supabase db push` from a main checkout. Order against the client deploy does not matter. Time `research_permits_v3` for San Antonio signed in: v2 took 68 ms.
