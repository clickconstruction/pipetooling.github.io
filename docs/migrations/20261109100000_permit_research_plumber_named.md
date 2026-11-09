# 20261109100000_permit_research_plumber_named.sql (2026-11-09, v2.6785)

Research: the plumber is named only when the plumbing permit names someone other than the building permit's applicant (punch list #292, PR 3; `to-dos/permit-research/`).

## What it does

`CREATE OR REPLACE` of **`research_permits(p_city, p_since, p_residential)`** with the same return shape. The `plumbing` step now carries, per paired plumbing permit, whether its number differs from the building permit's (a trade-pulled MEP number) and whether its contact's `research_name_key` differs from the building permit's applicant; `paired` takes the plumber from the rows that name someone else, own-number rows first and newest first, and the day from any plumbing row. A commercial job whose plumbing permit was pulled under the GC's own name therefore reads taken with no plumber named.

No table, no fences, no function to deploy.

## Release order

Merge the PR, `supabase db push`. The next `chore(types)` regen also picks up 20261109080000's two functions, which the regen in #7446 predated.
