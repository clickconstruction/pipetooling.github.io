# 20261120150000_research_builders_our_bids.sql (2026-11-20, v2.8138)

Permits: Builders and the call list count our bids as Market's table of companies does ([v2.8138](../recent-features/v2.8138.md), punch list #405). Two small functions added, one read replaced in place with the same shape. No table, column, index or policy changes.

## What was wrong

`research_builders` counted every bid ever made under a name ([`20261119063000`](./20261119063000_permit_plumbing_ties.md) holds the body it had). A digital twin's practice bid sits in `bids` beside the bid it copies, under the same customer, so it counted too. Market's table of companies (`bidCompanies` in `src/lib/research/permitMarket.ts`) leaves a practice bid out and looks back two years. The call list's *We bid* tag reads this function and the table's **Our bids** column reads the client's count, so on one page one name read two counts.

## The rule, in one place on the database

| Object | What it does |
|---|---|
| `research_bid_counts(p_project_name, p_created_at)` | New. Whether one of our bids counts beside a name. True when the project name does not start with the word ZZ in any case (`^\s*zz\M`, the ZZ convention's form for a bid, `isZzBidName`) and the bid was made from 730 days ago to today, by the day on the company calendar. A bid with no day counts. `STABLE` and with no `SET` clause, so the planner can write it into the read. |
| `research_bid_party_key(p_name)` | New. The key a bid counts under for one name on it: `research_name_key(p_name)`, or null for a name that starts with ZZ and for a name whose key starts with a bid platform's (`planhub`, `buildingconnected`, `constructconnect`, `isqft`, `smartbid`, `bidnet`, `buildingblok`, `civcast`, `demandstar`). Such a customer is the bucket a platform's bids sit under until a GC is chosen. `IMMUTABLE`, no `SET` clause. |
| `research_builders(p_city)` | `named_bids` reads only the bids `research_bid_counts` passes, keys the customer's name and the old builders list's name with `research_bid_party_key`, and takes a bid's day on the company calendar (it took the UTC day). Nothing else in the body changed. |

Both new functions are closed to `PUBLIC` and `anon` by name and granted to `authenticated` and `service_role`.

The client's one place is `src/lib/research/ourBids.ts`, which lands in the PR after this one. The table of companies and the count of a tied customer's bids read it. A test there holds the two copies together: the days and the platforms in this file must be the ones in that kernel.

## What it changes for a reader

- **Builders**, the *Our bids* column and the builder's sheet: a name's count leaves out practice bids and bids older than two years. A name whose only bids were practice bids or old ones now reads *never*, and can show under **Never bid**.
- **Market, Call this week**: the *We bid N, won N* and *Never bid* tags stand on the same count as the table under them.
- The day of the last bid is the company calendar's. A bid made in the evening read as the next day.

The shape of `research_builders` did not change, so no client and no type changed with it.

## Not changed

- `research_contact_history`, the skim card's *warm · cold · new name* word, still counts every bid ever made under a name. It is another read with another caller and is left as it was.
- `permit_funnel`'s *became a bid* asks whether any bid to the lead's name was made after a pursue. That is not a count of our bids with a name.

## Safety

- `SET lock_timeout = '3s'` first. Three `CREATE OR REPLACE FUNCTION`, three comments, two grants. No lock on a table.
- Idempotent: a second run changes nothing.
- No open PR and no migration after `20261119063000` redefines `research_builders` (checked against `origin/main` and the open PRs on 2026-11-20 before the stamp was claimed).

## Tested

`supabase/tests/permit_skim` (`npm run test:pg:permit-skim`, the SQL beds workflow): nine bids with one made-up builder, of which six count. Under the customer, under the old list's name, one under both counted once, one on the 730th day. Left out: two practice bids and one on the 731st day. A name that only starts with ZZZ is no practice bid. The two rule functions are asked directly, and `anon` runs neither.

## Push

After the merge, from a checkout at `origin/main`: `bash scripts/db-push.sh`, this file alone. The client that reads the same rule merges after the push.
