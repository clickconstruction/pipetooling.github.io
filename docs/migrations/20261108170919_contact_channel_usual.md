# 20261108170919_contact_channel_usual.sql (2026-11-08, v2.6699)

Punch list #118, PR 1 (`docs/recent-features/v2.6699.md`): the usual number or address.

- `contact_channels.usual_at timestamptz` — when the office made this row the contact's usual. An ordinary partial index `contact_channels_usual (contact_id, kind) WHERE usual_at IS NOT NULL`, not a unique one: `name_contact` folds a named number into the record's own contact by moving channel rows, and a unique index would refuse the fold when both sides carry a usual. The function keeps one per kind; the readers take the newest when two meet.
- `contact_channel_make_usual(p_channel uuid)` — `SECURITY DEFINER` behind `follow_up_press` (signed in, not a training account, not a twin, the office team): stars the row, clears the contact's other usual of the same kind, refuses a number that sent STOP, writes the gray line on the thread through `follow_up_event`. Already the usual: no change, no line. Granted to `authenticated` and `service_role`.

Additive and idempotent; no CREATE TABLE, so no new fences.

**Order:** push right after the PR merges — the client selects `usual_at` in the Messages view's channel read and calls the function from the send window; `check:calls-ahead` labels the PR. Then `supabase functions deploy messages-nudge-dispatch` (its select adds `usual_at`). Regenerate types afterwards (`npm run gen-types:linked`, its own chore PR).
