# 20260824144656_person_hr_file_attachments.sql — HR file exhibits metadata (v2.2231)

`person_file_attachments`: metadata + linkage for files (evidence exhibits,
statements, screenshots) attached to a person's HR file, optionally to a
specific raw entry (`entry_id`, SET NULL on entry delete — entries are never
deleted in practice). Bytes live in the **private `hr-files` storage bucket**;
`storage_path` is `<person_id>/<uuid>-<sanitized-filename>` and is UNIQUE.

Access: dev SELECT/INSERT/DELETE via `is_dev()`; `hr_agent` SELECT/INSERT via
role-scoped policies (no UPDATE anywhere — replace-and-note, like entry
corrections). Ends with both `apply_read_only_*` guards.

**Storage side is out-of-band** (matching how `estimate-acceptor-signatures`
and `contract-signer-signatures` were created — storage schema objects are not
in this migration ledger): the `hr-files` bucket (private) plus three
`storage.objects` policies (dev select/insert/delete on `bucket_id='hr-files'`).
Exact SQL in `docs/HR_FILES.md` § "Exhibits". Verify after setup with:
`select id, public from storage.buckets where id='hr-files';`
