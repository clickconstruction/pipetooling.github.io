---
name: "GC mode, Owner Billing O3b: a trade's change request, answered by the office"
parent: to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md (O3's "What waits": the trade's ask) and mockups/portal-p4.md (decision 10)
status: planned 2026-10-09 by Helper 15 · read-back approved by the lead with four calls · the SQL tested on PGlite against main's GC chain at 6186bb429 (38 checks; four mutants each caught) · its SQL as built below word for word, before its build
---

# O3b: a trade's change request, answered by the office

A trade asks for a change from its portal: P4a's `gc_trade_ask_change`, behind P4b's **Ask for a change**. O3b is the
office's answer, in the **Change orders** window on `/gc` (O3-ui):

- **Make a change order**: the ask becomes a draft change order to the customer, on the ask's own trade and reason.
- **Turn down**: with why, in words the company reads.

The trade hears each answer by email from the office's screen: P4b-iii's `changeAskEmail`, kind `changeAsk`, through
`gc-trade-email` (`sendGcTradeEmail`), each stage sent once by its key `<request id>:<stage>`. `gc-trade-email` needs no
change.

## The lead's calls (2026-10-09)

1. **`sent` and `no` ride the office's own presses.** **Send for signature** sends `sent` and **They declined** sends
   `no`, when the change order came from an ask. The row shows **Tell <company>** while that key has not gone: a decline
   pressed in the customer's portal (O7c's path sends no trade email), or an email that did not go.
2. **One mapper.** `changeRequestFromRow`, exported from the Portal's `tradePortalState.ts` with Helper 13's nod, maps
   the office's rows too, instead of a second copy.
3. **The refusals are plain words**, as O3's are: the money team's first, then the dev door's.
4. **Turning an ask down needs the money team too**, as making it a change order does.

## What the office sees

The window lists the open asks above the change orders (`openChangeRequests`), with a red chip in its header. The rows
are the prototype's `ChangeRequestRow`, word for word:

```
Fair Oaks Shops, Building D · change orders
[+$13,200 signed]  [1 waiting on Cibolo Creek Partners]  [1 asked by the trades]        [New change order]

┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ (asked by the trade)  Tri-County Sitework   Sitework · asked Sep 30              $14,820 │
│ Rock at the north footings, about 390 cubic yards to break out and haul off              │
│ A field condition · adds 2 days to the job                                               │
│ [Make a change order]  [Turn down]                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Make a change order** opens the draft, prefilled from the ask:

```
Description of change   [Rock at the north footings, about 390 cubic yards to break out and haul off]
What it costs us [14820]   What it adds to their price [  16302  ]   Days it adds to the job [2]
Their ask is our cost. The price starts at the cost plus our 10% fee. Tri-County Sitework only ever sees the cost.
[Save the draft]  [Cancel]
```

The price shows `changeOrderPrice` until it is typed over, and the press sends the price it shows.

**Turn down** asks why, for the company, and says who hears it:

```
Why, for Tri-County Sitework  [It is in your scope, sheet S-201.            ]   [Turn it down]  [Cancel]
Tri-County Sitework gets an email with why.
```

A change order made from an ask says so, and what the trade has heard:

- *Asked for by Tri-County Sitework on Sep 30: $14,820.* (the prototype's line)
- **Delete the draft** on it says *Tri-County Sitework's ask goes back to the list.*
- Once sent: *Told Tri-County Sitework Oct 9.*, or **Tell Tri-County Sitework** while its `sent` email has not gone.
- Once declined: *Told Tri-County Sitework the customer said no.*, or **Tell Tri-County Sitework** while `no` has not
  gone.

An email that did not go is said after the write, in `gcTradeEmailRefusal`'s words, as O4b-2's customer email is.

## The migration: `<stamp>_gc_change_request_answers.sql`

Its stamp is claimed at the cut from `origin/main`'s latest file. It is `20261010014000` until then. No table, so no
`apply_*` calls. A difference between the migration and this block that is not a comment or the stamp is a question for
Owner Billing.

```sql
SET lock_timeout = '3s';

-- GC mode, the real build, Owner Billing's O3b: the office answers a change a trade asked for from its portal. It makes
-- the ask a change order to the customer, or turns it down with why (the prototype's draftChangeOrderFromRequest and
-- turnDownChangeRequest). Plan: to-dos/gc-mode/mockups/owner-billing-o3b.md on spike/gc-mode, from the Portal's P4
-- (mockups/portal-p4.md, decision 10). The asks: 20261010006000 (gc_trade_change_requests). The change orders:
-- 20261008010000 and 20261008110000.
--   - Both presses are SECURITY INVOKER. Each refuses in words, before it reads the ask: a training account, a
--     digital twin, anyone but the money team (gc_change_orders is the money team's, and the answer is ours to give
--     even once the trade wave opens the asks to the office), then anyone but a dev while the asks' table is dev
--     only (src/lib/gc/doors.ts).
--   - An ask is answered once: a change order made of it, or turned down. Deleting that draft clears the link
--     (P4a's ON DELETE SET NULL), so the ask can be drafted again. A change order that went to the customer cannot
--     be deleted (gc_change_orders_keep_what_went), so its link stays.
--   - The change order is drafted through gc_draft_change_order on the ask's trade and reason, with the words, cost,
--     price and days the office confirmed (the client's prefill: the ask's words, its amount as our cost, its days,
--     and changeOrderPrice). The trade hears each answer from the office's screen, through gc-trade-email.

-- Make the ask a change order (draftChangeOrderFromRequest). p_draft is O3's draft shape without the trade and the
-- reason, which come from the ask: description, cost, price, days, schedule and planSetId. A draft that names another
-- trade or reason is refused. Returns the change order's id.
CREATE OR REPLACE FUNCTION public.gc_draft_change_order_from_request(p_request_id uuid, p_draft jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_trade_change_requests%ROWTYPE;
  v_draft jsonb := coalesce(p_draft, '{}'::jsonb);
  v_number integer;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot answer a trade''s ask.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot answer a trade''s ask.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_money_team() THEN
    RAISE EXCEPTION 'Only the money team answers a trade''s ask for a change.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev answers a trade''s ask while GC mode is built.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_trade_change_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No change request with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.change_order_id IS NOT NULL THEN
    SELECT number INTO v_number FROM public.gc_change_orders WHERE id = v.change_order_id;
    RAISE EXCEPTION 'It became change order % already.', v_number USING ERRCODE = 'P0001';
  END IF;
  IF v.turned_down_on IS NOT NULL THEN
    RAISE EXCEPTION 'It was turned down on %.', to_char(v.turned_down_on, 'Mon FMDD') USING ERRCODE = 'P0001';
  END IF;
  IF v_draft ? 'packageId' AND (v_draft ->> 'packageId') IS DISTINCT FROM v.package_id::text THEN
    RAISE EXCEPTION 'A trade''s ask stays on its own trade.' USING ERRCODE = 'P0001';
  END IF;
  IF v_draft ? 'reason' AND (v_draft ->> 'reason') IS DISTINCT FROM v.reason THEN
    RAISE EXCEPTION 'A trade''s ask keeps the reason it gave.' USING ERRCODE = 'P0001';
  END IF;

  v_id := public.gc_draft_change_order(v.project_id, jsonb_build_object(
    'description', v_draft ->> 'description',
    'reason', v.reason,
    'packageId', v.package_id,
    'cost', v_draft -> 'cost',
    'price', v_draft -> 'price',
    'days', v_draft -> 'days',
    'schedule', v_draft ->> 'schedule',
    'planSetId', v_draft ->> 'planSetId'
  ));
  UPDATE public.gc_trade_change_requests SET change_order_id = v_id WHERE id = v.id;
  RETURN v_id;
END;
$$;

-- Turn the ask down (turnDownChangeRequest), with why, in words the company reads.
CREATE OR REPLACE FUNCTION public.gc_turn_down_change_request(p_request_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_trade_change_requests%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
  v_number integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot answer a trade''s ask.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot answer a trade''s ask.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_money_team() THEN
    RAISE EXCEPTION 'Only the money team answers a trade''s ask for a change.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev answers a trade''s ask while GC mode is built.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_trade_change_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No change request with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.change_order_id IS NOT NULL THEN
    SELECT number INTO v_number FROM public.gc_change_orders WHERE id = v.change_order_id;
    RAISE EXCEPTION 'It became change order % already.', v_number USING ERRCODE = 'P0001';
  END IF;
  IF v.turned_down_on IS NOT NULL THEN
    RAISE EXCEPTION 'It was turned down on %.', to_char(v.turned_down_on, 'Mon FMDD') USING ERRCODE = 'P0001';
  END IF;
  IF v_note = '' THEN
    RAISE EXCEPTION 'Say why, for the company.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'Keep the reason under 2,000 characters.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_trade_change_requests SET turned_down_on = public.app_today(), turned_down_note = v_note WHERE id = v.id;
END;
$$;

COMMENT ON FUNCTION public.gc_draft_change_order_from_request(uuid, jsonb) IS
  'GC mode (O3b): makes a trade''s ask for a change (gc_trade_change_requests) a draft change order to the customer through gc_draft_change_order, on the ask''s trade and reason with the words, cost, price and days the office confirmed, and links the ask to it. Once per ask; a deleted draft frees it. The money team only, and a dev only while the asks are. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_turn_down_change_request(uuid, text) IS
  'GC mode (O3b): turns a trade''s ask for a change down today, with why in words the company reads. Not once it became a change order or was turned down. The money team only, and a dev only while the asks are. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_draft_change_order_from_request(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_draft_change_order_from_request(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_draft_change_order_from_request(uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.gc_turn_down_change_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_turn_down_change_request(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_turn_down_change_request(uuid, text) TO authenticated;
```

## The bed: `supabase/tests/gc_owner_billing/80_change_requests.sql`

It joins `scripts/pgtest-gc-owner-billing.sh` (its header, and the migration in the second-run list). Its fixture is the
back-charges bed's: a shop being built, Drywall awarded to Iron Horse and signed, Paint to Brushstroke and signed. Iron
Horse asks for three changes the trade's way, as the service role through `gc_trade_ask_change`. Then, through RLS:

- **Who may answer**, each refused before the ask is read: no one signed in, an estimator (the money team's words), the
  controller (on the money team, the dev door's words), a dev in training mode, a digital twin. No refusal touches an ask
  or makes a change order.
- **Make a change order**, as a dev: an ask that is not there; a draft on another trade, as our own work, or with
  another reason; `gc_draft_change_order`'s own refusals (no words, no cost, days below zero) with the ask untouched. Then
  change order 1, a draft on Drywall for a field condition at the confirmed cost, price and days, and the ask pointing at
  it. An ask becomes one change order, and an ask made a change order is not turned down.
- **Turn down**, as a dev: no reason, none at all, past 2,000 characters; then turned down today with its reason trimmed.
  An ask is turned down once, and an ask turned down is not made a change order.
- **The link**: deleting the draft frees the ask; drafted again as the job's change order 1; sent to the customer; a
  change order that went cannot be deleted, so its ask keeps its link. A third ask, the plans with one day, becomes change
  order 2 with `+1 day`.

**Run 2026-10-09** on PGlite 0.5.8 (Postgres 18.3, no port and no shared memory) over Helper 13's stand-ins, the real
training-mode and twin block helpers, and main's GC chain at 6186bb429: 27 of 32 migrations, the five left out being
Owner Billing's money files that read Trades mode's billing tables or the Pipeline's (the pay application send, the
reminder, the interest bill, the Monday email, the controller's reads), none of which writes what O3b reads. The
migration ran twice, and the scenario passed 38 checks. Four mutants of the migration each failed a check: the dev door
said before the money team's (the estimator's words), no link written (the ask points at its change order), no reason
check (a draft with another reason), and the reason not trimmed (turned down today). GitHub's `SQL beds` runs it on the
whole schema in the PR.

## The code

- **`src/lib/gc/tradePortalState.ts`**: `changeRequestFromRow(row)` exported (call 2; Helper 13's nod, 2026-10-09), with
  `partnerId` read from the row's `company_id`; `changeRequestsOf` keeps its filter and sort and maps through it. The
  portal reads the same: its slice keeps only the link's company's rows, with `company_id` carried. Helper 13's P2c-ii
  also edits this file (`sowOf`); whichever of the two lands second rebases and keeps both.
- **`src/lib/gc/changeOrderRows.ts`**: `withChangeRequests(state, rows)` lays the asks over the board's projects, as
  `withChangeOrders` lays the change orders.
- **`src/lib/gc/gcIo.ts`**:
  - `loadGcChangeRequests(projectIds)`: P4a's policy gives rows to a dev only. B2b can read it for Needs you.
  - `draftChangeOrderFromRequest(requestId, draft)` and `turnDownChangeRequest(requestId, note)`: untyped until the
    types PR after the push.
  - `loadGcChangeRequestEmails(requestIds)`: the keys already sent, from `gc_trade_messages` (dev only, the Portal's
    door).
- **`src/components/gc/GcChangeOrders.tsx`**: `ChangeRequestRow` ported, the header's chip, the asked-for line, the delete
  line, and **Tell <company>**. `ChangeOrderWrites` gains `onDraftFromRequest`, `onTurnDown` and `onTell`.
- **`src/pages/GcProjects.tsx`**: reads the asks and their sent keys beside the change orders. The writes send `down` with
  Turn it down, `sent` after Send for signature, and `no` after They declined, when the change order came from an ask.

## Tests

- The mapper on the portal's slice row and the office's table row: the same request from each, and a row from another
  company maps to that company's id (the office's case, Helper 13's ask). `tradePortalState.test.ts` passes unchanged.
- `GcChangeOrders.render.test.tsx`: the ask's row and chip; Make a change order's prefill and its press with the price
  shown; Turn down's note needed and its press; the asked-for line; Tell only while its key has not gone.
- The bed, locally on PGlite and on GitHub's `SQL beds`.

## Docs

- `docs/migrations/<stamp>_gc_change_request_answers.md`, with the verify steps below.
- The release note and its fragment.
- `PROJECT_DOCUMENTATION.md`: the Change orders window's asks.
- `docs/ACCESS_CONTROL.md`: the two functions, the money team, and a dev while the asks' door is shut.
- `docs/GLOSSARY.md`: *Trade change request* gains the office's answer.
- A new guide, `answer-a-trade-partners-change-request.md` ("answer a trade partner's change request on a GC job"), and
  `change-our-contract-with-the-customer.md` links to it.

## Verify after the push

Read only, as P4a's were, every write rolled back:

1. The two functions are there, `SECURITY INVOKER`, open to the signed in and not to `anon`.
2. As an estimator: *Only the money team answers a trade's ask for a change.* As the controller: *Only a dev answers a
   trade's ask while GC mode is built.* Nothing written.

A live answer on the test project, and its email, waits on Grace's yes in Helper 15's chat. Test sends go only to
bids@clickplumbing.com.

## Status

Planned 2026-10-09 by Helper 15 after the lead approved the read-back. The SQL above is as built and tested. Cut from
`origin/main` once the lead merges this, with the stamp and the version claimed then.
