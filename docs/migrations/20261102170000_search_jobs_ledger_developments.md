# 20261102170000_search_jobs_ledger_developments.sql (2026-11-02, v2.6358)

The header's global search finds a job by the name of its development. The owner, 2026-11-02: the Pipeline search "doesn't seem to include the names of developments"; v2.6354 (PR #6813) taught the Pipeline's own server search, and this migration is the global search's half.

- `search_jobs_ledger(search_text, include_billing_only)`: 20261031020000's body with one more OR in the WHERE — the job's `development_id` names a row of `public.developments` whose `name` ILIKEs the typed text, escaped by `escape_like_pattern` like every other column; archived developments count, since their jobs still carry the id. Same signature, same return columns, same numeric order and LIMIT 50, same billing-only rule. The comment names the new match; the REVOKE from `PUBLIC, anon` and the GRANT to `authenticated, service_role` are restated as 20261009130000 set them.
- The bed `gc_owner_billing` (scenario 4) puts the billing job in a development and reads it back by the development's name, by part of it in any case, not by another name, and not through the crew's search.

Idempotent (`CREATE OR REPLACE`); no table created, so no fence calls. Apply order: either side first — the client calls the function by the same name and arguments it had, so an old client on the new function and a new client on the old function both answer; `supabase db push` after v2.6358's merge.
