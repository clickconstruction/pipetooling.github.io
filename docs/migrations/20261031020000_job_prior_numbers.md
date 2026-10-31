# 20261031020000_job_prior_numbers.sql (2026-10-31, v2.6226)

A job keeps the numbers it answered to before. The owner, combining the Gun Dog import shells: *HCP 550, 549, 548, 422, 178 and 130 were all House Call Pro numbers from the old system, so we don't want to lose the House Call Pro number here.*

- `jobs_ledger.prior_numbers text[] NOT NULL DEFAULT '{}'`: entries as the app writes them, `'HCP 550'` and `'C# 543'` (`src/lib/jobs/priorNumbers.ts` parses and labels them in the job's prefix, *JP550*).
- `migrate_job_ledger_costs_and_delete` (20260929123000's body, one UPDATE added before the revenue add): the target's `prior_numbers` gains the source's HCP #, its C# and the prior numbers it carried, each once, after the target's own.
- `search_jobs_ledger` (20261009130000's body, one EXISTS added): a typed number matches a prior number too, with the same `J` and ledger-prefix normalizing.

Additive and idempotent; no table created, so no fence calls. Apply order: with v2.6226's merge, `supabase db push`, then `npm run gen:types` for the column (the PR hand-adds `prior_numbers` to `src/types/database.ts` so the client typechecks; the generator's run replaces it). The client reads the column through `select *` on the Pipeline and through a read of its own on the Development page that fails soft, so no screen refuses to load before the push; push at the next quiet moment.
