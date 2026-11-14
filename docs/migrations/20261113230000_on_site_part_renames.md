# 20261113230000_on_site_part_renames.sql (2026-11-13, v2.7212)

Materials on site: fix a part's typed name. A name a crew types on site is the only name its line has, and `job_material_movements` takes inserts alone, so a typo could not be fixed. The one way was to count the line to zero and add it again under a new name, which reads as a shortfall and as a second delivery.

## What it makes

**`job_part_renames`**, insert only: `job_id`, `old_name`, `new_name`, `movement_ids` (the ledger rows the rename changed), `row_count`, `undo_of` (the rename a row takes back, once: a partial unique index), `by_user_id`, `by_name`, `at`.

Inserting a row is the act, as a sticker's placing is in `20261113020000_box_stickers.sql`.

## The triggers

- **`job_part_renames_judge`** (BEFORE INSERT, definer): refuses a signed-out caller, cleans the two names (trimmed, one space between words), refuses an empty new name, one past 160 characters and one equal to the old, and finds the job's ledger rows with `part_id IS NULL` whose cleaned name matches the old one whatever its capitals. For an undo it takes the named rename's rows that still carry its new name. It fills the row and writes nothing else. A rename that finds no row is **not** refused here: this runs before the caller's RLS is asked, and a refusal would tell a stranger which names a job holds.
- **`job_part_renames_apply`** (AFTER INSERT, definer): refuses a rename that found no row, in words (SQLSTATE `P0PRN`), then sets `part_name` on exactly the rows the judge found. It runs after the INSERT policy, so the caller may touch the job. **This is the one update of `job_material_movements`, and of the name alone**: never a quantity, a reason, a box or a time.

## The rules

- **Job wide, never one box.** A part moved between two boxes is one ledger row both boxes read, so a rename in one box alone would split the other box's line.
- **A typed name only.** A parts-book part reads its name from the book.
- **A rename onto a name another line has** makes the two one line. The record still knows which rows it changed, so its undo separates them again.
- **An undo** puts back the cleaned old name. Rows that differed only in capitals or spaces come back alike.

## Who may do what

| Table | Read | Write |
|---|---|---|
| `job_part_renames` | whoever may touch the job (`on_site_can_touch_job`, under the caller's own RLS) | insert by the same gate, the row's `by_user_id` the caller's own. Never updated, never deleted |

The four fences close the migration, so a training account, a digital twin and an archived account are held.

## Locks

One new table. Its foreign keys take a brief lock on `jobs_ledger` and `users`. No row of an existing table is read or changed, and `job_material_movements` gets no new trigger, column or policy. `SET lock_timeout = '3s'` makes a busy moment fail fast.

## Checked before the push

Applied twice to a throwaway local Postgres 15 with stub tables, then walked as a signed-in person on the job, a stranger and a signed-out caller: a rename of three rows spelled three ways, with the book part and another job's row left alone; the same rename again refused in words; the three refusals of a name; a direct update or delete of the ledger and of the record changing nothing; a stranger refused by RLS with no hint of what the job holds; a rename onto another line's name, its undo moving only the row it changed; an undo pressed twice; and an undo of a part renamed again since. The stub is not the app's schema and 15 is not 17, so the dry run at the push still matters.

## Release order

The client inserts into a table only this migration makes, so push right after the merge: `supabase db push` from `main` after a dry run. Until then **Fix the name** says the database's own refusal and changes nothing. The types follow as their own small PR.

## Verify

Read-only on prod after the push:

- `select count(*) from information_schema.tables where table_name = 'job_part_renames'` reads `1`.
- `select count(*) from job_part_renames` reads `0`.
- `select tgname from pg_trigger where tgrelid = 'public.job_part_renames'::regclass and not tgisinternal` lists `job_part_renames_judge` and `job_part_renames_apply`, with the fences' own.
- `select count(*) from pg_trigger where tgrelid = 'public.job_material_movements'::regclass and not tgisinternal` reads what it read before.
