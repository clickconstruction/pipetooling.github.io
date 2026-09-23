# 20260923120000_job_name_from_estimate_customer.sql (2026-09-23, v2.3748)

**Purpose**: a job made at signature by *Create jobs automatically* is named for the customer, not "Estimate for <customer>" — the SQL twin of the Create job window's seed (`src/lib/jobFromEstimateDefaults.ts`).

**Changes**
- `public.auto_create_job_from_signed_estimate(uuid)` re-created — the `20260905110000` body with: the linked customer's name read into `v_cust_name`; `v_name` is that name when the estimate's title is empty, a placeholder, or matches `^(estimate|change order) for\s` (case-insensitive), else the trimmed title (else `Job from signed agreement`), computed before guard 2; guard 2 folds `v_name` rather than the raw title. Signature, return type, guards, the fixtures mapping, the actor switch and the telemetry row are unchanged. `COMMENT ON FUNCTION` updated.

**Idempotent**: `CREATE OR REPLACE`. No table. **Order**: after `20260922190000`; client and migration are independent (the window has its own copy of the rule), so either may go first.
