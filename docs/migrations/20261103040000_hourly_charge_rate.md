# 20261103040000_hourly_charge_rate.sql (2026-11-03, v2.6431)

The rate the company charges for an hour (punch list #251, PR 1).

- **`app_settings.hourly_charge_rate_v1`** — `value_num`, seeded 285.00 (`ON CONFLICT DO NOTHING`, so a rate the office has set stays). Settings → Jobs & dispatch reads and writes it; the hours charged statement prices a worker's hours at it when the job has no rate of its own.
- **`jobs_ledger.hourly_charge_rate numeric`** — nullable, over zero when set (`jobs_ledger_hourly_charge_rate_positive`, left `NOT VALID` because every row is null today and the file is one transaction). Null = the company's rate. PR 2's statement window and Edit Job write it.
- **No table, no policy, no fence calls**: both homes already have them.

**Apply order**: the client reads the setting with a fallback of $285.00 and nothing reads the column until PR 2, so the client may deploy first or last.
