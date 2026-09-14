# 20260914243000_job_demand_letters_exhibits.sql (2026-09-14, v2.3429)

Two columns on `job_demand_letters` for the *Demand letter, itemized* train (PR 2, `to-dos/demand-letter-itemized/`). Additive; idempotent; no table created, so no read-only appliers needed.

- **`exhibits jsonb`** (default `[]`) — what went out behind the letter: `[{ label: 'A' | 'B' | 'C', title, pages }]`. A is the invoice as the customer received it (always), B the signed agreement when the job has one, C the delivery record (the dated sends the letter cites).
- **`debtor_party text`** (default `''`, check `'' | customer | gc | other`) — who the letter was demanded of, by the covered invoice's own who-pays rule (v2.3425). Empty on rows recorded before this.

Apply order: additive. The client (v2.3429) inserts both columns and falls back to the old insert shape when the columns are not there yet, so either order is safe; push right after the client deploys.
