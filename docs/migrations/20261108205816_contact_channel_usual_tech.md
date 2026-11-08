# 20261108205816_contact_channel_usual_tech.sql (2026-11-08, v2.6732)

Punch list #118, PR 2 (`docs/recent-features/v2.6732.md`): the tech's door on the usual number, for the To chip on Job Mode's On my way.

- `contact_channels_tech_read` — a SELECT policy on `contact_channels`, R5's door: `messages_tech_team()` and `messages_tech_can_read(contact_id)`, the same test `contacts_tech_read` and `messages_tech_read` make, so a tech on the job reads the customer's numbers the chip lists. No write: a tech's text still goes through `quo-send` as the service role.
- `contact_channel_make_usual(p_channel uuid)` — recreated with a wider gate: the office team (`gc_office_team()`), or a tech `messages_tech_can_read` admits to the channel's contact. The refusals keep `follow_up_press`'s shape and codes (sign in `P0001`; a training account, a twin and anyone else `42501`), said here since `follow_up_press` asks for the office alone; a stranger and a missing channel read the same refusal. The body is PR 1's: one usual per kind per contact, a number that sent STOP refused, the gray line through `follow_up_event`, nothing when it is the usual already.

Additive and idempotent; no CREATE TABLE, so no new fences. `supabase/tests/messages_tech_send/20_scenario.sql` § 8 holds the door.

**Order:** the client reads the policy's rows and calls a function that already exists, so it deploys either side of the push; until the push a tech's On my way sheet reads no numbers and draws no chip, and `quo-send` picks as before. Push, then `supabase functions deploy quo-send` (the tech path takes `channelId` and reads `usual_at`) and `supabase functions deploy messages-nudge-dispatch` (a held row's words name the number).
