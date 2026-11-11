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

Timed with every column read, as a signed-in dev, the way the app's reads meet row security:

| Read | Before both | After the policies alone | After both |
| --- | --- | --- | --- |
| `research_permits`, San Antonio | 2.0 s | 0.76 s | 49 ms |
| `research_permits_v2`, San Antonio | 2.9 s | 0.78 s | 68 ms |
| `research_builders`, San Antonio | 3.0 s | 1.76 s | 61 ms |
| `research_permits_v2`, Austin | 2.1 s | 0.51 s | 59 ms |
| `research_builders`, Austin | 2.7 s | 1.43 s | 45 ms |

## The other half

These reads were slow for two reasons, and this file fixes one. The functions are `SECURITY INVOKER`, and the tables' policies called `user_can_research_permits()` bare, so Postgres asked it for every row a read touched. The Permits session's `20261111013000_permit_policies_once.sql` writes it as `(SELECT …)`, asked once a read; it was pushed first. With this file's bodies and without that one a signed-in read took 0.7 to 1.4 seconds; with that one and the old bodies, the middle column. Neither alone makes the tab fast.

## Tested

`npm run test:pg:permit-skim`: the whole schema with this file applied. The bed re-applied the skim's own migration last, which put the first bodies of the reads back; it now runs the migrations that rewrote them again after it, so the probe reads these functions.

## Release order

Merge, `supabase db push`, time the reads signed in, then `supabase functions deploy permit-pull` (the read back, no longer refused). `check:calls-ahead` labels the PR *push right after the merge*, because it replaces functions the client calls; the client reads the same names with the same arguments.

**Applied** to prod by 2026-11-11: `npm run check:migration-drift` read 1239 local files and 1239 remote versions, fully applied (read in the docs pass after #7525); no change to `database.ts`, since the three functions were replaced in place with the same signatures.
