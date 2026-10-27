# 20261027220000_extend_estimate_good_through.sql (2026-10-27, v2.5992)

Punch list **#204** PR 1: a sent estimate's good-through date can be extended from the office page,
and the link the customer already has keeps working. A city's estimate (#156) expired while its
five people each held a copy of the one emailed link; Resend was refused (`pricing_expired`) and
would have re-minted the token anyway, so the office remade the estimate by hand.

- `estimate_customer_events`: `event_type` CHECK gains `good_through_extended`, `source` CHECK gains
  `extend_estimate_good_through`; `log_estimate_customer_event` accepts both (the edge logger is
  unchanged otherwise). Column comments amended.
- **`extend_estimate_good_through(p_estimate_id uuid, p_valid_until date) → jsonb`**, SECURITY
  DEFINER, `authenticated` only: the same role list and `user_can_access_estimate` /
  `superintendent_can_access_estimate` test as `record_estimate_decline`; only a `sent` row that is
  not in a bid room; the day must be today or later in `America/Chicago`. In one transaction it sets
  `valid_until`, pushes `public_token_expires_at` to at least midnight ending that day in
  `America/Chicago` (`GREATEST`, never earlier; a NULL expiry becomes that end), pushes every
  `estimate_share_links.expires_at` for the estimate the same way, and inserts the event with
  `metadata {from, to, user_id, user_name}`. The token hash is untouched — the owner's call 1 of #204:
  every forwarded copy of the link keeps working. Returns `{ ok, estimate_id, valid_until,
  link_expires_at, event_id }`.
- `estimates_protect_after_accept` is untouched: it guards accepted rows only, and the RPC refuses
  anything but `sent`. Read-only users are stopped by `read_only_block_stmt` on `estimates`, twins by
  the digital-twin fence, as with every RPC.

Idempotent (`DROP CONSTRAINT IF EXISTS` + `ADD`, `CREATE OR REPLACE`), additive; `SET lock_timeout =
'3s'`. **Push after merge; deploy the client first** (an old client never calls the RPC, so either
order is safe — the words change in `send-estimate-to-customer`'s shared kernel also redeploys that
function).

Verify after the push: `select proname from pg_proc where proname = 'extend_estimate_good_through';`
returns one row, and `select pg_get_constraintdef(oid) from pg_constraint where conname =
'estimate_customer_events_event_type_check';` names `good_through_extended`.

Rollback: `DROP FUNCTION IF EXISTS public.extend_estimate_good_through(uuid, date);` and re-apply
`20260905170000_estimate_declines.sql`'s two CHECKs and `log_estimate_customer_event` — after
deleting any `good_through_extended` rows, which the narrower CHECK would refuse.
