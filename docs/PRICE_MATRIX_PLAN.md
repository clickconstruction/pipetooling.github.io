# Robot price matrix — build plan

---
file: docs/PRICE_MATRIX_PLAN.md
type: Plan
purpose: Build plan for Wendi's robot price matrix — a pricing twin that reads supply-house fixture quotes (PDFs in the bid's Price-requests folders), structures them as kits + option groups on the existing quote store, and hands back a best-price compare with robot picks, reasons, and questions where the plans decide
audience: Developers, AI Agents, the twins operator
last_updated: 2026-09-10
key_sections:
  - name: "What we're building"
  - name: "Owner decisions (locked 2026-09-10)"
  - name: "What the real quote taught the design"
  - name: "Data model"
  - name: "The PR train"
  - name: "Guardrails"
  - name: "Verification per PR"
---

## Status: PRs 1–6 (v2.3263 · v2.3267 · v2.3270 · v2.3274 · v2.3275 · v2.3277) MERGED — migrations `20260911023538` and `20260911043553` pushed, twin-mcp v1.4.1 + plan-fetch + twin-setup deployed; the pricer's first live run on ZZ Test b398 went claim → Drive read → put_quote → ask → Settle → re-finish end to end, and "Set up on this Mac" minted and redeemed a code live (get_pricing_guide answered with the minted key) on 2026-09-11

Design canvas (two pages — Wendi's view, Dev's view): https://claude.ai/code/artifact/fbeb5904-fefc-4fbc-bbb2-6ff03aa0a893

## What we're building

Wendi's ask (2026-09-10): "a button that lets me find a matrix of the best prices for my fixtures — queue it up so the robots read the quotes and run the price-matrix math the way they spend compute backtesting bids — and teach them to add carriers to the correct item, the WC-1 carrier with the WC-1 fixture."

Today the supply-house loop already exists on **Bids → Pricing**: send the list (`PrepareFixtureCopyModal`), plug replies in (`PlugInQuotesModal`, `parseVendorReply`), compare per part (`QuoteCompareModal`, `quoteCompare.ts`), pick, and **Apply picks to costs** (`bid_count_row_custom_costs`). Hand-sent requests and their Drive links live on the bid's **Price requests** table (`bid_rfqs`, outside lane, v2.3175). What is missing is the reader: a vendor's fixture quote is a multi-page PDF structured by fixture tag, and a heuristic line parser cannot see the structure. The robot can.

So: a **pricing twin** (`twin-pricer-1`) that never bids. Wendi queues a request from the Pricing tab; the dispatcher hands it to the pricer; the pricer reads every page of every quote behind the bid's folder links, writes structured quotes onto the existing store (`bid_quotes` / `bid_quote_lines`, `source = 'robot'`), groups components into the fixture they belong to, picks the cheapest **complete** kit per row with a reason, and asks Wendi (estimator lane of `twin_questions`) wherever the plans decide — which carrier variant, which size. She reviews the same compare grid she uses today, corrects, and applies. Her corrections become the pricer's rulebook.

## Owner decisions (locked 2026-09-10)

1. **Quote PDFs live as links in Drive folders the twins already read** (the intake service account). No upload lane; the bid's Price-requests table is the source of the links.
2. **A separate twin for pricing.** `twin-pricer-1` owns no bids and is refused every bid verb, so reading a live bid's fixture list can never contaminate a shadow. Same fleet chrome, its own key, revocable on its own.
3. **The robot never sends anything** (no-send doctrine holds), **never writes costs** (Apply picks stays Wendi's), and **never guesses a plan-decided choice** — it asks.
4. **Ship in small PRs, testing as we deploy**, kernel-first.

## What the real quote taught the design

National Wholesale Supply quote S6277623 (SpaceX BA-2 Core & Shell, 2026-09-02, revised 2026-09-09) against Wendi's real count rows on b359:

- **Fixtures are priced as kits by subtotal.** "Subtotal ------- WC-1 & WC-2 EACH 1010.00" is the fixture price; the bowl, flush valve and seat under it carry **no unit price**. → a `kit` role line holds the $/each; unpriced component lines ride it.
- **Carriers live on a second sheet keyed by tag** ("SEE THE CARRIER AND DRAIN QUOTE FOR THE CARRIER PRICING" → "WC-1 & WC-2 (CARRIERS)"), with **eight Josam variants** from $298.75 to $713.52. → the pricer follows the pointer, attaches the carrier role to the fixture, and **asks** which variant the plan calls for.
- **Size lists share a subtotal that sums the alternatives.** RPZ-1 lists six Watts sizes; the printed subtotal $42,135.09 is 2½in + 3in + … + 10in. → `option_group`, never summed; the 4in from her takeoff is the pick.
- **The printed Amount Due is not a job total.** $72,291.14 = one of everything + all six RPZ sizes + tax. At her counts the 23 priced rows come to $92,420.21. → the pricer prices rows × snapshot counts only.
- **Validity is 48 hours**; freight is a per-line "PLUS FREIGHT"; LAV-1's kit hides crating and freight & handling inside it. → expiry marked, never hidden; freight not stated stays labeled.
- **Headings cover two tags** ("WC-1 & WC-2", "RD-1 & RD-3") while her rows are "WC1&2" (one row) and "RD-1" / "RD-3" (two rows). `fixtureKey()` alone cannot join those → `splitTagHeading` / `tagsInCommon` in `quoteKits.ts`.

## Data model (PR 1, one migration — `20260911023538_price_matrix_requests.sql`)

All additive and idempotent; every CREATE TABLE ends with the three fence appliers.

- `bid_quote_lines` gains `component_role text` (checked against `COMPONENT_ROLES` in `quoteKits.ts`: kit · bowl · seat · flush_valve · carrier · faucet · drain · trap · supply · stops · trim · mixing_valve · accessory · freight · loose), `label text` (the vendor's description), `option_group text`, `option_label text`, `option_chosen boolean`, `page_ref text`, `pick_reason text`, `pick_source text` (`human` | `robot`).
- `bid_quotes.source` check widens to include `robot`; gains `source_doc_url text` (the file the robot read) and `robot_request_id uuid`.
- `bid_price_matrix_requests` — one per ask: `bid_id`, `requested_by/at`, `scope jsonb` (`[{count_row_id, fixture, count, unit}]` snapshot), `sources jsonb` (`[{rfq_id, supply_house_id, house_name, url}]` from the Price-requests table at queue time), `status` (`queued` | `working` | `ready` | `blocked` | `cancelled` | `done`), `claimed_by` (twin user), `claimed_at`, `heartbeat_at`, `finished_at`, `summary text`, `result jsonb`.
- `fixture_component_rules` — the pricer's rulebook: `rule text` (plain words the robot reads), `kind` (`placement` | `sheet` | `option_default` | `required_role`), `fixture_pattern text`, `role text`, `active`, `source` (`human` | `robot`), `created_by`, `source_bid_id`, `times_used`, `last_used_at`, `mirror_note`.
- `fixture_component_corrections` — Wendi's teaching: `request_id`, `bid_id`, `quote_line_id`, `action` (`move` | `unpick` | `repick` | `not_a_component` | `choose_option`), `from_fixture`, `to_fixture`, `from_role`, `to_role`, `remember boolean`, `rule_text`, `created_by`, `digested_at`.

Kit math lives in `src/lib/rfq/quoteKits.ts` (pure, tested); `buildQuoteComparison` calls it per (house, fixture) when a quote is structured, so today's plain quotes compare exactly as before.

## The PR train

| PR | Contents | Depends on |
|---|---|---|
| 1 · schema + kernel | Migration above · `quoteKits.ts` (+ tests) · kit-aware `quoteCompare.ts` · this plan doc. No UI change. | — (push migration after deploy; types chore PR after push) |
| 2 · the door | `PricingShareMenu` child item **Price it with the robot** · the queue sheet (sources from the Price-requests table, scope snapshot) · request row insert · Pricing chip states (queued / working / ready) · Robots Queue lens **Price matrices** section · Console **Bids to run** chip · help guide section. | 1 pushed |
| 3 · the pricer | Fleet: mint `twin-pricer-1` (kind `pricer`; every bid verb refused) · twin-mcp verbs `next_price_matrix`, `get_quote_documents`, `put_quote`, `finish_price_matrix`, `get_component_rules`, `extend_component_rules` · `docs/twins/kickoffs/pricing-operator.md` + `docs/twins/pricer.md` brief · Console third column **Pricing robot** · deploy twin-mcp · `EDGE_FUNCTIONS.md`. | 2 |
| 4 · the matrix | `QuoteCompareModal`: kit rows with component lines, option rows ("needs a size"), robot reasons column, **Settle them** (answers the pricer's asks in place) · corrections written on every move/unpick/choose · receipts (rules with times used). | 3 |
| 5 · the loop | Needs You card "The robot priced BP…" · Scoreboard axis (picks agreement %, rows asked, corrections per quote) · rule digest verb + receipts on the Console. | 4 |
| 6 · set up on this Mac | `twin_setup_codes` + `twin-setup` edge function (mint a 10-minute one-time code; redeem mints the key server-side) · one Terminal command that writes Desktop's config, restarts Desktop, copies the kickoff — the key never shown · **Set up on this Mac** on Scoreboard (estimators, pricer only), Console, Settings fleet rows · kickoffs generated into `_shared/twinKickoffs.ts`. | 5 (any order; ships after) |

## Guardrails

- **Fence.** The pricer writes only `bid_quotes` / `bid_quote_lines` / `bid_price_matrix_requests` / `fixture_component_rules`, only while a request on that bid is `working`, and every write is stamped `source = 'robot'` / `pick_source = 'robot'`. Bid verbs (`next_shadow`, `open_backtest`, `paste_counts`, …) refuse a pricer token in plain words.
- **Blindness.** The pricer reads the request snapshot, never the human bid's pricing or value. It has no bid to protect, so its own reads cannot contaminate a shadow.
- **Honesty rules carried from the RFQ plan:** unit prices never totals; cost-side only; expired quotes visible and marked; freight not stated ≠ free; apples-to-apples totals; and the kit rules above (incomplete never cheapest; options never summed; printed grand totals never job totals).
- **Docs per PR:** claimed version, release note + recent-features fragment, migration fragment, help guide, this doc's status line.

## Verification per PR

- **PR 1:** kernel tests (`quoteKits.test.ts`, `quoteCompare.test.ts`); migration replayed on a scratch Postgres if a table is created; after push, `npm run check:migration-drift` clean and a read-only probe that `bid_quote_lines` has the new columns.
- **PR 2:** live on ZZ Test b398 as dev: queue a request → row appears with the snapshot and sources; chip flips; Queue lens lists it; cancel takes it back.
- **PR 3:** run the kickoff against b359's NWS quote from a Claude Desktop chat as `twin-pricer-1`; expect 23 priced rows, 4 asks, WC1&2 kit $1,010 + carrier, RPZ 4in picked with the "sum of alternatives" flag; a bid verb from the pricer token refused.
- **PR 4:** open the compare on b359: kit rows expand, incomplete/option cells never starred, Settle answers write corrections; Apply picks unchanged.
- **PR 5:** Needs You card appears on ready; Scoreboard axis renders from a second run.
