# 20260929210000_job_contracts_co_signer.sql (2026-09-29, v2.4186)

**What**: nine nullable columns on `job_contracts` for a second signer — `co_signer_name`, `co_signer_email` (what the office types on the draft) and the second frame's audit set, mirroring the first's: `co_signed_at`, `co_signer_printed_name`, `co_signer_mode`, `co_signer_consented_at`, `co_signer_ip`, `co_signer_user_agent`, `co_signer_signature_storage_path`. The `job_contract_events.event_type` CHECK gains `co_signed` (a frame filled while the other still waits).

**Why**: the Contract window's PR 4 (v2.4186) — counsel's homestead question (Prop. Code § 53.254(c): both spouses sign a homestead's improvement contract). One agreement, two frames: the office names the second signer on the paper, the customer's page shows a frame per signer, either may sign first, and the row reads `signed` (and `signed_at` is stamped) only when both frames are filled. The first frame keeps the `signer_*` columns, so every older row and every older reader is untouched.

**Risk**: additive, `IF NOT EXISTS`; no backfill, no index, no RLS change (the table's policies already cover the row). A client older than v2.4186 never writes the columns and reads NULLs — one signature closes the agreement as before. `sign-job-contract` deployed before the push would fail only on rows that name a co-signer, which no client can create before the push.

**Deploy with**: `supabase db push`, then `supabase functions deploy sign-job-contract get-job-contract share-job-contract` (the functions read and write the new columns), then the client. Regenerate `src/types/database.ts` after the push (the PR carries the columns by hand).
