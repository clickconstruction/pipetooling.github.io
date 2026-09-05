# 20260905170000_estimate_declines.sql (2026-09-05, v2.2873)

Estimates can be declined — journey-map Tier-2 #34 (J17-F6 / N1 / N2). `declined` has sat in `estimate_status` since the baseline with no writer anywhere. Idempotent (DROP/ADD CONSTRAINT IF EXISTS, CREATE OR REPLACE); no new tables, so no read-only re-apply calls are needed.

1. **`estimate_customer_events` CHECKs widened**: `event_type` gains `'declined'`; `source` gains `'record_estimate_decline'` (the staff RPC — the first non-edge source). Column comments updated (also note that `?preview=1` office looks are no longer stamped as `public_link_view`).
2. **`log_estimate_customer_event`** re-created with the widened lists. It also finally accepts `option_viewed` / `log-estimate-option-view` — `20260828193012` widened the CHECKs but left this RPC's own `IF … NOT IN` guard, so every option view took the shared logger's plain-insert fallback (worked, logged an error each time).
3. **`record_estimate_decline(p_estimate_id uuid, p_note text DEFAULT '', p_channel text DEFAULT 'phone') RETURNS jsonb`** — SECURITY DEFINER, `authenticated` only (REVOKE from PUBLIC/anon). Gate mirrors `estimates_select`: staff role ∧ (`user_can_access_estimate` ∨ `superintendent_can_access_estimate` ∨ office-wide role). Locks the row, requires `status = 'sent'` (clear RAISE otherwise), flips to `declined`, inserts the `declined` event with `metadata { by: 'staff', channel, note (≤ 280, whitespace-collapsed), user_id }` in the same transaction. Read-only users are stopped by the `read_only_block_stmt` trigger on `estimates` like every other RPC.

**Order.** Push this **before** deploying `accept-estimate` — the customer decline's audit row needs the widened `event_type` CHECK (the status flip would still land without it; the best-effort logger would drop the row). The client can ship first: the Declined bucket and open-state chip read existing columns, and the staff button's RPC call fails with a readable toast until the push.

**Verify after push.**

```sql
select pg_get_constraintdef(oid) from pg_constraint where conname = 'estimate_customer_events_event_type_check';
-- … 'declined' in the list
select proname, proacl from pg_proc where proname = 'record_estimate_decline';
```
