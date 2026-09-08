# 20260908035852_address_geocodes_all_roles.sql (2026-09-07, v2.3131)

"Your jobs on a map" Dashboard card for every role ([fragment](../recent-features/v2.3131.md)).

- **`address_geocodes`** — the shared address → lat/lng cache the office Map page fills. Its SELECT / INSERT / UPDATE policies admitted only dev / master_technician / assistant / estimator (the pre-baseline `20270520120000` migration), so controller, primary, superintendent, subcontractor and helpers could neither read a cached pin nor let `geocode-address-batch` (which reads and upserts through the caller's JWT) fill one. The three policies are dropped and recreated `TO authenticated USING ((SELECT auth.uid()) IS NOT NULL)`; **DELETE stays with the Map roles** (Settings → Review geocodes).
- The cache holds no ownership and nothing a signed-in user cannot already read on the job rows that carry the address. Read-only (training mode) users are still blocked from the writes by the restrictive `read_only_*` policies on the table; the redeployed edge function tolerates that refusal.
- No new table → no fence appliers. Idempotent (`DROP POLICY IF EXISTS` + `CREATE`).

Apply order: push any time — the old client never selects the cache for these roles, and the new client degrades to "no map location yet" until the push lands. Deploy `geocode-address-batch` alongside.
