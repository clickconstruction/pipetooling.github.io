# 20261026100000_customer_ratings

**v2.5876** — the customer's own word (measuring follow-ups item 6, after the Zendesk/Intercom comparison of 2026-10-26).

- `customer_ratings`: one row per rating ask — `contact_id` / `job_id` (no FKs: the ask outlives a merge or a delete), `customer_name`, `public_token` (plaintext, unique, like `job_contracts.public_token`), `asked_by` / `asked_at`, and the customer's `score` (1–5), `words` and `answered_at`.
- RLS: the office reads (`gc_office_team()`); no insert or update policies — writes go through `mint_customer_rating` (SECURITY DEFINER, office only, reuses a fresh unanswered ask to the same contact and job) and the `job-rating` function's service role.
- Ends with the three fences (`apply_read_only_write_blocks`, `apply_read_only_stmt_blocks`, `apply_digital_twin_write_blocks`), as every CREATE TABLE must.

Applied: pending `supabase db push` after merge.
