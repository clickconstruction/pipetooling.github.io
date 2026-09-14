# 20260914160000_job_customer_gc_distinct.sql (2026-09-14, v2.3404)

A job's customer and GC are never the same party — the database half of the owner's 2026-09-14 rule (the form half is v2.3403).

- **Trigger `jobs_ledger_customer_gc_distinct`** (BEFORE INSERT OR UPDATE OF `customer_id`, `gc_customer_id`, function of the same name): a write that would put one customers row in both slots lands as a **GC job** — `customer_id`, `customer_name`, `customer_email`, `customer_phone` cleared, `bill_to_party = 'gc'`. Moves rather than rejects, so `merge_customers`, the RPCs, the edge functions and any older client all obey the rule without failing.
- **`job_bill_payer_customer_id(text, uuid, uuid)`** — one clause added: a GC with no customer link pays (mirrors the client's `effectiveInvoiceParty`, v2.3403). Still IMMUTABLE / PARALLEL SAFE.
- **The sweep** (data): every job with `customer_id = gc_customer_id` becomes a GC job the same way. 72 rows on 2026-09-14 — RMC- Dudley Mason 23, Knight Contracting 13, H & I Construction 6, Michael Palmer 6, Heron 4, the rest ones and twos; 34 billed · 15 paid · 15 working · 8 waiting; 71 were already on the *gc* rule (v2.3350), 1 on *customer* (the GC either way). Their property-record links (`customer_address_id`, rows on the GC's customer record) stay.

No new columns; `src/types/database.ts` unchanged. No CREATE TABLE, so no read-only-block calls. Idempotent: `CREATE OR REPLACE` / `DROP TRIGGER IF EXISTS`, and a re-run of the sweep matches no rows.

Apply order: **push after the v2.3403 client has deployed.** The older client gates *Send bill* on a customer link, so a GC job could not be billed from it until the new bundle is live; the new client reads a GC job as the GC paying. After the push, redeploy the importers of `_shared/billToParty.ts` (listed in `docs/recent-features/v2.3403.md`).
