# 20260916190000_card_refunds_net_sql_readers.sql (2026-09-16, v2.3525)

PR 2 of the card-refunds train (client rule in v2.3519). Replaces six functions so the database-side cost readers stop taking `ABS()` of a Mercury job allocation and read it as signed cost (`-a.amount`): a purchase is positive cost, a refund at the counter is negative and nets.

| Function | Feeds | Change |
|---|---|---|
| `get_paid_job_email_payload` | the paid-job email's parts total and charge timeline | `-a.amount AS amount` in the charge events, `SUM(-a.amount) AS parts_cost` |
| `get_billed_aging_costs` | Billing → aging cost column | `SUM(-a.amount)` |
| `get_paid_profit_stats` | Dashboard paid-profit chart | `SUM(-a.amount)` |
| `partner_job_cost_buckets` | partner profit share | `SUM(-a.amount)` |
| `partner_job_costing_payload` | the partner's per-job costing (via `get_my_partner_job_costing` / `get_partner_job_costing_as`) | `ROUND((-a.amount)::numeric, 2)` on the allocated line |
| `keep_job_baseline` | the kept baseline's parts figure | `sum(-coalesce(m.amount, 0))` |

Each body is the newest definition (four from `20260907130000`, one from `20260821150000`, one from `20260912052042`) with only the sign expression changed; no signature, table or grant changes, so `CREATE OR REPLACE` keeps existing grants and the v2.2954 revokes. `get_weekly_money_movement_payload` already negated (`20260807060000`) and is untouched.

Apply order: independent of the client — the v2.3519 client and this migration each fix their own readers; push after merge with `bash scripts/db-push.sh`. No edge function redeploy: `paid-job-email` calls the RPC at send time and its renderer already draws a negative charge amount as money back (v2.3500).
