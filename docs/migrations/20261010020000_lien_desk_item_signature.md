# 20261010020000_lien_desk_item_signature.sql (2026-10-09, v2.5077)

Lien desk signing, PR 1 of 3. Seven nullable columns on `job_lien_desk_items` hold the leader's electronic signature on a notice, and the guard trigger gains the rule that a signature is his own act.

- `signed_at timestamptz` — when he signed; NULL = unsigned.
- `signed_by uuid → users` — whose signature it is; always a master or dev.
- `signed_on_device_of uuid → users` — the signed-in user when he drew on someone else's screen (Leader here); NULL under his own sign-in.
- `signer_printed_name text` — the name the mark prints.
- `signer_signature_mode text` — `type` (one press placed the name in the cursive face) or `draw`; CHECK-constrained.
- `signer_signature_storage_path text` — the drawn PNG, `desk/<item id>/<uuid>.png` in the `lien-release-documents` bucket; NULL for a pressed signature.
- `signed_fields_hash text` — the hash of `fields` at signing. The client reads the signature only while the hash still matches the row's `fields`, so an edit after signing asks for his hand again.

The guard (`job_lien_desk_items_guard`, last redefined by `20261007010000_lien_pay_offer.sql`) is replaced whole with one block added: when `signed_at` is newly set, the row must name the signer, the mode and the printed name; the signer's `users.role` must be `dev` or `master_technician`; and unless the write is under the signer's own sign-in, it must say `signed_on_device_of = auth.uid()` with mode `draw`. The office can never place his name. Service-role writes (no `auth.uid()`) skip the own-sign-in check, as the offer rule does.

Additive and idempotent: `ADD COLUMN IF NOT EXISTS`, the CHECK added only when `pg_constraint` lacks its name, `CREATE OR REPLACE` on the function. No new table, so no read-only or digital-twin fences to re-apply.

## Out-of-band storage (run once, alongside `db push`, only before a drawn signature is first used — PR 2)

The drawn PNG goes in the existing private `lien-release-documents` bucket under `desk/<item id>/`. Its insert and select policies (`docs/migrations/20260902001517_lien_release_signing_foundation.md`) admit dev and assistant anywhere, but a master only under a release's own folder, so the leader drawing on his own phone needs two more policies (hr-files convention, not tracked by this ledger):

```sql
create policy lien_desk_signature_leader_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'lien-release-documents' and (storage.foldername(name))[1] = 'desk'
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('dev', 'master_technician', 'assistant', 'controller')));
create policy lien_desk_signature_office_select on storage.objects for select to authenticated
  using (bucket_id = 'lien-release-documents' and (storage.foldername(name))[1] = 'desk'
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('dev', 'master_technician', 'assistant', 'controller')));
```

A pressed signature stores no file, so PR 1 and the one-press path need neither policy.

## Order

1. `supabase db push` first; the columns are nullable and the old client never reads them.
2. The client (v2.5077) reads the columns through `signatureColumnsOf()` until the types are regenerated.
3. A follow-up `chore(types)` PR regenerates `src/types/database.ts` after the push.

## The lock note

`SET lock_timeout = '3s';` is first. Nullable columns with no default are catalog changes. The CHECK takes an ACCESS EXCLUSIVE lock for its scan; the table holds a few hundred rows. `CREATE OR REPLACE FUNCTION` takes no table lock.

## Verify after the push

1. `select column_name from information_schema.columns where table_name = 'job_lien_desk_items' and column_name like 'sign%' order by 1;` → seven rows.
2. `select count(*) from pg_constraint where conname = 'job_lien_desk_items_signer_signature_mode_check';` → 1.
3. `select prosrc like '%v2.5077%' from pg_proc where proname = 'job_lien_desk_items_guard';` → true.
4. Nothing written: `select count(*) from job_lien_desk_items where signed_at is not null;` → 0.

Then `npm run check:migration-drift`.

## Status

Pending push.

## Rollback

A one-off migration drops the seven columns and restores the guard from `20261007010000_lien_pay_offer.sql`.
