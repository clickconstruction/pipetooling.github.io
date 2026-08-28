# 20260828080000 — twin_credentials (v2.2429)

Per-twin login tokens for the `twin-login` edge function (`docs/twins/TWIN_HARNESS.md`).

- `twin_credentials`: twin_user_id FK users, `token_hash` (sha256 hex, UNIQUE — plaintext
  never stored), label, created_at/by, `revoked_at`, `last_used_at`.
- RLS: dev-only SELECT/INSERT/UPDATE (mint/revoke from the dev console per the harness
  runbook); service_role full (the edge function's read + last_used_at bump).
- Ends with all three appliers: `apply_read_only_write_blocks()`,
  `apply_read_only_stmt_blocks()`, `apply_digital_twin_write_blocks()` (the new table's
  fence rows are deny-by-default for twins).
- Deploy order: push together with the twin-login v2 function deploy (function falls back
  cleanly — token path just 500s on a missing table, master path unaffected).
