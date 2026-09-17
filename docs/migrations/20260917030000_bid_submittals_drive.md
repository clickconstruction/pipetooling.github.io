# 20260917030000 — bid_submittals.drive_file_id / _url / drive_filed_at (v2.3552, Submittals stage 6c)

Three nullable columns on `bid_submittals`: the Drive file id and link of the filed package PDF (`Submittals/Rev N · date.pdf` in the bid's job folder) and when it was filed. Written by `file-submittal-package` with the service role; read by the Submittals tab (*filed in Drive ↗*). No table, no policy change. Idempotent. Apply with `bash scripts/db-push.sh` once on `main`; deploy `file-submittal-package` and `drive-intake` after.
