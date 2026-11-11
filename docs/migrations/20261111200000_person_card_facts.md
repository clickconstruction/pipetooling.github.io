# 20261111200000_person_card_facts.sql (2026-11-11, v2.6941)

The ground under Cards and footers (punch list #313, PR 1; `to-dos/cards-and-footers/README.md`). Today a person's business card and email footer are flat pictures a designer made by hand. The app will draw them from the person's own row. It already holds a name, a title, an email and a phone. This adds the three things it lacks, and a private home for a headshot. No screen reads them yet.

## What it does

1. **Three columns on `users`**, all nullable, added in one `ALTER TABLE`:
   - `card_name text`: the name printed on the card and the footer. The account name is a first name for most people. Null means the account name stands in. `users_card_name_short` holds it to 80 characters.
   - `photo_path text`: where the person's headshot sits in the bucket. `users_photo_path_own_folder` holds it under the person's own folder, `<users.id>/…`, so one person's row can never point at another person's picture.
   - `photo_crop jsonb`: where the photo sits in its ring, `{"fx": 0-1, "fy": 0-1, "zoom": 1 and up}`. The app writes it and reads it back in range (`readCrop` in `src/lib/brandKit/person.ts`, a later PR). The photo is kept whole.
2. **`GRANT UPDATE (card_name, photo_path, photo_crop)`** to `authenticated`, by name, as `title` and `signature_lines` were. Prod already grants the whole table, so the line changes nothing there. It keeps the convention.
3. **The private bucket `person-photos`**: 2 MB a file; JPEG, PNG or WebP; `<users.id>/<file>`.
4. **Four policies on `storage.objects`**, `person_photos_files_select`, `_insert`, `_update` and `_delete`. A person reads and writes their own folder. The office (`is_office_staff()`: dev, master_technician, assistant, controller) reads and writes every folder.

## Why the shape

- **Who may write the columns** needs no new policy. A person writes their own row through "Users can update own profile". The office writes anyone's through "Masters assistants devs can update user notes", the same four roles. `users_guard_privileged_columns` does not name the new columns. The table's fences already keep a training account, a digital twin and an archived login from writing.
- **The office can write a teammate's photo** because the office makes a card for a teammate from People → Users.
- **Each write policy on the bucket says `NOT is_read_only()` and `NOT is_digital_twin()` itself.** `storage.objects` has no training-mode or twin fence of its own. `archived_fence` already keeps an archived login out of every bucket.
- **A uuid pattern guards the first folder** before it is compared with the caller's id, so a stray path is refused, not cast.

**Tables**: none created, so no fence call is owed. **Data**: none moves. **Lock**: adding nullable columns and two CHECKs takes a brief `ACCESS EXCLUSIVE` lock on `users`; the CHECKs scan a small table whose new columns are all null. With `lock_timeout = '3s'` a busy moment fails fast and the push is retried.

**Apply**: `supabase db push` from a clean checkout of `main` after this merges, in any order against the Pages deploy. Nothing in the client reads the columns or the bucket yet, and the screens that follow read them fail-soft.

## Verify

Tried before the PR on a local Postgres 15 with stand-ins for `auth.uid()`, `storage` and the three helpers: the file applied twice, and fourteen probes ran as five accounts. A helper added a photo to their own folder and was refused another person's folder and a path with no folder. An assistant added one for a teammate. A training account and a twin were refused. A helper saw one photo, the office saw all. A row took a path under its own folder and refused another person's, and refused an 81 letter name.

**Check** on prod after the push:

```sql
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'users' and column_name in ('card_name', 'photo_path', 'photo_crop');
select id, public, file_size_limit from storage.buckets where id = 'person-photos';
select policyname from pg_policies where schemaname = 'storage' and policyname like 'person_photos_files_%';
```

Three columns, one private bucket at 2097152, four policies.
