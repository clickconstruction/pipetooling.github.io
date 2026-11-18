# 20261117100000_dev_seat_staging_bucket.sql (2026-11-16, v2.7510)

The dev seat's staging bucket, ahead of the verbs that use it (`plan_lien_filing` → `apply_lien_filing`, the PR after this one).

- **Bucket `dev-seat-staging`**: private, 10 MB a file, a PDF or a picture (`application/pdf`, `image/jpeg`, `image/png`, `image/heic`, `image/webp`).
- **Four policies on `storage.objects`** (`dev_seat_staging_select`, `_insert`, `_update`, `_delete`): a dev alone (`is_dev()`), and only inside the folder named for their own user id (`(storage.foldername(name))[1] = auth.uid()::text`). One dev's key never reads or replaces another's staged file. The update policy is there because an upload to a signed address is an upsert.

A file waits here between a plan and its apply: the plan hands back a signed upload address, the agent PUTs the file, the apply reads it back as the dev, files it in the job's Drive folder and removes it. Nothing is meant to stay.

No table, so no fence calls. Idempotent: the bucket insert is `ON CONFLICT DO NOTHING` and each policy is dropped before it is made.

**Apply order**: additive, and nothing reads the bucket until the next PR. Push at any quiet moment after the merge. The next PR's verbs need it, so push before that PR's function is deployed.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
