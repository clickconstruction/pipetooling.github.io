# 20261013030000_messages_owed_sent_done.sql (2026-10-12, v2.5321)

Messages, cut 2's addendum (the lead, 2026-10-12), on `20261012160000_messages_follow_up.sql` (v2.5274). Cut 3's reply
box asks, before a text or an email goes, whether it gets what we owe done (`afterSendResult` in
`src/lib/messages/owed.ts`). When it does, the box calls this with the line the send wrote, so the send functions never
touch cut 2's table.

## What it does

- **`owed_sent_done(p_contact_id uuid, p_message_id uuid) RETURNS void`**, `SECURITY INVOKER`, behind cut 2's press
  gate (`follow_up_press('mark what we owe done')`: no sign-in, a training account, a twin or anyone off the office
  team is refused in words). It closes the person's open `contact_owed` row as done by that message (`done_how
  'message'`, `done_note_message_id` the line) and writes the gray line `owedSentDoneLine` says: *Rosa sent the start
  date. It is done.* (`follow_up_event`).
- **Refused in words**: nothing owed (*Nothing is owed to them now.*); a line that is theirs, ours to someone else, or
  none (`contact_owed_guard`: *Only their team note, or a message we sent them, marks what we owe done.*).
- No table is made, so the house fences stand as `20261012160000` left them. `authenticated` and `service_role` may
  execute it; `anon` and `PUBLIC` may not.

## Tests

The cut 2 bed (`supabase/tests/messages_follow_up/20_scenario.sql`, step 15): a training account refused, their own
line, our line to someone else and no line refused, our email marking it done by that line with its gray line, and
done once. `src/lib/followUp/followUpSql.test.ts` reads both migrations: the gray line is `owedSentDoneLine`'s, and the
bed asserts every refusal either can raise.

## Applying

`supabase db push` after `20261012160000` is on prod and this file is on main. It only adds a function, so it locks
nothing a crew is using.
