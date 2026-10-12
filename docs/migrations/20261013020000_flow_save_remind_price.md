# 20261013020000_flow_save_remind_price.sql (2026-10-12, v2.5320)

Messages, cut 4's follow-ups: the lead's answers to helper 5's wave 2 prep. It comes after the flows' `20261012120000_messages_flows.sql` (v2.5267), and so after cut 4b's `20261012180000`, whose office drafts it lets the money team price. Three functions, no table.

## What it does

1. **`flow_save(p_kind, p_steps, p_history, p_removed, p_put_back, p_based_on)`** is Settings → Flows' Save, all of it or none. Before, the screen would have made several writes that could stop halfway.
   - `p_steps` is every step as the editor writes it (`flowRows` in `src/lib/flows/editor.ts`). A step left out is deleted. A step the Save left as it was keeps its `updated_at`, through `ON CONFLICT … DO UPDATE … WHERE … IS DISTINCT FROM`.
   - `p_history` is History's lines (`saveDraft`'s), written in order with the saver's name. A `null` before or after is stored as none.
   - `p_removed` holds the steps this Save removes, and `p_put_back` the step keys it puts back (`put_back_at`, the trigger stamping who).
   - `p_based_on` is the newest History line the screen read. When a newer one is there, someone saved since, and the Save is refused (`savedMeanwhile`) with "Someone saved this flow while you edited it. Put it back to see theirs, then make your change again." The two are compared to the millisecond, as a browser keeps a time. An advisory lock holds one Save of a flow at a time.
   - It returns the newest History line's time, for the next Save.
   - It refuses in `20261012120000`'s style, a code with words in its detail: `signIn`, `trainingAccount`, `digitalTwin`, `notAllowed` (off the office team), `flowUnknown` and `noSteps`.
   - `SECURITY INVOKER`: the flows tables' grants and policies decide, and the fences hold.
2. **`nudge_record_sent`, re-created.** Remind now first lets the step's standing hold on the same job go (its trigger stamps who), then records the reminder as before. This matches the kernel's `nudgeNow`, since `nudgeDue` reads a hold before a press. The hold is matched the way the presses match a job, at most one of `bid_id`, `project_id` and `jobs_ledger_id`, with `released_at IS NULL`. It's helper 4's function, and its checks and grants are kept.
3. **`gc_price_change_order(p_id, p_cost, p_price)`**: the money team prices a draft change order in whole dollars. An office draft from a customer's message comes in at 0, and `gc_send_change_order` refuses one with no price and no days. The refusals are in words, in the change orders' style:
   - signed out, a training account, a twin, anyone off the money team;
   - a change order that is not there;
   - "Change order 1 went to the customer, so its price stays as it went. Draft a new one.";
   - `gc_draft_change_order`'s own "Type what it costs us. A credit is a cost below zero."
   - `SECURITY INVOKER`: the money team's policy decides, and `gc_change_orders_keep_what_went` still holds what went.

`SET lock_timeout = '3s'`. No table changes, so nothing waits on a table's lock but the functions' catalog rows. A second run changes nothing, which the bed checks.

## The bed

`scripts/pgtest-flow-save.sh` plays `supabase/tests/flow_save/20_scenario.sql` after every migration, and again after this file a second time, so its `nudge_record_sent` is the one read. It checks:
- **One Save:** Rosa saves a rename, a new step and a removed one. History keeps the three lines in order by Rosa, Removed keeps Closeout, and Invited, left alone, keeps its clock.
- **Saved since:** Maria's Save from the flow as it was before Rosa's is refused.
- **All or none:** a Save whose History line is too long for its column changes nothing.
- **Put back:** Maria puts Closeout back, and Removed says by whom.
- **Refused:** a flow that is not there, no steps, a superintendent, a training account, a twin, and someone signed out.
- **Pricing:**
  - The office, a training account and a twin cannot price.
  - A cost of nothing is refused.
  - Maria prices the draft, $1,200 and $1,501 from 1,200.4 and 1,500.6, and sends it.
  - A price after it went is refused.
- **Remind now:** it lets the hold on the person go, by Rosa, and leaves a hold on a job.

`messages_flows`' bed keeps its own Remind now as it was. Its runner re-applies `20261012120000` last, which restores the earlier `nudge_record_sent`, so the release is pinned here.

## Verify after the push

```sql
SELECT proname, prosecdef, pg_get_function_identity_arguments(oid)
FROM pg_proc WHERE proname IN ('flow_save', 'nudge_record_sent', 'gc_price_change_order') ORDER BY proname;
SELECT position('released_at' IN prosrc) > 0 FROM pg_proc WHERE proname = 'nudge_record_sent';
```

Expect the three, each `false` (invoker), and `true`. Then `npm run check:migration-drift` is clean.

## Rollback

```sql
DROP FUNCTION IF EXISTS public.gc_price_change_order(uuid, numeric, numeric);
DROP FUNCTION IF EXISTS public.flow_save(text, jsonb, jsonb, jsonb, text[], timestamptz);
```

Then re-create `nudge_record_sent` from `20261012120000`. Nothing else changed.

## Status

A draft stacked on the flows' PR (#5435). Not pushed: `supabase db push` only after it is on `main`.
