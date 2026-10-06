# 20261007050000_bid_changes_action_tag.sql (2026-10-06, v2.4736)

Bid history, PR 1b (punch list #73, [`to-dos/bid-history`](../../to-dos/bid-history/README.md)): the request tag. Fills the two columns PR 1 left for it on `bid_changes`.

- `bid_change_action()` — the `x-bid-action` request header as PostgREST hands it to the database (`current_setting('request.headers', true)`, a JSON object with lower-cased names), accepted only as a slug (`^[a-z][a-z0-9-]{1,40}$`), else null. Never raises.
- `bid_changes_app_actions()` — the tags that are the app's own writes, not a person's press: `labor-sync` today. `src/lib/bids/bidActionHeader.ts` mirrors it and `bidActionHeader.test.ts` fails CI when they disagree.
- `record_bid_change()` replaced **in full** (the newest definition): the same body as `20261007040000_bid_changes`, reading the tag just before its insert into `action` and `by_app` (true for an app action, false for a tagged press, null with no tag).

The client sends the tag per call (`withBidAction(query, BID_ACTIONS.x)` — the Counts import's batches, Clear all counts, the Labor tab's load sync, the Pricing tab's fill from the book) or per client (twin-mcp's `paste_counts`, `global.headers`). Nothing else changes: an untagged write records null in both columns, as every row did before.

No new table, no policy change, no lock on a bid table (three `CREATE OR REPLACE FUNCTION`s). Apply order: **with or after the client**; the old client simply never sends the header. Deploy `twin-mcp` after the push so a robot's paste reads as the robot's.

Test: `supabase/tests/bid_changes/20_scenario.sql` case 16 — a tagged press, the app's tag, a tag that is not a slug, no tag. The bed re-applies this file too (`scripts/pgtest-bid-changes.sh`).
