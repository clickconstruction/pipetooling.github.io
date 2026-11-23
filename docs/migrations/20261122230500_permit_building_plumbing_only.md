# 20261122230500_permit_building_plumbing_only.sql (2026-11-22, v2.8295)

Permits: only the building's own plumbing permit says a job has a plumber ([v2.8295](../recent-features/v2.8295.md); found in passing by punch list #307, in #302's read). One function added and five replaced in place, same shapes. No table, column, index, policy or grant changes.

## Why

A city files lawn sprinklers, gas lines, sewer taps and backflow under plumbing. The pull stores them all with `kind = 'plumbing'`, and the reads paired any such permit with a building permit. So a sprinkler permit on a building's number, or from its applicant at its address, read as **Has a plumber** and took the building off the skim.

A bid's window already tells them apart: `plumbingTypeOf` in `src/lib/research/bidSite.ts` says only a general plumbing permit, or a plumbing type with no qualifier, is the building's plumbing. The skim now reads by the same rule.

## What it changes

| Object | What it does |
|---|---|
| `permit_is_building_plumbing(p_permit_type)` | New. `true` for a general plumbing permit or a plumbing type with no qualifier, and for a permit with no type. `false` for irrigation, gas, sewer, backflow, a repair and the rest. `IMMUTABLE`, one expression, no `SET` clause, so the planner writes it into the joins. Closed to anon. |
| `research_permits` | The plumber and his day come from the building's own plumbing permit. `permit_skim_wait` reads it and follows. |
| `research_permits_v2` | A builder's open count. |
| `research_permits_v3` | What sits at an open row's address uncounted. A sprinkler permit is no longer said as plumbing nearby. |
| `research_permits_v4` | A job's first plumbing day. |
| `research_builders` | A builder's plumber and the jobs he holds. |

- Each of the five bodies is its newest one with one predicate added beside each `kind = 'plumbing'`, nine places in all. Nothing else moved.
- The file was built by script from `20261119063000`, `20261119073000`, `20261122032000` and `20261122040000`. Each body was first held against prod's own `pg_proc.prosrc` by its md5, and all five matched.
- `CREATE OR REPLACE` with the same shapes, so every grant and comment stands.

## The rule, on every plumbing type prod holds

Read on prod 2026-11-22, read only.

| City | Type | Permits | Counts |
|---|---|---|---|
| San Antonio | Plumbing General Permit | 17,269 | yes |
| San Antonio | Plumbing Irrigation Permit | 12,741 | no |
| San Antonio | LSR Plumbing Permit | 5,105 | no |
| San Antonio | Plumbing Gas Permit | 4,936 | no |
| San Antonio | Plumbing Sewer Permit | 4,773 | no |
| San Antonio | Plumbing Backflow Permit | 792 | no |
| San Antonio | Plumbing Completion Permit | 487 | no |
| San Antonio | Plumbing Medical Gas Permit | 188 | no |
| San Antonio | Plumbing MRFPSS Permit | 1 | no |
| Austin | Plumbing Permit | 2,932 | yes |
| New Braunfels | Residential - Plumbing, Commercial - Plumbing | 243 | yes |
| San Marcos | Plumbing | 74 | yes |
| Seguin | Residential Plumbing, Commercial Plumbing | 187 | yes |

The four cities with one plumbing type already leave irrigation out of their pulls, so nothing moves there.

## Read on prod before writing

Read-only, 2026-11-22. The new body of `research_permits` was run as a plain query with the rule written in, beside today's function, over the last 180 days of commercial permits.

| City | Buildings | Has a plumber today | With the rule | Time today | Time with the rule |
|---|---|---|---|---|---|
| San Antonio | 842 | 319 | 311 | 131 ms | 146 ms |
| Austin | 943 | 303 | 303 | 103 ms | 126 ms |

Of San Antonio's eight, seven were paired by an irrigation permit alone and one by a gas, sewer or repair permit alone. They read as waiting again.

## The client

No client change. The skim, the ledger, Builders and Market read the same columns.

## Tested

`npm run test:pg:permit-skim`: the whole schema, then this file applied twice more after the two older files the bed re-runs, since those write `research_builders` and `research_permits_v4` as they stood. New in the probe:

- The rule answers each of the thirteen types above, and a permit with no type.
- In a city where the address ties, a sprinkler permit at a job's address closes nothing and names nobody on `research_permits`, v2's open count, v3's nearby count, v4's two days and `research_builders`. A plumber's permit beside it still closes its job and names him.
- In San Antonio a sprinkler permit on the open job's own number closes nothing, and another applicant's at the address is not counted as plumbing nearby.
- anon cannot run the helper.

`src/lib/research/bidSite.test.ts` holds the same thirteen types against `plumbingTypeOf`, so the two rules cannot drift apart unseen.

Docker is not ours on this Mac, so the PR's `sql-beds` check is the proof for the bed.

## Release order

`supabase db push` from a main checkout after the merge. Order against the client deploy does not matter: no client reads anything new.

**Applied** to prod by 2026-11-23: `npm run check:migration-drift` read 1,454 versions applied against 1,454 local files, this version among them (read in the docs pass after #9274); types regenerated in #9435.
