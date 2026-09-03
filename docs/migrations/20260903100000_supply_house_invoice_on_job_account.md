# 20260903100000_supply_house_invoice_on_job_account.sql (2026-09-03, v2.2669)

Adds `supply_house_invoices.on_job_account boolean NOT NULL DEFAULT false` — Taunya's flag for invoices riding on a supply house's **job account** (the account the house opens against the property owner; setup packet flow: v2.1605 "Share with supply house"). We still pay the house as usual; the flag records that an unpaid balance is the owner's exposure, not ours. Risk classification only: no AP total, job cost rollup, Dashboard financial, or Moneyfill sum excludes flagged invoices.

Additive `ADD COLUMN IF NOT EXISTS` with a default — metadata-only on PG 15, no table rewrite.

**Apply-order note**: push promptly after the client merge, but the window is safe both ways — the Job Accounts tab falls back to a select without the column (all flags read false), and invoice saves only send `on_job_account` when the value changes. Only actually *flagging* an invoice needs the column to exist.
