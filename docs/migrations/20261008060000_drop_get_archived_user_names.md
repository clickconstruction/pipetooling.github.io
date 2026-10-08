# 20261008060000_drop_get_archived_user_names.sql (2026-10-07, v2.4859)

Drops `public.get_archived_user_names()`, the `SECURITY DEFINER` SQL function from the baseline that listed archived accounts' trimmed names. Punch list #29, item 3b. Since v2.4671 (live 2026-10-06) the five People surfaces it served read who is archived from `roster_people` instead (`archivedRosterNames` in `src/lib/people/rosterPeople.ts`).

- **Nothing depends on it.** No view, function, trigger, edge function or client call. `DROP FUNCTION` without `CASCADE` would refuse if one did.
- **No REVOKE.** The drop removes the function's grants, including the anon revoke from `20260906180000`.
- **Locks.** The function only. `SET lock_timeout = '3s'` heads the file.
- **Idempotent.** `IF EXISTS`, so a rerun is a no-op.
- **Old clients.** A build before v2.4671 ignores the call's error, so it loses only the archived fold.

Apply: `supabase db push` after merge. Then the types PR (3c) regenerates `src/types/database.ts` and dev-mcp's catalog. Verify: `POST /rest/v1/rpc/get_archived_user_names` as a signed-in user answers 404 with code `PGRST202`.
