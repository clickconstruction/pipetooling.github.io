# 20260919025508_get_stages_enrichment_rpc.sql (2026-09-18, v2.3602)

Pipeline load speed PR 3 ([`docs/recent-features/v2.3602.md`](../recent-features/v2.3602.md)).

- **`get_stages_enrichment(p_job_ids uuid[]) RETURNS jsonb`** — `LANGUAGE sql STABLE SECURITY INVOKER`, `search_path = public`. One round trip for the Stages board's enrichment: `{ materials: {job_id: [rows…]}, fixtures: {job_id: [rows…]}, schedule_max: {job_id: 'YYYY-MM-DD'}, estimates: {job_id: [{estimate_number, title, status, updated_at}…]} }`. Materials and fixtures rows are `to_jsonb(row)` in `sequence_order`; `schedule_max` is `max(work_date)`; estimates are the banner candidates the client's `pickLinkedEstimateForStagesBanner` reads. SECURITY INVOKER, so each table's RLS applies exactly as it did to the client's own reads. `EXECUTE` to `authenticated` and `service_role`.
- Read against prod in a rolled-back transaction before merge: 114 non-paid jobs → the same per-table job counts as direct queries (2 · 93 · 70 · 4), 101 KB, 5.6 ms.

No table changes; `CREATE OR REPLACE`, idempotent. Apply order: the migration is in the PR that ships the client (`fetchStagesEnrichment` calls the RPC and falls back to the chunked passes when the call fails, so either deploy order is safe); push, then `npm run gen-types:linked`.
