# 20261112180000_messages_history.sql (2026-11-12, v2.7026)

Old mail lands for the record (punch list #324, PR 1 of 5). Every line in Messages keeps when it was written (`at`) and when it landed (`created_at`). Nothing that asks whether someone is waiting read the second, so an old mail tagged onto a job today read as a message nobody had answered for months. This is the database's half: the mark, the trigger that honours it, and the mail already there. No new table, so no fence call.

## What it does

1. **`messages.history boolean NOT NULL DEFAULT false`**: true on a mail filed for the record. It shows in the thread and on the job at its own date and asks nobody for a reply.
2. **`email_write_line`** keeps the mark the caller sends in `p_row`. A caller that sends none writes false, so every function deployed today writes as it did. The tag (`gmail-mine`) starts sending it in the next PR. The company boxes' readers never send it: mail in the team box was seen by nobody until the app read it.
3. **`messages_move_state`** (the AFTER INSERT trigger): a filed mail of theirs opens nothing. A filed mail of ours still counts as our answer, as any line of ours that lands late does today. A filed mail of theirs never holds a thread open against a later line of ours.
4. **`set_state`**: Reopen (`waiting`) takes the mark off the thread's mail, since a person has said it is live. It does so through **`messages_unfile(p_contact_id uuid)`**, new here and SECURITY DEFINER: the office holds UPDATE on a few named columns of `messages`, and `history` is not one of them. The function asks the same press check as every Follow up press and can only take a mark off. A close (`done`) now clears `has_until` with the holder. `20261107083000` fixed that for the trigger and `mark_notice` and missed it here, so **No reply needed** on a thread a tech held was refused by `contacts_has_until_held`.
5. **The mail already there.** An email line from a person's own box (`mailbox = 'mine'`) that landed more than 14 days after it was written is marked. A thread that is Open, that nobody holds, that has filed mail of theirs and no other line of theirs still waiting on us, goes back to Done.

## What the data step is expected to touch

Read on prod on 2026-11-12, read-only: 38 lines from the tags of 2026-11-09 landed 3 to 12 months late (one over a year), and 4 Open threads were opened by such mail alone. Two more threads from the same tags hold mail from the last week. Those stay Open. No other Open thread on the board landed late.

## Who may do what

`email_write_line` is the service role's. `set_state` and `messages_unfile` are the office team's, through `follow_up_press`: a training account, a digital twin and anyone off the office team are refused in words, and `anon` has no EXECUTE. Nobody signed in can put the mark on a mail: only the tag does, as the service role. The trigger is the database's own.

## Release order

Merge, then `bash scripts/db-push.sh`. Nothing reads the column yet, so there is no hurry. The next PR's client selects `history` by name and must not merge before this is pushed.

## Verify

Read-only on prod after the push:

- `select column_default from information_schema.columns where table_name = 'messages' and column_name = 'history'` reads `false`.
- `select count(*) from messages where history` reads about 38.
- `select count(*) from contacts c where state = 'waiting' and exists (select 1 from messages m where m.contact_id = c.id and m.history and m.direction = 'in') and not exists (select 1 from messages m where m.contact_id = c.id and m.direction = 'in' and not m.history)` reads 0.

The bed `messages-follow-up` (`supabase/tests/messages_follow_up/20_scenario.sql`, section 18) holds the trigger's and `set_state`'s rules.

## Undo

`update messages set history = false where history` puts every line back as it read. The four threads would not reopen by themselves: press **Reopen** on each.

**Applied** to prod by 2026-11-13: the dev seat's `check_migration_ledger` read 1274 applied, this version among them, against 1274 files in `supabase/migrations/` (read in the docs pass after #7659); types regenerated in #7805.
