# 20260910230000_fix_users_update_policy_recursion_controller.sql (2026-09-10, v2.3254)

The `users` UPDATE policy recursion, fixed a second time (fragment `docs/recent-features/v2.3254.md`).

- **`is_user_notes_editor()`** now also returns true for `controller` (dev / master_technician / assistant / controller). Still `SECURITY DEFINER`, `anon` execute revoked.
- **`"Masters assistants devs can update user notes"`** on `public.users` is dropped and re-created `TO authenticated` with `USING / WITH CHECK (public.is_user_notes_editor())` — the shape 20260704120000 established. 20260903191916 (v2.2713) had rewritten it as an inline `EXISTS (SELECT 1 FROM public.users u …)`, which Postgres rejects at run time with *infinite recursion detected in policy for relation "users"*; since that push every authenticated `users` UPDATE (Active Accounts role change, training-mode toggle, user notes, profile edits) failed. Same roles admitted as the 09-03 policy; column rules stay in the `users_guard_privileged_columns` trigger.

Apply order: no client change — `supabase db push` as soon as the file is on `main`. Verify by changing a role in Active Accounts (People → Users → Manage accounts).
