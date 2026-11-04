# 20261103203000_employment_stints.sql (2026-11-03, Bring back, punch list #256 PR 2)

Every stretch a roster person worked, kept (v2.6481). `people.start_date` / `end_date` hold one pair, so a teammate who left and came back had their first stint's dates written over. The pair stays the **current** stint, so the salary clamp, `roster_people`, tenure and every other reader are unchanged (the owner's call: tenure counts from the day back); earlier stints live here.

- **`employment_stints`** — `person_id` (cascades with the people row), `start_date` (null = unknown, a legacy row with only an end), `end_date` (null = the open stint), `created_at`, `updated_at`. At most one open stint a person (`employment_stints_one_open`); a stint has at least one date.
- **The trigger `people_stints_follow_dates`** (AFTER INSERT OR UPDATE OF `start_date`, `end_date` on `people`, security definer) is the only writer, so every path that writes the dates keeps the stints: the first dates open the first stint; an end cleared with a new start on or after the old end is a **return** and opens a new stint (Bring back, the sub bench's Reactivate, even on the same day); anything else moves the current stint's dates (an edit on Pay & schedule or the Employment tab, End employment's end, *Ended by mistake* which keeps the start and reopens the stint). A change that leaves both dates alone does nothing.
- **Reads** follow the people row: one SELECT policy, `EXISTS` on `people` under people's own policies. No write policies; `anon` has nothing; `authenticated` has SELECT only.
- **Backfill**: one stint from each row's pair, for rows with any date and no stint yet; a rerun adds nothing.
- The three fence calls close it, since a table is made.

Tested by `npm run test:pg:employment-stints` (`supabase/tests/employment_stints/`, in `scripts/sql-beds.txt`): a roster seeded with the trigger off, the migration run twice more (the backfill, then nothing), then End employment, Bring back, an edit, a second end, an end undone, a same-day Reactivate, first dates, a delete, and the reads and the refused insert through RLS.

Apply order: nothing on screen reads the table in this PR. Push after the merge; then `npm run gen-types:linked` as its own `chore(types)` PR, before PR 3's window reads the stints.
