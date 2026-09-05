# 20260905090000_users_select_requires_session

**`public.users` SELECT requires a signed-in user (v2.2837, journey map J24-N1)** — `DROP POLICY IF EXISTS` + `CREATE POLICY "Users can select users"`.

## What it does

The baseline policy (widened for controller by `20260714213000_controller_capabilities.sql`) keyed most of its disjuncts on the row's role with no `auth.uid()` term and no `TO authenticated`, so every non-archived assistant / controller / estimator / primary / helpers / subcontractor / superintendent row was readable with the anon key alone — the key in the public JS bundle. Live-proved 2026-09-04 (id + name rows, zero session).

The rewrite keeps the disjunct list verbatim and wraps it in `FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (…))`. Signed-in roles read exactly what they read before; anonymous callers read nothing. Service-role (edge functions) bypasses RLS; the public pages reach `users` only through SECURITY DEFINER RPCs.

No `CREATE TABLE`, so the read-only training fences are not re-applied here.

## Order

Any time after `20260905080000`. Independent of the client PR — the old client never read `users` anonymously except on the deleted `/sign-up` page.

## Verify

`curl -s "$SUPABASE_URL/rest/v1/users?select=id,name&limit=5" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"` → `[]`. Any signed-in JWT → the same rows as before.

## Rollback

Re-create the policy with the same `USING (…)` body minus the `(SELECT auth.uid()) IS NOT NULL AND` wrapper and without `TO authenticated` (the body is in the migration file).
