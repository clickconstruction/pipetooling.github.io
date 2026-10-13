# 20261014120000_portal_opens_since.sql (2026-10-13, v2.5483)

Messages, cut 7f's follow-up (GC Mode helper 8, directed by the lead session GC MODE). The message window's Files says, beside a link to their portal on a line we sent, how often they opened their portal since: *they opened their portal twice since, last Mon Oct 12 at 2:10 PM*. The mock-up is `to-dos/gc-mode/messages/files-out-mockups.html`, screen 6, on spike/gc-mode. One read, no table.

## What it does

**`portal_opens_since(p_surface, p_entity_id, p_since)`** answers one row: how many outside opens one portal had from `p_since` on, and the last.

- `p_surface` is `gc_trade_portal`, a trade partner's portal, with `p_entity_id` its `gc_companies` id, as `gc-trade-portal` counts its views. Or it is `portal`, a customer's portal, with `p_entity_id` the customer's id: the page's loads. A paper opened on the customer's page is its own `portal_paper` row and is not counted.
- Outside opens only. A teammate's look and the office's preview are stamped and never counted.
- It counts the portal's opens, never the one file's: a portal's views are the whole portal's.
- The office team only (`gc_office_team()`, inside the read). Anyone else, and any other surface, reads 0.
- `SECURITY DEFINER` with `SET search_path = public`, since `public_page_views` is a dev's read under its own rule. `customer_portal_views` counts a customer's opens for all time, and nothing read a trade partner's opens back for the office before this.
- The `(surface, entity_id, occurred_at)` index serves it.

No table, so no house calls.

## Checked before the push

The SQL bed `portal-opens-since` (`npm run test:pg:portal-opens-since`) runs every migration on Supabase Postgres 17, then this one a second time, which must change nothing, then the scenario. Docker does not run on the office Mac, so it runs in the SQL beds workflow once the PR is ready.

- The office reads a trade partner's portal opened twice since the line, the last at 19:10, a teammate's look not counted.
- It reads a customer's page opened once since, its paper's own row not counted.
- From a later time it reads none. Another surface, or a paper's rows on their own, reads none.
- A superintendent reads none.
- Anon cannot run it, the office can, and it reads as its definer.

## After the push

Nothing to deploy: the app reads it through `messagesIo.loadPortalOpensSince`. Until the push, the message window's link to their portal shows how it went without the opens.
