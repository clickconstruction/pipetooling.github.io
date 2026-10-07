# 20261006070144_legal_firms_one_active.sql (2026-10-05, v2.4641)

One collections law firm at a time, said in the schema (punch list #85, item 27; the owner's decision of 2026-10-05). The guide already says *One firm at a time*, the firm's portal and Lien grid serve that firm, and Settings → Collections law firm edits the one active row and inserts only when none is active. The table allowed a second active row, and its readers each pick "the first active firm" their own way (Settings and the Lien desk's share by `created_at`, the desk's firm list by `active` then age).

The file:

1. A guard: counts `legal_firms` rows with `active = true` and raises, naming the count, when there are more than one. Nothing changes until someone retires all but one.
2. `CREATE UNIQUE INDEX IF NOT EXISTS legal_firms_one_active ON public.legal_firms ((true)) WHERE active;` A unique index on a constant over the active rows: at most one row may be active. Inactive rows are unlimited, so retiring a firm and adding the next one still works.
3. Comments on the index and the table.

Why an index and not a trigger: the index is one line Postgres enforces on every write, including a hand edit; a trigger is code that can be disabled or written wrong.

Locks: building the index takes a SHARE lock on `legal_firms` (a few rows) for an instant; `SET lock_timeout = '3s'` first. No CREATE TABLE, so no read-only or twin fence calls.

Client: `LegalFirmSettingsBlock` turns the index's refusal into *One firm at a time: another firm is already active. Reload Settings to edit it.* (`src/lib/legal/legalFirmSave.ts`). Works before and after the push.

Not rehearsed on a database (no local Postgres in this session). Apply: `supabase db push` any time after merge; no client coupling, no types regen (an index adds no column).
