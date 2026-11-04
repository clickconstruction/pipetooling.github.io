# 20261103180000 — dev_person_license_write (v2.6475)

The dev MCP's dry-run wrapper for a teammate's license: `plan_license` → `apply_license` in `dev-mcp` (punch list #255). The owner asked that dev-mcp can update users' licenses and their expirations. One `SECURITY DEFINER` function, `dev_person_license_write(p jsonb, p_dry_run boolean DEFAULT true)`, gated by `auth.uid()` and `is_dev()`, closed to `anon`, modeled on `dev_legal_gap_answer_write` (`20261028120000`).

- **The input.** `p` is `{ action (add | update), license_id? (update), person_name, license_type, date_of_expiry (YYYY-MM-DD), note? }`. dev-mcp writes `license_type` with the logbook's `licenseTypeText`, so the words always read back as the same trade, level and number.
- **Add.** The name must match a `people` or `users` name exactly. A row with the same person and the same words is refused: plan an update instead.
- **Update.** It needs the `license_id`. The license never moves to another person. A note left out keeps the note on record.
- **No delete.** A lapsed license gets its new date. The Licenses tab keeps Delete.
- **The dry run** returns the person, the license `before` and `after`, `expired` (the new date already past, on Central time) and every license the person holds. The plan hash commits to `before`, so a change since the plan makes apply refuse.
- **The write.**
  - The row is written as the dev. An update that moves the date later clears `expiry_dispatch_notified_at`, so the renewed license's next expiry warns Dispatch again.
  - It then calls `notify_dispatch_license_expiry_if_needed` with the Licenses tab's link, as that tab's Save does.
  - It answers `dispatch_request_id`, which dev-mcp sends through `notify-dispatch-request`.
- **No table is created**, so no read-only fence is owed. Training mode is still blocked by `person_licenses`' statement trigger.

Deploy order: push this migration, then deploy `dev-mcp` (server 0.24.0). After the push, regenerate `src/types/database.ts` and the dev-mcp catalog (`node scripts/build-dev-mcp-catalog.mjs`) so `find_rpc` lists the function.
