# 20261119170000_calling_lock_stale_takeover.sql (2026-11-19, v2.7955)

The update policy of `prospect_calling_locks` now lets a caller take over a stale row, and the rows already stale are deleted. It closes quirk 38 of `docs/PROSPECTS_TABS_ARCHITECTURE.md`.

**What was wrong.** A calling lock is one row per prospect that says who is on it right now. It is advisory: a live row held by somebody else hides the prospect from the other callers' Follow Up deck and blocks nothing. A row older than 30 minutes is stale (`CALLING_LOCK_TTL_MS`), and the next caller is meant to take it over with an upsert on `prospect_id`. That upsert updates the old holder's row, and the update policy (`Users can update their own prospect calling lock`, from the baseline) passed only a caller's own row. On a whole-schema bed, as a second signed-in caller, the upsert came back `42501 new row violates row-level security policy (USING expression)`. The client lets a refused lock go, so the call went on with no lock: on a prospect a colleague had dialed and never released, nobody else could hold the lock again. Until v2.7656 no release was ever sent, so every dial left such a row.

**What it does.**

- Drops `Users can update their own prospect calling lock` and creates `Callers refresh their own calling lock or take a stale one`, `FOR UPDATE TO authenticated`. `USING` reads the row as it stands: the caller's own, or `locked_at` older than 30 minutes, or no `locked_at`. `WITH CHECK` reads the row as written: `user_id` must be the caller. So a stale row can be taken, no row can be written in another caller's name, and a colleague's live row is refused by the database as well as by the client's own check.
- Deletes the rows where `locked_at` is null or older than 30 minutes. Nothing reads a stale row, so nothing on screen changes.

The select, insert and delete policies are untouched, and so are the restrictive fences (read-only, digital twin, archived) and the statement trigger. No function, table, column or grant changes, so `database.ts` does not change. Idempotent: `DROP POLICY IF EXISTS` on the old and the new name before the create, and a second run of the delete finds only what went stale since.

**The table on prod**, read through the dev seat on 2026-11-19 before the push: 23 rows, every one older than the 30 minutes (the newest two weeks old), all held by one caller whose account is active. The delete clears all 23. `CREATE POLICY` and `DROP POLICY` take the table's lock for an instant; `lock_timeout` is 3 s.

**The 30 minutes is written twice**, here and in `src/lib/prospects/callingLock.ts`. `src/lib/prospects/callingLock.test.ts` reads the newest migration that states the policy and fails when the two differ, so a change of the TTL takes a migration that restates the policy.

**Proof.** `npm run test:pg:calling-lock-takeover` (`supabase/tests/calling_lock_takeover`, in `scripts/sql-beds.txt`): the migration's second run keeps one update policy and deletes only the stale rows; a second caller takes a row three weeks old, a row with no time and a row 31 minutes old, and is refused a row 29 minutes old; nobody restamps a stale row in its holder's name or hands it to a third caller; the old holder is refused the row once it is live again; delete is still a caller's own row only; an archived caller, a read-only caller and a signed-out visitor take nothing.

**Apply order:** either way round. The client sends the same upsert as before, so the old client works on the new policy and the new policy changes nothing the old client reads. Until the push the takeover is refused as it always was.

**Applied** to prod by 2026-11-20, in another session's push after the merge of #8938. Read the same day: the migration ledger lists `20261119170000 calling_lock_stale_takeover`; the catalog shows the one update policy `Callers refresh their own calling lock or take a stale one` for `authenticated`, with the stale clause in `USING` and the caller's own name in `WITH CHECK`, and the old policy gone; the table holds 0 rows where it held 23. No change to `database.ts`, since the migration alters a policy and deletes rows.
