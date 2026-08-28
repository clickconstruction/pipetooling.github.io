# 20260828060000 — users.is_digital_twin (v2.2426)

Digital twins Phase T1 (`docs/DIGITAL_TWINS_PLAN.md`): one additive column,
`users.is_digital_twin boolean not null default false`.

- The flag lives on the ACCOUNT: attribution rides `created_by`; the client shows a 🤖
  banner for flagged sessions; Active Accounts chips flagged rows.
- Human-metric surfaces may exclude twins with `AND NOT is_digital_twin` — added per
  surface as twins actually touch them (precedent: `hide_dev_tally_transactions`'s
  `role <> 'dev'`), never blanket-applied.
- No RLS/policy changes; no new table (the `twin_runs` ledger is a later migration).
- Client deployed first and reads the column via fail-soft queries, so push order is safe
  either way; push promptly after merge per the usual rule.
