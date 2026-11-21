# 20261121143500_person_report_photos.sql (2026-11-21, v2.8172)

Write someone up, the photos (punch list #410, PR 5; `to-dos/write-someone-up/`). One table, one private bucket and one small function. It ships alone, ahead of the screens that take and show the photos.

## What it does

- **`can_write_someone_up()`**: true for an active `dev`, `master_technician` or `superintendent`, the roles `land_person_report` takes a write-up from. `SECURITY DEFINER`, closed to `anon`, granted to `authenticated`.
- **`person_report_photos`** (id, press_id, author_user_id, storage_path, taken_at, bytes, width, height, created_at): one row a photo.
  - `press_id` is the write-up's press, the id the phone mints for it. `person_reports.press_id` carries the same id once the write-up lands, so a report's photos are found by it. No foreign key: a photo is sent before its write-up.
  - `storage_path` is unique, and names the object as `<author_user_id>/<press_id>/<photo_id>.jpg`.
  - `author_user_id` cascades with its user.
  - Two indexes: on `press_id`, and on `(author_user_id, created_at)`.
- **Row security.**
  - Read: a dev, or the row's own author. Nobody else, so not the person written about and not another leader.
  - Insert: as oneself, when `can_write_someone_up()`, and only with a path under one's own folder and that press.
  - Delete: one's own row while no report has landed on that press. Once the write-up is sent its photos stay.
  - No update. Every right is revoked from `anon` and `authenticated` first, since a new table in `public` starts with all of them, then `SELECT`, `INSERT` and `DELETE` are granted to `authenticated`.
- **The `person-report-photos` bucket**: private, 2 MB a file, images only.
  - Insert: the object's first folder is the caller's own id, and `can_write_someone_up()`.
  - Read: a dev, or the caller's own folder.
  - Delete: the caller's own folder, while no report has landed on the press its second folder names.
- The four fences close the file.

## Depends on

`20261121131500_person_report_write_up.sql`: the delete rules read `person_reports.press_id`.

## The bed

`npm run test:pg:person-report-photos` (`supabase/tests/person_report_photos/`, listed in `scripts/sql-beds.txt`): who adds a row, the paths refused, who reads, a photo dropped before the send and kept after. The bucket's own rules are not played by the bed.

## After the push

`src/types/database.ts` and the dev seat's catalog learn the table with the PR that first reads it.
