# 20261002211435_bid_submittal_people_email_optional.sql (2026-10-02, v2.4442)

Ships with the *Their answer* window (v2.4442). Additive: one `NOT NULL` dropped, no row changes.

| Column | Before | After |
|---|---|---|
| `bid_submittal_people.email` | `text NOT NULL` | `text NULL` |

**Why.** The office records what a reviewer said under a person on the room. The estimator often knows only who the company is: Wendi typed "spacex" in the name box and was afraid to add an address. A reviewer the office names (`how = 'named'`) can now be a name alone: the bid's GC as a company, a contact with no address on file, or a typed name.

**What the email still is.** The room's key for a person who comes back. The unique index `bid_submittal_people_room_email_key` on `(room_id, lower(email))` is untouched, and NULLs never collide in it, so a room can hold several people with no address. The client keeps them apart by name (`matchRoomPerson` in `src/lib/submittals/reviewerPick.ts`): an entry with no email reuses the person of that name who has none, and never takes over a person who has one.

**Readers checked.**
- `submit-submittal-review` → `resolveIdentify`: a visitor who arrives on the personal link of a person with no email is that person, and the address they give is written (`claimEmail`). It used to call `.toLowerCase()` on the email.
- `send-submittal-reply-email`: already answers *No address on file for that person.* A named person has asked nothing in the room, so no reply is ever addressed to one.
- `get-submittal-room`: never selects the column.
- `SubmittalShareModal`: its "already on the room" set skips people with no email.

**No policy changes.** The table keeps its row policies.

**Locks.** `ALTER COLUMN … DROP NOT NULL` is a catalog change: no rewrite, no scan. `lock_timeout = '3s'`.

**Order of work.** Merge → `supabase db push` at once (the old client never writes a NULL, so the push can go before the new client deploys; the new client writes one only when a reviewer is entered without an address) → deploy `submit-submittal-review` and `send-submittal-reply-email` → regenerate types (the PR hand-edits the three `email` lines).
