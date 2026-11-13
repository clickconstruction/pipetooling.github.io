# 20261112100000_first_look_thread.sql (2026-11-12, v2.6999)

First look on a person's thread (punch list #319 PR 1). The spike's tables and bucket (`20261112060000_first_looks.md`) were written only by the `first-look` function, for the owner and the developers. This opens the ask to the office team. No new table, so no fence call.

## What it does

1. **`mint_first_look(p_contact_id uuid) → jsonb`**: the office's ask. Makes the `first_looks` row for that thread (`label` the contact's name, `asked_by` the caller, `asked_by_name` their first name, good for 7 days) and answers `{ ok, id, code }`. The code is minted as an estimate's is (`share_estimate_link`): ten letters from the same 31, and only the SHA-256 is kept. SECURITY DEFINER.
2. **`stamp_first_look(p_look_id uuid, p_what text) → jsonb`**: `'looked'` stamps `looked_at` and `looked_by` the first time the office sees files on a look. `'closed'` stamps `closed_at` and `closed_by`. Each keeps its first stamp. SECURITY DEFINER.
3. **A SELECT policy on `storage.objects`** for the bucket `first-look-files`: the office team may sign a file to draw it, as it may in `message-attachments`.

## Who may do what

- **Both functions**: the office team (`gc_office_team()`). Anyone else is refused in words. `anon` has no EXECUTE.
- **A training account and a digital twin** are refused the mint and the close. Their look at a card stamps nothing and is not refused.
- **The bucket**: the office team reads. Nobody but the service role writes or deletes. The page still uploads through a one-file address the function signs.
- The tables' own policies are unchanged: the office team reads, nobody writes from the app.

## Release order

Merge, `bash scripts/db-push.sh`, then `supabase functions deploy first-look`. The client calls `mint_first_look`, which only this migration creates, so push right after the merge. Until then `/show` says the link was not made, and the card draws a file as a named chip.

## Verify

Read-only on prod after the push: `select proname from pg_proc where proname in ('mint_first_look','stamp_first_look')` reads two rows; `select has_function_privilege('anon', 'public.mint_first_look(uuid)', 'execute')` reads false; `select policyname from pg_policies where schemaname = 'storage' and policyname = 'first_look_files_select_office'` reads one row.

**Applied** to prod by 2026-11-13: the dev seat's `check_migration_ledger` read 1274 applied, this version among them, against 1274 files in `supabase/migrations/` (read in the docs pass after #7659); types regenerated in #7760.
