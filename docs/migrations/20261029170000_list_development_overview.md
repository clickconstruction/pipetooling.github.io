# 20261029170000_list_development_overview.sql (2026-10-29, v2.6053)

The estimator's read of a development (punch list #208 PR 6, [v2.6053](../recent-features/v2.6053.md)).

**`list_development_overview(p_development_id uuid) RETURNS jsonb`**, `STABLE SECURITY DEFINER`, `search_path = public`. Refuses with `42501` when there is no signed-in user or the caller is outside `gc_office_team()` (dev, master_technician, assistant, controller, estimator), and with its reason when the development does not exist. Returns one object:

- `development`: `{ id, name }`.
- `bids`: the bids with `development_id = p_development_id`, oldest first: id, number, name, address, customer, estimator, account manager, outcome and its day, sent and due days, start date, plans link and plan date, the GC contact, created/updated, the archive stamp and who, service type, last contact, notes. **Not** `bid_value`, `agreed_value` or `priced_revenue_usd`.
- `jobs`: the jobs with `development_id = p_development_id`, oldest first: id, HCP and Click numbers, name, address, customer and its name, GC customer, bid, status, last work day, plans link, created/updated, service type, account manager. **Not** `revenue`, `payments_made`, `last_bill_date`, `pct_complete` or `collections_note`.
- `status_events`: the jobs' `job_status_events`, newest first, at most 500.
- `team_members`: the jobs' `jobs_ledger_team_members` (`job_id`, `user_id`).

`REVOKE ALL … FROM PUBLIC, anon`; `GRANT EXECUTE … TO authenticated`. A function definition takes no table lock; `SET lock_timeout = '3s'` first all the same. Idempotent (`CREATE OR REPLACE`). No table, no fences.

The page calls it only for a reader with no `jobs_ledger` SELECT (`developmentDoorFor` in `src/lib/developments/readDoor.ts`); the office keeps its direct reads, so this read widens nothing for anyone who already read the tables.

## Order

After PR 5 (v2.6048). Merge, `supabase db push`, then the types chore and `supabase functions deploy dev-mcp`. Client first is fine: until the push an estimator's page shows the retry panel with the function's absence as the reason, and the office is unaffected.
