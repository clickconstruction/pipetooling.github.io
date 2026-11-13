# 20261113080000 — person_file_numbers (v2.7106, punch list #315 upgrade 2)

Rows the system numbers. On a large HR file the numbers lived in prose: an evidence record's number was typed into its title, and the next free number, the case's open items and its log were lines in the *Agent notes* document. Two sessions on one file on one day took the same exhibit number and the same item number.

**`person_file_counters`** — one row a person: `next_exhibit_no`, `next_item_no`. Moved only by `person_file_take_number(person, what, explicit?)` (definer, executable by nobody but the functions here) under a row lock, so two writers at once get two numbers. A dev reads it; nobody writes it.

**Exhibit numbers**

- `person_file_evidence.exhibit_no` (positive, unique a person). The trigger `person_file_evidence_number` sets it on every insert; a number the client sends is ignored. A record made before this migration keeps `exhibit_no` null and its title as typed.
- The first number a file hands out is one past the highest number any of its titles opens with (`exhibit_title_opens_with`, which counts `Ev #41a` as 41), so a new record never takes a number an old title wears.
- `exhibit_no_from_title(title)` reads the one form the files use: `Ev`, an optional full stop, an optional `#`, the digits, then anything but a letter or a digit. A number with a letter, a number inside a title and any other form answer null.
- `person_file_next_exhibit_no(person)` reads the number the next record would take without taking it (devs; null to anyone else).
- **`dev_evidence_number_backfill(person, dry_run default true, number_rest default false)`** — numbers a file's existing records from their titles, and never guesses. A record takes its number when exactly one unnumbered record wears it and no numbered record holds it. Reported and left alone: a number more than one record wears (`clashes`, each record by id, day and title), a number with a letter (`lettered`), a title with none (`no_number`, numbered after the highest in the order they were kept only when `number_rest` is true). A counsel-only record is named *a counsel-only record*, never by its title. It holds the file's counter for the whole pass. Read on prod 2026-11-11, shapes and counts only: 84 records on two people, 80 of them opening with the form, the highest 80, two numbers worn twice, one with a letter. It is a dev's press a person; no migration runs it.

**A case's open items and log**

- `person_case_items`: `item_no` (unique a person), `title` (1 to 200), `detail`, `owner_label`, `state` (`open` · `done` · `dropped`), `opened_at`, `closed_at` / `closed_why` (set together with a closed state, the reason 1 to 500), who opened it and from which session. The guard `person_case_items_guard` gives a new item the file's next number, or the number it was sent when that number is free (an item carried over from prose keeps the number people call it by), and after that the file, the number and who opened it never change. Devs select, insert and update; no delete.
- `person_case_log`: `logged_at`, `line` (1 to 1,000), `item_no` when the line is about an item, who and which session. Devs select and insert; no update or delete policy.
- **`dev_case_write(p, dry_run default true)`** — the one door for both, for the dev seat's plan → apply and the tab. `p = { person_id, session?, items?: [{ add: { title, detail?, owner?, item_no? } } | { item_no, set: { title?, detail?, owner? } } | { item_no, close: { why, state? } } | { item_no, reopen: true }], log?: ["a line" | { line, item_no? }] }`, at most 50 of each. Every change to an item writes its own log line, so the log is the item's history. The reply names each change with the item before and after, the log lines, the standing and the log's length, with no clock and no id the run made, so a plan and its apply hash alike; a new item is named by the number it takes, so another session adding one first changes the dry run and the stale plan is refused.

All three tables are a dev's alone and the migration ends with the four fence calls.

Held by `npm run test:pg:person-file-numbers` (`supabase/tests/person_file_numbers/`, in `scripts/sql-beds.txt`): 41 checks. Before the PR the scenario ran on a local Postgres 15 with stand-in tables and the migration applied twice; three mutants each failed it (a trigger that keeps the client's number, a floor that ignores old titles, a backfill that takes the first of a clash).

Deploy order: push this migration. From the push on, every new evidence record is numbered. No client reads the new tables yet and no function is redeployed.
