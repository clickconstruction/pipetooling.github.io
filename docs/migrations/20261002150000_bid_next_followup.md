# 20261002150000_bid_next_followup.sql (2026-10-02, v2.4419)

Punch list #80, PR 1 of 5: where a bid's **call-again date** lives. Additive only: four nullable columns on the contact log, four on `bids`, three constraints, two foreign keys on `bids`, one trigger. No row changes, and no screen reads or writes the columns yet.

**The date is said in the log.** A `bids_submission_entries` row may carry:

| Column | Meaning |
|---|---|
| `next_followup_on date` | the day to call again; NULL = this entry says nothing about a date |
| `next_followup_contact_person_id uuid` | who to ask for (`customer_contact_persons`, `ON DELETE SET NULL`) |
| `next_followup_reason text` | what the bid waits on: `budget`, `owner_deciding`, `not_awarded`, `other` |
| `next_followup_cleared boolean NOT NULL DEFAULT false` | true = this entry removes the bid's date |

`bids_submission_entries_next_followup_shape_check`: a row sets a date or removes it, never both, and a person or a reason needs a date.

**The bid's roll-up is derived**, the same shape as `bids.last_contact` (`20260828040000`): `bids.next_followup_on`, `next_followup_contact_person_id`, `next_followup_reason` and `next_followup_entry_id` come from the **newest entry that set or cleared a date** (`occurred_at`, then `created_at`, then `id`). `next_followup_entry_id` (`ON DELETE SET NULL`) is the log row itself, so who set the date, when, and what was said need no history table. No screen writes these four columns.

- An entry that says nothing about a date leaves the roll-up alone: a call in November does not erase "January 5".
- An older entry typed in late does not win.
- A note with no contact method can move the date and is still not a contact (`last_contact` does not move).
- Deleting or editing an entry recomputes; an entry moved to another bid recomputes both bids.

`sync_next_followup_from_entries()` is `SECURITY INVOKER` like `sync_last_contact_from_entries`: whoever may write the log already updates the bid from the same screens. EXECUTE is revoked from PUBLIC, anon and authenticated: a trigger function is nobody's RPC.

**Whether a date is still live is not stored.** A date is spent once a contact is logged on or after it; the kernel that reads the roll-up decides that from `last_contact` (PR 2). The seven-day default is never written.

**One date per bid**, not per GC: a bid sent to two GCs shares its date (the owner's pick; see the to-do).

**Locks.** `ALTER TABLE … ADD COLUMN` on `bids` and `bids_submission_entries` (nullable, or with a constant default: no rewrite) and the foreign keys validate 409 bids and the log, all NULL. `lock_timeout = '3s'`.

**Tested** on a throwaway copy of the whole schema (`npm run test:pg:bid-next-followup`), as an estimator through RLS, in a transaction that rolls back; the migration is applied twice first. 22 checks: a date set with who and why, kept through a later contact, not beaten by a late-typed older entry, moved by a note, removed, brought back by deleting the removal, moved with its entry to another bid; three refused shapes; the person deleted (the date stays, the name goes); a primary refused by RLS; and a bid with a date deleting cleanly, although the bid and its entry point at each other.

The generated types gain the eight columns and three relationships: a `chore(types)` PR follows the push. Apply with `supabase db push` after the PR merges.
