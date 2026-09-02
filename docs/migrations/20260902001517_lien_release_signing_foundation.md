# 20260902001517_lien_release_signing_foundation

**v2.2616 — PR 1 of the lien-release signing loop** (owner-approved mockups; PR 2 modal rework, PR 3 activity/documents surfaces, PR 4 send loop).

## What it does

- `job_lien_releases` grows the document lifecycle: `status` (`draft` → `issued` → `awaiting_signature` → `signed`; existing rows default to `issued`), mint stamps (`minted_at`, `minted_pdf_path`), signature-request fields (`signature_requested_at/by`, `signer_user_id`), signature capture (`signed_at`, `signer_printed_name`, `signer_signature_mode` type|draw, `signer_signature_storage_path`, `signer_consented_at`, `signed_pdf_path`), send stamps (`sent_to_customer_at`, `sent_channel` email|manual, `sent_by`), and `voided_by`.
- Backfills `minted_at = created_at` on existing rows.
- Partial indexes for the two inbox lanes (awaiting-signature by signer; signed-not-sent by requester).
- `job_lien_releases_to_activity()` trigger (AFTER INSERT OR UPDATE) writes five `job_activity_events` types, all `financial = true`, idempotency-guarded per type: `lien_release_issued`, `lien_release_signature_requested`, `lien_release_signed`, `lien_release_sent`, `lien_release_voided` (re-requests/re-sends key `source_id` by timestamp). Client render-registry entries land in PR 3 — until then the events are written and simply not rendered (the feed drops unknown types by design).
- Backfills `lien_release_issued` / `lien_release_voided` events for existing rows.

## Out-of-band storage setup (run once, alongside `db push`)

The private `lien-release-documents` bucket holds signature PNGs and the stored mint/signed PDFs. Buckets and `storage.objects` policies are not tracked by this ledger (hr-files convention):

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lien-release-documents', 'lien-release-documents', false, 5242880, array['image/png', 'application/pdf'])
on conflict (id) do nothing;

create policy lien_release_docs_office_select on storage.objects for select to authenticated
  using (bucket_id = 'lien-release-documents' and (public.is_dev() or public.is_assistant() or exists (
    select 1 from public.job_lien_releases r join public.jobs_ledger jl on jl.id = r.job_id
    where (storage.foldername(name))[1] = r.id::text and jl.master_user_id = auth.uid())));
create policy lien_release_docs_office_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'lien-release-documents' and (public.is_dev() or public.is_assistant() or exists (
    select 1 from public.job_lien_releases r join public.jobs_ledger jl on jl.id = r.job_id
    where (storage.foldername(name))[1] = r.id::text and jl.master_user_id = auth.uid())));
create policy lien_release_docs_dev_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lien-release-documents' and public.is_dev());
```

Object paths: `<release_id>/<uuid>.png` (signature), `<release_id>/minted.pdf`, `<release_id>/signed.pdf`.

## Ordering

Additive only — old clients ignore every new column, and unknown activity types are dropped by the feed. Safe to push before or after the client deploy.
