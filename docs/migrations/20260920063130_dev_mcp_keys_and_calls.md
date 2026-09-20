# 20260920063130_dev_mcp_keys_and_calls.sql (2026-09-20, v2.3640)

MCP servers, PR 4b-1 ([`to-dos/mcp-servers.md`](../../to-dos/mcp-servers.md)) — the two tables behind the `dev-mcp` edge function.

- New `dev_mcp_credentials` (`user_id`, `token_hash` unique sha256, `label`, `created_at`, `created_by` default `auth.uid()`, `revoked_at`, `last_used_at`) — per-dev keys, one per machine. RLS: devs read all (`is_dev()`), a dev **inserts only their own** (`is_dev() AND user_id = auth.uid()`), devs update (revoke). The key is generated in the browser and shown once; only the hash lands here. The function re-checks `users.role = 'dev'` (active, not a twin) on every call, so a demoted or archived dev's keys die without a revoke.
- New `dev_mcp_calls` (`credential_id`, `user_id`, `as_user_id` for `view_as`, `verb`, `target` = the RPC or table named, `args` jsonb, `status` ok · error · refused, `row_count`, `duration_ms`, `error`) — one row per `tools/call`. RLS: devs read; nobody writes through PostgREST — `GRANT ALL … TO service_role` for the function. Indexed by `created_at` and `(user_id, created_at)`.
- Ends with all three fence appliers (training-mode blocks + statement trigger + the twin write-fence). Comments on both tables.

Additive and idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`). Nothing reads either table until `dev-mcp` is deployed; the Settings card says "not switched on yet" until the push. **Push after the v2.3640 client deploy**, then deploy `dev-mcp`, then the `chore(types)` PR (which also regenerates `dev-mcp/catalog.ts`).
