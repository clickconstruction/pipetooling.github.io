# 20261102213000_hr_evidence_drive_cron.sql (2026-11-02, v2.6393)

The `hr-evidence-drive` sweep's cron (the People → Paperwork spike): `6,16,26,36,46,56 * * * *`, six minutes past the folder sweep's slot, `net.http_post` to `/functions/v1/hr-evidence-drive` with `{}` and the Vault `CRON_SECRET`, only while a `person_file_evidence` row has no `filed_at`. Unscheduled first so a second run leaves one row. No table is made, so no house calls.

**Apply order**: after `20261102210000_person_file_evidence.sql` (v2.6392), whose table the clause reads; then deploy `hr-evidence-drive` and `job-drive-folders`.
