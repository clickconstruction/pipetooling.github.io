# 20261014160000_messages_texts_on.sql (2026-10-13, v2.5440)

Messages, cut 5 (c), the switch that lets the office text from the company number: Settings → Phone and texts → **Send texts**. Until now a text was held back by a constant in the app (`TEXTS_ON` in `replyIo.ts`, #5497) and by a missing secret on `quo-send`. The owner's Quo secrets are set, so a secret is no switch. This migration gives the owner a real one.

## What it does

1. **Seeds `app_settings` `messages_texts_on_v1`** as `'false'`. Only `'true'` turns texts on. `ON CONFLICT (key) DO NOTHING`, so a second run leaves what the card wrote.
2. **`master_or_dev_update_messages_texts_on`**, an `UPDATE` policy for `authenticated` keyed to that row alone, with `is_master_or_dev()` in both `USING` and `WITH CHECK`. It is the shape of the seats' policy (`20261013040000_quo_seats.sql`) and Read bids@'s (`20261013080000_messages_email_in.sql`), so the cards in the group write the same way: a plain update returning the key, where no row back means refused.

## Who reaches it

- **Reads**: every signed-in user, as `app_settings` already allows. The send window reads it as the person, and a text waits while it reads off.
- **Writes**: the owner or a dev, this row only. Training mode's write blocks on `app_settings` stand.
- **The edge functions** read it as the service role, past RLS. `sendText` in `_shared/quoLines.ts` reads it before a person's text (`quo-send`) and before the app's reminder, and refuses with `503 textsOff` while it is off. The app's answer to HELP or INFO and the one confirmation of a stop go either way, since they answer the person's own keyword and the carriers' rules expect them.
- **A missing row reads off**, so `quo-send` can deploy before or after this push.

## Safety

- `SET lock_timeout = '3s'` first. The policy takes a short lock on `app_settings`, and a busy table makes the push fail fast.
- No table is created, so no fences are added. `app_settings` keeps its own.
- Idempotent: the seed does nothing when the row exists, and the policy is dropped and made again.

## Verify on prod (read only)

```sql
SELECT key, value_text FROM public.app_settings WHERE key = 'messages_texts_on_v1';
SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.app_settings'::regclass AND polname = 'master_or_dev_update_messages_texts_on';
```

The first reads `false` until the owner turns texts on. The second reads `w` (UPDATE).
