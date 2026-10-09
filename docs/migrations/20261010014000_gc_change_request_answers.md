# 20261010014000_gc_change_request_answers.sql

GC mode, Owner Billing's O3b: the office answers a change a trade asked for from its portal (v2.5055). The plan is `to-dos/gc-mode/mockups/portal-p4.md` → decision 10 and `to-dos/gc-mode/mockups/owner-billing-o3b.md`, whose SQL is this file word for word, on branch `spike/gc-mode` as merged by the lead on 2026-10-09 (d4e4efca5). The asks are the Portal's P4a (`20261010006000`, `gc_trade_change_requests`); the change orders are O1's and O3's (`20261008010000`, `20261008110000`).

**Why:** P4a let a trade ask for a change and gave the ask its answer columns, but nothing wrote them. The office had no way to make an ask a change order to the customer, or to turn it down.

## What it does

Two functions, both `SECURITY INVOKER`. Each refuses in words, before it reads the ask:
- no one signed in (*Sign in first.*);
- a training account, a digital twin (`42501`);
- anyone but the money team, `gc_money_team()` (*Only the money team answers a trade's ask for a change.*, `42501`): `gc_change_orders` is the money team's, and the answer stays theirs once the trade wave opens the asks to the office (the lead's calls 3 and 4);
- then anyone but a dev while the asks' table is dev only (*Only a dev answers a trade's ask while GC mode is built.*, `42501`), so the controller hears why rather than "not there".

An ask is answered once: *It became change order N already.* or *It was turned down on Oct 9.*

1. **`gc_draft_change_order_from_request(p_request_id, p_draft)`** locks the ask, refuses a draft that names another trade (*A trade's ask stays on its own trade.*) or another reason (*A trade's ask keeps the reason it gave.*), then drafts through O3's `gc_draft_change_order` on the ask's trade and reason with the words, cost, price and days the office confirmed, so O3's checks and words stand (a won job, words, a cost, a price, days of 0 or more). It writes the ask's `change_order_id` and returns the change order's id.
2. **`gc_turn_down_change_request(p_request_id, p_note)`** needs the reason (*Say why, for the company.*), at most 2,000 characters, and writes `turned_down_on` (the app's day) and the reason, trimmed.

Deleting a draft made of an ask clears its link (P4a's `ON DELETE SET NULL`), so the ask can be answered again. A change order that went to the customer cannot be deleted (`gc_change_orders_keep_what_went`), so its link stays. Grants: the signed in, never anon. No table, so no `apply_*` calls.

## The lock note

`CREATE OR REPLACE FUNCTION` takes no table lock. `SET lock_timeout = '3s';` heads it as every migration's does.

## Verify after the push

Read only, every write rolled back:
1. **Two functions, the caller's rights, closed to anon.** `SELECT count(*), bool_and(NOT prosecdef) FROM pg_proc WHERE proname IN ('gc_draft_change_order_from_request', 'gc_turn_down_change_request');` gives `2, true`, and `has_function_privilege('anon', 'public.gc_draft_change_order_from_request(uuid, jsonb)', 'EXECUTE')` and `has_function_privilege('anon', 'public.gc_turn_down_change_request(uuid, text)', 'EXECUTE')` are `false`.
2. **Who may.** As an estimator, either function refuses with *Only the money team answers a trade's ask for a change.*; as the controller, *Only a dev answers a trade's ask while GC mode is built.* Nothing is written.

An answer on the test project, and its email to the company, waits on Grace's yes in Helper 15's chat. Test sends go only to bids@clickplumbing.com.

## The SQL beds

`scripts/pgtest-gc-owner-billing.sh` re-applies this migration with Owner Billing's others. `80_change_requests.sql` builds a shop being built with two signed trades, asks for three changes the trade's way (the service role's `gc_trade_ask_change`), and checks:
- the two functions, `SECURITY INVOKER`, for the signed in and not anon;
- no one signed in, an estimator, the controller, a dev in training mode and a digital twin, each refused in its words with nothing written;
- an ask that is not there, a draft on another trade, as our own work or with another reason, and `gc_draft_change_order`'s own refusals, each leaving the ask untouched;
- change order 1 made of an ask at the confirmed cost, price and days, the ask pointing at it, and neither answer twice;
- a turn-down with no reason or one too long refused, then turned down today with its reason trimmed;
- the draft deleted freeing its ask, drafted again, sent, and kept with its link once it went.

It ran first on PGlite over main's GC chain at 6186bb429 (38 checks; four mutants of the migration each caught), and runs on the whole schema in GitHub's `SQL beds`.

## Status

Cut 2026-10-09 by Helper 15 (the Owner Billing lane). The lead pushes it once the PR merges.

**Applied to prod 2026-10-09 at 15:26 UTC** by the lead (GC MODE) from a clean checkout at main's tip (58f5956a4) with `scripts/db-push.sh` (`--include-all`, since 015000 was applied first); drift 830/830 after. Verified the same minute through the management API, every write rolled back: step 1, both functions once, SECURITY INVOKER, closed to `anon`; step 2, as an estimator *Only the money team answers a trade's ask for a change.* (`42501`), as the controller *Only a dev answers a trade's ask while GC mode is built.* (`42501`), and as a dev a made-up id gave *No change request with that id.*; 0 requests after. A live answer and its email wait on Grace's yes in Helper 15's chat. The types ride Helper 17's regeneration tonight.
