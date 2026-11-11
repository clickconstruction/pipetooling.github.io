# 20261111003750_permit_reads_indexed.sql (2026-11-10, v2.6893)

Permits: the three reads made index-driven (punch list #307; `to-dos/bid-permits/`). Three functions replaced in place, same shape, same rows. No table, column or grant changes.

## What it does

`research_permits`, `research_permits_v2` and `research_builders` each paired a building permit with a plumbing permit *on the same permit number or at the same address*. Postgres cannot serve an `OR` across two columns from an index, so each read compared every building permit in a city with every plumbing permit in it. The cost grew with the product of the two sides.

- **The pairing is two indexed joins**, one on `(city, permit_number)` and one on `(city, address_key)`, joined with `UNION` (in `research_permits_v2`'s `has_plumbing`, two `EXISTS`). The pairs are the same set.
- **`research_builders`' bids with a name** had a second join of the same kind: every builder against every bid, by the customer's name or the legacy builder's. It is two equal joins now, which the planner hashes.
- **One tiebreak added**, `contact`, where the plumber on a permit is picked from several plumbing permits filed the same day. The pick was left to chance between two equal rows before; it is the same every run now.

Nothing else in the three bodies changes: the window, the residential filter, the verdicts, `NOT p.backfilled` on the skim, the builder stats, the marks.

## Proven on prod, read only

Each rewritten body was run beside the live function with the same arguments and compared with `EXCEPT` both ways: no row differs in San Antonio (the whole window, with houses, and a 30-day window), Austin, New Braunfels, San Marcos or Seguin, on the skim's two reads and on Builders.

Timed with every column read, twice over: as the database owner, where no row security runs, and as a signed-in dev, the way the app's reads meet it.

| Read | Owner, before | Owner, after | Signed in, before | Signed in, after |
| --- | --- | --- | --- | --- |
| `research_permits`, San Antonio | 1.1 s | 42 ms | 2.0 s | 1.1 s |
| `research_permits_v2`, San Antonio | 1.1 to 1.3 s | 67 ms | 2.9 s | 1.4 s |
| `research_builders`, San Antonio | 2.3 to 2.8 s | 36 to 43 ms | 3.0 s | 0.7 s |
| `research_permits_v2`, Austin | 1.0 to 1.1 s | 52 ms | 2.1 s | 0.75 s |
| `research_builders`, Austin | — | — | 2.7 s | 0.28 s |

## What this does not fix

The gap between the two *after* columns is the access rule. The functions are `SECURITY INVOKER`, and the tables' policies call `user_can_research_permits()` bare, so Postgres asks it for every row a read touches. The Permits session's migration `*_permit_policies_once.sql` writes it as `(SELECT …)`, asked once a read. Until that is pushed a signed-in read is about half as slow as it was, not fast, and the read back as history stays held.

## Tested

`npm run test:pg:permit-skim`: the whole schema with this file applied. The bed re-applied the skim's own migration last, which put the first bodies of the reads back; it now runs the migrations that rewrote them again after it, so the probe reads these functions.

## Release order

Merge, then `supabase db push`. The client reads the same names with the same arguments. `check:calls-ahead` still labels the PR *push right after the merge*, because it replaces functions the client calls.
