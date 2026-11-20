# 20261119063000_permit_plumbing_ties.sql (2026-11-19, v2.7922)

Permits: a plumbing permit counts for a job only when it is that job's ([v2.7922](../recent-features/v2.7922.md)). One small function added, three reads replaced in place with the same shapes. No table, column or index changes.

## What was wrong

`research_permits`, `research_permits_v2` and `research_builders` paired a building permit with every plumbing permit on its number **or at its street address** ([`20261111003750`](./20261111003750_permit_reads_indexed.md)). `permits.address_key` carries no suite. In a shopping centre or an office tower the plumbing permit of another tenant's project sat at the same address, so it closed the job on the Skim and its name was shown as the builder's plumber.

## The rule

| Object | What it does |
|---|---|
| `permit_address_plumbing_counts(p_city, p_building_builder_key, p_plumbing_builder_key)` | New. Whether a plumbing permit at a building permit's street address is that permit's own job. True in every city but San Antonio. In San Antonio, true only when both rows carry the same `builder_key`. `IMMUTABLE`, no `SET` clause, so the planner writes it into the joins that call it (checked with `EXPLAIN VERBOSE`: the join filter is the bare comparison). |
| `research_permits` | The address half of `plumbing_pairs` also asks the function. A name is the plumber's only when it differs from the applicant's by `research_name_key` **and** by `builder_key`. |
| `research_permits_v2` | `theirs.has_plumbing`, which counts a builder's open permits, asks the function and holds a plumbing permit to the 30 days below. It had no date bound. |
| `research_builders` | `plumb_pairs` asks the function and holds a plumbing permit to the same 30 days. It had no date bound, so any plumbing permit ever filed at an address counted. The same two tests name the plumber. |

A plumbing permit on the building permit's own number always counts, as before. The 30 days are the ones `research_permits` already used: a plumbing permit counts when its day is no older than 30 days before the building permit was applied for.

## Why San Antonio alone

San Antonio issues a project's plumbing permit on the project's own number, under the applicant's name. Read on prod on 2026-11-19, read only, over the 2,094 commercial building permits the city issued from June 2025 to mid July 2026:

- 1,377 carry a general plumbing permit on their own number.
- 33 have none on their number and a plumbing contractor's own general permit at the address afterwards.

So a plumbing permit on a number of its own at a San Antonio address is somebody's separate job: a water heater, a backflow test, another tenant. The same applicant is kept as a tie because an application (`sa-applied`) and the permit issued for it (`sa-issued`) have different numbers, and the plumbing permit rides the issued number.

Austin, New Braunfels, San Marcos and Seguin never put a plumbing permit on a building permit's number (0 of 2,714, 180, 73 and 174 plumbing permits). There the plumber pulls a permit of his own and the address is the only tie. It stands as it was.

## What changes on prod

Counted on 2026-11-19 from every row of `permits` in the five cities, with the old rule and the new one run side by side in the dev preview, read only.

| San Antonio | Before | After |
|---|---|---|
| The skim's read since Aug 1: commercial permits that read as having a plumbing permit, of 767 | 345 | 277 |
| Of those, applications (`sa-applied`), of 457 | 103 | 51 |
| Rows that name a plumber | 131 | 0 |
| Builders: permits with no plumber yet, of 3,535 in the last year | 960 | 1,551 |
| Builders shown with a plumber they use, of 1,231 | 579 | 0 |

- The 68 permits that open again include `COM-PRJ-APP26-39802039`, the application that read as taken by a nail salon's contractor in another unit.
- No San Antonio row names a plumber any more, because the city's feed never names one. A builder whose jobs have plumbing permits reads *not named on the permits* (570 builders).
- **Austin, New Braunfels, San Marcos, Seguin: no row differs**, on the skim's read or on Builders.

`permit_skim_wait` reads `research_permits`, so the Needs you line for San Antonio counts the reopened permits too.

## What it does not fix

- Two jobs by one applicant at one address still tie to each other. A permit expediter who files for several tenants of one centre is the case. An application carries no unit, so the feed cannot tell them apart.
- In the other four cities another tenant's plumbing permit at the address can still close a job. Nothing read there showed it, and the address is the only signal those feeds give.
- A San Antonio permit whose plumber pulled a permit of his own, with none on the project's number, now reads open. That was 33 of 2,094.

## Tested

`npm run test:pg:permit-skim`: the whole schema with this file applied, then applied again. New in the probe: in San Antonio another tenant's plumbing permit, a plumber's own permit and the applicant's year-old permit at the address close nothing and name nobody; an application is closed by the plumbing permit on the number it was issued under; the applicant's company is never the plumber; one permit waits on a skim; and in a city where plumbers pull their own permits the address still ties them on both reads. Anon cannot run the new function.

## Release order

Merge, then `supabase db push` from a main checkout. The client reads the same names with the same arguments, so it works before and after the push and the order against the client deploy does not matter. Then time the three reads signed in: they took 49 to 68 ms before.

**Applied** to prod by 2026-11-20: the dev seat's `check_migration_ledger` read 1,410 versions applied against 1,410 local files, this version among them (read in the docs pass after #8832); `permit_address_plumbing_counts` reached `database.ts` in #8921.
