# 20261123185500_license_roll_notes.sql (2026-11-23, v2.8380)

State roll, step three (punch list #411; `to-dos/state-roll/`). The office's own notes on a person on the state's roll, and the Leave off press that step one's `license_roll_left_off` was waiting for. It ships alone, ahead of the Everyone view and the person's sheet that call it.

## What it does

- **`license_roll_notes`**: a note a person here writes on a license on the roll.
  - Kept by the license's `source`, `license_class` and `license_number`, and the person's `name_key`, not by the roll row's id. A roll row is taken off when the person moves out of our counties, is left off or drops off the state's file, and a new rank is a new row with a new number. A note outlives all three. The sheet finds it again by the number, or by name and ZIP.
  - `body` is trimmed, never blank and at most 2,000 characters.
  - `noted_by`, `noted_by_name` and `noted_at` are stamped by the trigger `license_roll_notes_stamp`, whatever the client sent.
  - Read and written by the people who hold the Hiring switch (`user_can_read_license_roll()`). Only the author deletes a note. Nobody edits one.
- **`license_roll_left_off`** gains two columns and a delete.
  - `shown_as` holds the name and license as the sheet showed them, so the way back can say who it is. `noted_by_name` holds who pressed it.
  - A DELETE policy for the same gate. **Put back on the list** is that delete, and the next Monday pull keeps the person again.
- **`license_roll_leave_off(p_roll_id, p_note)`**: the press.
  - Refuses a caller without the Hiring switch, a training account, a digital twin and an archived account. A definer function runs past the row fences, so it holds them itself.
  - Refuses a person who holds one of our own licenses (`ours`), on the row pressed or another row of the same name and ZIP. Our own checks those against the state, and the pull would take them off too.
  - Writes the left-off row, once a number, with the number, the `name_key`, the note, `shown_as` and who pressed it.
  - Takes the person's rows off the kept roll at once, by number and by `name_key`, as the next pull would. Their `license_roll_changes` go with them by the cascade. Our notes stay.
  - Answers `{ left_off_id, taken_off, shown_as }`.
- The four fences close the file, and they cover the new table.

## Why the notes are not keyed by the roll row

The pull deletes a roll row in three cases: the person moved out of our counties, was left off, or was missing from the state's file for four weeks. A note keyed to the row would vanish with it, and the office would lose what it wrote. Keyed by number and by name and ZIP, a note is still there when the person comes back, and it follows a journeyman who makes master.

## Why Leave off takes the rows off at once

The next pull would take them off anyway. Doing it at the press means the person is gone from Everyone the moment the office is asked, not on Monday.

## Applying it

`supabase db push`, once the file is on `main`, then regenerate `src/types/database.ts`. The client that calls it ships in the next PR.
