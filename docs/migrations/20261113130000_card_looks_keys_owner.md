# 20261113130000 — card_looks_keys_owner (v2.7139)

The owner's role saves which looks and which card sizes the team is offered (punch list #313). Settings → People & teams → **Card and footer looks** upserts two `app_settings` rows: `card_looks_v1` (the looks on offer and the default, `20261111220000_card_looks.sql`) and `card_sizes_v1` (the sizes of the card's back on offer and the default, `20261111230000_card_sizes.sql`). Until now only the baseline's *Devs can manage app settings* admitted the write and the card was drawn for a dev alone, so an owner whose login is not a dev could neither open the card that approves a look nor save it.

- **`master_or_dev_insert_card_looks_keys`** (`FOR INSERT TO authenticated`) and **`master_or_dev_update_card_looks_keys`** (`FOR UPDATE TO authenticated`): the two keys and `is_master_or_dev()`, the shape of `master_or_dev_*_bridge_cash_keys` (`20261112013000`). An upsert needs both, though both rows are seeded.
- No delete policy: the card never deletes these rows.
- The table's restrictive write fences (read-only, digital twin, archived) still apply. No table is created, so no fence call is owed.
- Idempotent: each policy is dropped if it exists and made again.

Checked before the PR on a local Postgres 15 with the baseline's table, its two general policies and the real role helpers, the file applied twice, the card's own upsert played as each role. Before the file the owner is refused on both keys with `42501`. After it the owner saves both and is refused on any other key, seeded or new; the assistant, the controller and the estimator are refused on every key; the dev is unchanged. The restrictive fences were not in that bed: this file does not touch them.

Deploy order: none. The client calls nothing this file creates. Since v2.7139 the card is drawn for the owner, whose save passes once this is pushed; until then it is refused, the switch goes back and the card says he has no permission to save.

Rollback: `DROP POLICY IF EXISTS master_or_dev_insert_card_looks_keys ON public.app_settings; DROP POLICY IF EXISTS master_or_dev_update_card_looks_keys ON public.app_settings;`. A dev alone writes the two rows again.
