# 20261107210000_line_budget_settings.sql (2026-11-07, v2.6656)

**What it does**: one `app_settings` row for the company's line budget settings (punch list #234 PR 1b), so Settings → Jobs & billing → Line budgets has something to save and every reader of the line budgets reads the same numbers.

- `app_settings.line_budget_settings_v1` — `value_text` is the JSON `{ rateUsd, targetMarginPct, splits: { rough_in: [labor, materials], top_out, trim_set, any } }`, inserted with the constants v2.6300 shipped (rate $45, target 20%, 45/35 · 45/35 · 40/40 · 45/35) and never overwritten by a re-run (`ON CONFLICT DO NOTHING`).
- Policy `master_or_dev_update_line_budget_settings` — the owner (`is_master_or_dev()`) updates this one key; the table's existing SELECT lets every signed-in role read it. An UPDATE, not an upsert: the row exists from this migration, and the client says so when it is missing.

**Tables**: none created, so no fence is owed. **RLS**: one key-scoped UPDATE policy added, dropped and re-created on a re-run.

**Why one row and not five**: the four splits and the rate move together on one card and are read together on every line; one JSON row is one read and one write, and a shape change later is one key version (`_v2`), the way the map and bank settings are kept.

**Apply**: `supabase db push` from a clean checkout of `main` after this merges. The client reads the row fail-soft — the constants stand in until it is read, and a missing row reads as the constants — so the order against the Pages deploy does not matter; the Settings card's Save says *the setting row is missing, apply the v2.6656 migration* until the push.

**Check**: `select value_text from app_settings where key = 'line_budget_settings_v1'` reads the JSON; `select polname from pg_policies where tablename = 'app_settings' and polname = 'master_or_dev_update_line_budget_settings'` reads one row.
