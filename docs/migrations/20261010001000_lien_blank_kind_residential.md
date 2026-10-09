# 20261010001000_lien_blank_kind_residential.sql (2026-10-09, v2.5031)

A property whose kind is not set dates as residential, the earlier date. The owner's call of 2026-10-09 (lien punch item K), sent by Punchlist. The earlier date is the safe one: a house read as commercial loses its lien a month late.

## What it does

`CREATE OR REPLACE` of the two SQL deadline functions. Signatures, `LANGUAGE plpgsql IMMUTABLE` and grants are unchanged; `CREATE OR REPLACE` keeps the ACL. The file is idempotent and starts with `SET lock_timeout = '3s'`.

| Function | Before | After |
|---|---|---|
| `lien_notice_deadline(p_month, p_property_kind)` | `CASE WHEN p_property_kind = 'residential' THEN 2 ELSE 3 END` | `CASE WHEN p_property_kind = 'non_residential' THEN 3 ELSE 2 END` |
| `lien_filing_deadline(p_month, p_property_kind)` | `CASE WHEN p_property_kind = 'residential' THEN 3 ELSE 4 END` | `CASE WHEN p_property_kind = 'non_residential' THEN 4 ELSE 3 END` |

Everything else in the bodies is verbatim from prod, read with `pg_get_functiondef` on 2026-10-09: the month check, the 15th, the weekend roll.

A blank kind (`''`, the default on `customer_addresses`) and a job with no property record (`COALESCE(ca.property_kind, '')` in the readers) now get the earlier month. So does `NULL`. Only `non_residential` gets the later month, the same rule as the client's `src/lib/jobs/lienDeadlines.ts` (`lienCommercialClock`).

Every RPC that calls the two functions follows without a change of its own. The callers are the 12 migrations that name them: `list_lien_notice_months`, the affidavit queue, `list_gc_unpaid_months`, the owner-confirm lists and the service-role grants. No index or generated column uses them.

## On prod when written

2 open GC jobs had a blank kind, $500 between them: **1073** *Antonio Pretest* and **1074** *Decker Pretest*, both Done Right Foundation, both created 2026-10-08 with no property record. Beside them were 32 residential and 16 commercial open GC jobs.

The October notice for each read **2027-01-15** before this migration and reads **2026-12-15** after it.

## Push

- After the PR merges. If that is before 09:12 UTC on 2026-10-09, it rides GC MODE's batch. Otherwise Punchlist pushes it after that batch, because the held `20261009140000` blocks a plain push until then.
- Order with the client does not matter: an old client reading the earlier server dates is fine.

## Verify after the push

- `SELECT public.lien_notice_deadline('2026-10', '')` reads `2026-12-15`. `public.lien_notice_deadline('2026-10', 'non_residential')` still reads `2027-01-15`.
- `list_lien_notice_months` (or `list_gc_unpaid_months`) with a window wide enough to reach December lists 1073's October month with the deadline **2026-12-15**.

## Checked before the PR

On Homebrew Postgres 15 the file was applied twice, so it is idempotent. For August it reads: `''` and `NULL` give the notice 2026-10-15 and the affidavit 2026-11-16; `residential` gives the same; `non_residential` gives 2026-11-16 and 2026-12-15. A malformed month still returns `NULL`. These match the client kernel to the day.

## Status

Merged as v2.5031 (#5098) and pushed alone on 2026-10-09 (drift 814 of 814) — the only pending file and the lowest number. Verified read-only over the session pooler: `lien_notice_deadline('2026-10', '')` reads 2026-12-15 and `'non_residential'` 2027-01-15; `lien_filing_deadline` 2027-01-15 vs 2027-02-15. The nine portal functions that bundle `customerSampleFixtures.ts` redeployed from the main checkout (edge drift all 144 current).
