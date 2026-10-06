# 20261006160500_revoke_sweep_helpers_from_api.sql (2026-10-06, v2.4686)

Revokes EXECUTE on the three CREATE TABLE sweep helpers, `apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and `apply_digital_twin_write_blocks()`, from `PUBLIC`, `anon` and `authenticated`. They are `SECURITY DEFINER` in the API-exposed `public` schema and no migration had revoked them. So the default privileges let anyone holding the anon key `POST /rest/v1/rpc/<helper>` and run DDL-capable code as `postgres`. They slipped the 2026-09-06 audit (`20260906180000_revoke_anon_rpc_exposure.sql`). Until `20261005222937_twin_fence_skip_existing.sql` (v2.4604), the twin fence helper dropped and recreated every fence policy on each call, so one anonymous request locked every RLS table until it finished.

All three now only add what is missing. Nothing outside migrations calls them: no edge function, client code, script, trigger or function body. So the API roles lose EXECUTE outright. The owner (`postgres`, which `db push` runs as) and `service_role` keep it, and a later `CREATE OR REPLACE FUNCTION` keeps these grants.

Two guards in the file:

- **An assertion after the REVOKEs.** A `DO` block fails the migration unless `anon` and `authenticated` really lost EXECUTE. Run by a role without the owner's rights, `REVOKE` only warns "no privileges could be revoked". Without the assertion the migration would record as applied with nothing changed.
- **A self-test call at the end.** The file calls all three helpers, so the role `db push` runs as must still be able to. If it could not, every later CREATE TABLE footer would fail. With every table already covered, each call creates nothing and takes no table locks.

Rehearsed on a throwaway Postgres 15.14 (prod is 17.6) in 24 checks, with a Supabase-like layout. A non-superuser owner stood in for `postgres`, beside `anon`, `authenticated` and `service_role`. Default privileges granted new functions to the API roles, and a login role inherited the owner, like the CLI's.

- Before: both API roles could execute all three.
- A login role without the owner's rights: the REVOKEs only warned, the assertion aborted the migration, and the grants were unchanged.
- Applied in one transaction as the inheriting login role: the self-test printed `0 0 0`.
- `anon`, `authenticated` and `PUBLIC` lost EXECUTE. A call as either role was refused with `permission denied for function …`.
- The owner, the login role and `service_role` kept EXECUTE.
- A CREATE TABLE footer still ran on a new table (`3 1 3`).
- A later `CREATE OR REPLACE` of the twin helper kept the revoke, and a rerun was idempotent.

Apply: `supabase db push` after merge. It only changes grants and makes three no-op calls: no table locks, no client coupling, no types change. Verify after the push: `POST /rest/v1/rpc/apply_read_only_stmt_blocks` with the anon key answers `401` with code `42501`.
