# 20261014012000_messages_nudge_settings.sql (2026-10-13, v2.5438)

Messages, cut 5, PR B of the morning run of the reminders the app sends itself (`messages-nudge-dispatch`; `BUILD_PLAN.md` → Cut 5, and section 7's decision 3: per step, off until the owner turns it on). The run's reads are `src/lib/flows/nudgeRunInputs.ts` (v2.5436) and its planner is `flows/nudgeDispatch.ts` (v2.5270). This migration gives the run its two rows. The function itself and its cron come after, the cron in a migration of its own pushed only once the function is deployed.

## What it does

1. **Seeds `app_settings` `messages_nudge_app_sends_v1`** as `{}`: the owner's switch. Its shape is `{"<kind>": {"<step id>": true}}`, as `{"trade": {"portal": true}}`. Only `true` turns a step's reminder on, and anything else, text that is not JSON included, is off (`appSendsFrom`). So every step starts off.
   - **Why the ids nest under their kind**: a step id is unique only within its kind's flow. The sub flow brings `asked`, `onsite` and `yes`, which the customer flow already has, so a flat key would turn a step on for both at once.
2. **`master_or_dev_update_messages_nudge_app_sends`**, an `UPDATE` policy for `authenticated` keyed to that row alone, with `is_master_or_dev()` in both `USING` and `WITH CHECK`. It is the shape of `master_or_dev_update_messages_quo_seats` (`20261013040000_quo_seats.sql`).
3. **Seeds `app_settings` `messages_nudge_last_run_v1`** as `{}`: the newest morning's summary, what went and what was kept back and why. The run writes it as the service role, so it has no `UPDATE` policy of its own. Past the run, only a dev changes it, under the table's own *Devs can manage app settings*.

Both seeds are `ON CONFLICT (key) DO NOTHING`.

## Who reaches it

- **Reads**: every signed-in user, as `app_settings` already allows.
- **Writes**: the switch, the owner or a dev, that row only. The summary, the run as the service role, and a dev. Training mode's write blocks on `app_settings` stand.
- **`messages-nudge-dispatch`** reads the switch and writes the summary as the service role, past RLS.

## Safety

- `SET lock_timeout = '3s'` first. The policy takes a short lock on `app_settings`, and a busy table makes the push fail fast.
- No table is created, so no fences are added. `app_settings` keeps its own.
- Idempotent: the seeds do nothing when the rows exist, and the policy is dropped and made again.
- Nothing reads either row until the function is deployed, and the switch starts off, so the push changes nothing anyone sees.

## Verify on prod (read only)

```sql
SELECT key, value_text FROM public.app_settings WHERE key IN ('messages_nudge_app_sends_v1', 'messages_nudge_last_run_v1');
SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.app_settings'::regclass AND polname = 'master_or_dev_update_messages_nudge_app_sends';
```
