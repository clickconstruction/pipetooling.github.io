# 20261121152000_research_contact_history_our_bids.sql (2026-11-21, v2.8181)

Permits: the word beside who pulled a permit counts our bids by the one rule ([v2.8181](../recent-features/v2.8181.md), punch list #405). One read replaced in place with the same shape. No table, column, index, policy or grant changes.

## What was wrong

`research_contact_history` kept its own count of our bids under a name: every bid ever made, a digital twin's practice bids among them ([`20261111043500`](./20261111043500_permit_hint_both_decks.md) holds the body it had). Builders and Market's call list took the one rule in [`20261120150000`](./20261120150000_research_builders_our_bids.md). So one name could read *Never bid* on Market and **cold** on the skim card.

## What changed

| Object | What it does |
|---|---|
| `research_contact_history(p_keys)` | `named_bids` reads only the bids `research_bid_counts` passes, keys the customer's name and the old builders list's name with `research_bid_party_key`, and takes a bid's day on the company calendar (it took the UTC day). Nothing else in the body changed: the deck read, the one row per name asked and the columns are as they were. |

The rule itself is in the earlier file and did not change: no practice bid, the last 730 days by the company calendar, never under a ZZ name or a bid platform's bucket.

## What it changes for a reader

- **Permits, the skim card, the ledger and a permit's sheet:** the word under who pulled a permit counts the bids of two years with no practice bid. A name whose only bids were practice bids or old ones reads **new name**. A name with three bids and no win, of which fewer than three still count, reads **seen** where it read **cold**.
- A win older than two years no longer makes a name **warm**.
- The day of the last bid is the company calendar's.

The words for **new name** changed with it in the client, in the same PR: *no bid to this name in the last two years*.

## Safety

- `SET lock_timeout = '3s'` first. One `CREATE OR REPLACE FUNCTION`, one comment, the grant it already had. No lock on a table.
- Idempotent: a second run changes nothing.
- The function stays `SECURITY INVOKER`, so a reader still counts only the bids their own access shows.
- Prod's stored body was the one in `20261111043500` by its hash, read on 2026-11-21 before the stamp was claimed. No open PR and no later migration on `origin/main` redefines the function.

## Tested

`supabase/tests/permit_hint_decks` (`npm run test:pg:permit-hint-decks`, the SQL beds workflow): a made-up customer with two bids that count and two that do not, a practice bid and one made on the 731st day, both won so a miscount would show in the wins. A bid platform's bucket and a ZZ builder each hold a bid and read as no name. A name on the old builders list counts its bid, and a bid made late in the evening reads its company-calendar day. The bed's runner re-applies the two migrations that write the function in order, since the first alone would put the old body back.

`src/lib/research/ourBids.test.ts` holds this file to the kernel: the newest migration that writes `research_contact_history` must count by both rule functions.

## Applied

On the prod ledger, read on 2026-11-21 with the dev seat's `check_migration_ledger` during a docs catch-up. The push's own time and checks were not recorded here.
