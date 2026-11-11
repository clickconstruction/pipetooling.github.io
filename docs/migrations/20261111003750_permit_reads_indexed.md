# 20261111003750_permit_reads_indexed.sql (2026-11-10, v2.6893)

Permits: the three reads made index-driven (punch list #307; `to-dos/bid-permits/`). Three functions replaced in place, same shape, same rows. No table, column or grant changes.

## What it does

`research_permits`, `research_permits_v2` and `research_builders` each paired a building permit with a plumbing permit *on the same permit number or at the same address*. Postgres cannot serve an `OR` across two columns from an index, so each read compared every building permit in a city with every plumbing permit in it. The cost grew with the product of the two sides.

- **The pairing is two indexed joins**, one on `(city, permit_number)` and one on `(city, address_key)`, joined with `UNION` (in `research_permits_v2`'s `has_plumbing`, two `EXISTS`). The pairs are the same set.
- **`research_builders`' bids with a name** had a second join of the same kind: every builder against every bid, by the customer's name or the legacy builder's. It is two equal joins now, which the planner hashes.
- **One tiebreak added**, `contact`, where the plumber on a permit is picked from several plumbing permits filed the same day. The pick was left to chance between two equal rows before; it is the same every run now.

Nothing else in the three bodies changes: the window, the residential filter, the verdicts, `NOT p.backfilled` on the skim, the builder stats, the marks.

## Proven on prod, read only

Each rewritten body was run beside the live function with the same arguments and compared with `EXCEPT` both ways: no row differs in San Antonio (the whole window, with houses, and a 30-day window), Austin, New Braunfels, San Marcos or Seguin, on the skim's two reads and on Builders. Timed with every column read:

| Read | Before | After |
| --- | --- | --- |
| `research_permits`, San Antonio | 1.1 s | 42 ms |
| `research_permits_v2`, San Antonio | 1.1 to 1.3 s | 67 ms |
| `research_permits_v2`, Austin | 1.0 to 1.1 s | 52 ms |
| `research_builders`, San Antonio | 2.3 to 2.8 s | 36 to 43 ms |

## Tested

`npm run test:pg:permit-skim`: the whole schema with this file applied. The bed re-applied the skim's own migration last, which put the first bodies of the reads back; it now runs the migrations that rewrote them again after it, so the probe reads these functions.

## Release order

Merge, `supabase db push`, then `supabase functions deploy permit-pull` (the read back, no longer refused). The client reads the same names with the same arguments, so nothing waits on the push.
