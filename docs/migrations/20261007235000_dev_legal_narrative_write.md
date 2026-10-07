# 20261007235000_dev_legal_narrative_write.sql (2026-10-07, v2.4814)

One function for dev-mcp's `plan_matter_narrative` / `apply_matter_narrative` ([v2.4814](../recent-features/v2.4814.md)). The Legal desk's `legal_set_narrative` (`20261007234000`) has no dry run, and dev-mcp writes only through dev-gated dry-run wrappers, so a dev's agent could neither preview nor save a matter's narrative.

- `dev_legal_narrative_write(p jsonb, p_dry_run boolean default true)`: `SECURITY DEFINER`, `search_path = public`, raises `42501` unless `auth.uid()` is set **and** `public.is_dev()`. Checks `p.matter_id` names a matter and the trimmed `p.markdown` is at most 40,000 characters.
- With `p_dry_run = true` it writes nothing and returns `{ dry_run, matter { id, payer_name, stage }, before { chars, saved_at }, after { chars }, firm_reads_it }`. `firm_reads_it` is the portal's own rule: a stage in `LEGAL_PORTAL_STAGES`, not closed, with a firm. The plan hash covers `before.saved_at`, so a save by anyone since the plan makes apply refuse.
- With `p_dry_run = false` it calls the **live** `legal_set_narrative(matter_id, markdown)` unchanged, which stamps the dev as the writer from the session, and returns `{ ok, matter_id, chars }`; an `{ error }` from it is raised.
- EXECUTE revoked from `PUBLIC` and `anon`, granted to `authenticated` (the gate is inside).

No `CREATE TABLE`, so no fence appliers; training mode still blocks the write, because the statement blocks on `legal_matters` fire inside the definer. Idempotent (`CREATE OR REPLACE`), no locks beyond the catalog.

## Order

After `20261007234000` (it calls `legal_set_narrative`). Push, then `supabase functions deploy dev-mcp`. Until the push, `plan_matter_narrative` answers PostgREST's "function not found". The verb names are fixed in `_shared/devMcpWrites.ts`, so the verbs need no catalog regeneration; run `npm run gen-types:linked` → `node scripts/build-dev-mcp-catalog.mjs` after the push so `find_rpc` lists it too.
