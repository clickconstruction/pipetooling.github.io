# Supply House RFQ Plan

> **Purpose**: phased build plan for the supply-house RFQ system — send a
> price request with near-zero team effort, plug vendor replies in from ANY
> channel (link, pasted text, phone call), and compare quotes per part.
> Design canvas: "Supply House Pricing Requests" (artifact 015286f7…,
> artboards 6–7 = flow candidates + Plug-in screen). Owner-approved shape
> 2026-09-01: ship lanes **A** (quote link rides the existing Supply house
> list text) and **C** (paste-back) on one shared store; lane **B** (system-
> sent RFQ desk with tracking/reminders) only if vendors prove they click.
> Status: **Phases 1–2 SHIPPED** (1a store v2.2629, 1b screens v2.2630,
> 2 link lane v2.2631, 3 memory payoffs v2.2632 — migration
> `20260902030531`, edge functions `get-rfq-quote-page`/`submit-rfq-quote`
> deployed). All planned phases complete; Deferred items remain deferred. Foundations already shipped: Supply
> house list prepare screen (v2.2612/2618), Division 22 ledger + audit
> (v2.2580–v2.2627), `supply_houses` directory, Bid Room token pattern.

## Design principles (from the 2026-09-01 deep review)

- **Unit prices, never totals**: quotes store $/unit; totals recompute
  against *current* quantities, and compare shows quantity drift since the
  RFQ snapshot ("quoted at 752 ft, now 1,100").
- **Name-keyed, like the D22 ledger**: quote lines key on fixture-name
  strings, not part ids. The durable output is a name-keyed price memory
  (`supply_house_fixture_prices`), NOT writes into cost math or
  `material_part_prices` — the name→part bridge does not exist and auto-
  apply-to-costs is explicitly deferred (see Deferred).
- **Vendor effort optional**: every lane feeds the same store; a vendor who
  never clicks anything still becomes a structured quote via paste/typing.
- **Provenance**: keep the raw pasted reply on the quote row; every line
  carries source (`link | pasted | typed`) and match confidence.
- **Honest comparison**: baseline is the bid's current cost/unit or the
  last-quoted price — never the sale-side price book. Coverage-aware
  totals (common-lines apples-to-apples) beside per-part verdicts.
- **Cost-side only**: sale prices/margins never appear in anything vendor-
  facing (the standing Supply house list guarantee).

## Data model (one migration, Phase 1; token column used from Phase 2)

All tables RLS'd (bid-family read; ledger-writer roles write), migration
ends with all three fence appliers. Names snapshot as text.

- `bid_rfqs` — one per send: `bid_id`, `bid_version_id`, `supply_house_id`
  (nullable: ad-hoc vendor), `sent_to` free text (rep name/phone until
  per-house contacts exist), `scope` jsonb `[{name, qty, unit}]` snapshot,
  `needed_by date`, `token text` (unique, Phase 2), `status`
  (`draft|sent|quoted|closed`), `created_by`, timestamps.
- `bid_quotes` — one per vendor reply: `rfq_id` **nullable** (paste-back
  can arrive with no RFQ), `bid_id`, `bid_version_id`, `supply_house_id`,
  `source` (`link|pasted|typed`), `received_at`, `valid_until date`,
  `freight_cents`/`adders_note` (quote-level, not a line), `raw_paste
  text` (provenance), `quoted_by` free text, `note`.
- `bid_quote_lines` — `quote_id`, `fixture text` (snapshot name),
  `unit_price_cents`, **`price_basis`** (`each|ft|per_100|box`) +
  `basis_qty numeric` (box-of-50 → basis `box`, qty 50; $/each derived
  and stored too as `unit_price_each_cents`), `cant_supply bool`,
  `alternate_note`, `match_confidence` (`exact|fuzzy|manual`),
  `matched_from text` (the raw line).
- `supply_house_fixture_prices` — the price memory: `supply_house_id`,
  `fixture text`, `unit_price_each_cents`, `quoted_at`, `source_bid_id`,
  upserted on quote save; unique (house, lower(fixture)). Feeds "last
  quoted" columns in compare and (Phase 3) the prepare screen.

## Phase 1 — store, Plug in quotes, compare (2 PRs) — SHIPPED v2.2629/v2.2630

**PR 1a — migration + kernels** (no UI):
- Migration above (idempotent, lock_timeout, fence appliers).
- Kernel `src/lib/rfq/parseVendorReply.ts`: split pasted text into lines;
  extract size tokens (4", 3/4, 1 1/2…), material keywords (CI/cast iron,
  viega, copper, PEX…), price + basis ("18.90/ft", "$368/box of 50",
  "116 each", "per 100"); produce candidate matches against the bid's
  fixture names with confidence; flag outliers (>10× or <0.1× the
  baseline); classify no-stock phrasing → `cant_supply`. Heavily unit-
  tested against real reply shapes (the artboard-7 sample + variants).
- Kernel `src/lib/rfq/quoteCompare.ts`: rows = union of quoted fixture
  names grouped by D22 section (reuse `classifySpecSection`); per part:
  each house's $/each (grayed when `valid_until` passed), baseline
  (current bid cost/unit when derivable, else last-quoted), best flag,
  drift badge when snapshot qty ≠ current; totals: picked total +
  common-lines apples-to-apples total, coverage per house ("38 of 41").
- Verification gate: kernel tests only; no visible change.

**PR 1b — the two modals**:
- `PlugInQuotesModal` (artboard 7 + unit-basis column from the deep
  review): vendor picker (`supply_houses` + free-text rep), validity
  picker, paste box → Match to fixtures → correction grid (green ✓ /
  amber ? / unassigned click-to-place), per-line basis editor, freight
  field, "type into the grid" path, Save quote (writes quote + lines +
  price-memory upserts).
- `QuoteComparePanel` on the Pricing tab (entry: a "Quotes (n)" chip next
  to the Share button once ≥1 quote exists, plus a Share ▾ item "Plug in
  a quote" for the first one): compare grid per `quoteCompare`, per-line
  pick radios, "Download comparison" CSV. Picks persist on the quote
  lines (`picked bool`) so a later PO/costs phase can consume them.
- Verification gate (BP339 live, the house method): paste the artboard-7
  sample reply → 8 matched / 2 confirm / 2 unassigned; save; compare
  shows Ferguson vs baseline; drift badge by editing a count; expiry
  graying by backdating `valid_until`.

## Phase 2 — the quote link lane — SHIPPED v2.2631 (no new migration needed; the Phase 1 store carried the token column)

- Prepare screen (`PrepareFixtureCopyModal`) grows **Copy with quote
  link**: appends `Price it here: clicktooling.com/q/<token>` to the copied
  text and mints a `bid_rfqs` row (scope = current selection snapshot,
  token = `gen_random_uuid` text). No other habit change.
  - **Order of operations (v2.2851, decision 17): clipboard first, insert
    second.** `src/lib/rfq/rfqCopyLane.ts` is the state machine — `idle →
    prepared → copied → minted`, `prepared → copy_failed → confirm_copied →
    copied`, `cancel → idle` — and `rfqCopyLaneMayInsert` is true only in
    `copied`. A blocked clipboard shows the link in a manual-copy field;
    the row is written when the user confirms ("Link is ready — I copied
    it"), never before; Cancel there writes nothing. A failed insert keeps
    the token so the retry saves the link already on the clipboard. Copy-
    lane rows stamp `created_by` (they did not before). `onRfqMinted` fires
    exactly when the row exists. Background: J12-N1 (live orphan on BP398
    when `writeText` threw after the insert) and J12-N3.
- Edge functions (deploy manually + `docs/EDGE_FUNCTIONS.md` sections):
  `get-rfq-quote-page` (GET by token → scope lines + job context; 404 on
  closed/revoked) and `submit-rfq-quote` (lines + validity + notes →
  `bid_quotes` source `link`, flips RFQ `status='quoted'`). Both
  `verify_jwt = false` in config.toml (Bid Room pattern), service role
  inside, the token is the credential.
- Public route `/q/:token`: **mobile-first** (thumb-size inputs, sticky
  submit), per-line price + can't-supply + note, quote-level validity +
  freight, **draft persistence** (localStorage keyed by token) so a
  10-lines-in interruption loses nothing. Light theme pinned (customer-
  facing convention). Partial quotes allowed.
- Quotes-received signal: "Quotes (n)" chip turns green + RFQ status chip
  on the Pricing header (Sent → Quoted). No email/push in this phase.
- Token hygiene: RFQ `closed` (manual, or bid marked lost/dead) → page
  shows "this request is closed"; re-submit allowed until closed
  (latest-wins in compare, prior quotes kept).

## Phase 3 — price memory pays off (1 PR) — SHIPPED v2.2632 (the compare "Last quoted" column shipped early in v2.2630)

- "Last quoted" column in compare when a house has memory for a name.
- Prepare screen: per-section note "Ferguson last quoted most of this
  scope 12 days ago" (from `supply_house_fixture_prices` recency).
- Quote-expiry awareness: compare header warns "2 quotes expire before
  needed-by".

## Deferred (deliberate, revisit on demand)

> Still-open items tracked in [`to-dos/rfq-apply-picks-to-bid-costs.md`](../to-dos/rfq-apply-picks-to-bid-costs.md); lane B, contacts and file replies shipped (2026-09-05 sweep).

- ~~**Lane B, the RFQ desk**~~ — SHIPPED v2.2636 on owner request
  (2026-09-02): send-rfq-email edge function + RfqDeskModal/RfqComposeModal,
  Sent→Delivered→Viewed→Quoted trails on the existing resend-webhook rail,
  page-open Viewed stamps, previewed sends AND nudges (owner requirement),
  24h nudge throttle, inline bounce fix, manual Close, coverage strip,
  drift badges finally fed from request snapshots. Mockup: artifact
  b731a34b-0ba5-4e82-a450-8f2aec1f64e1.
- **Apply picks to bid costs**: needs a fixture-name→cost-input bridge
  (fixture costs derive from takeoff-book parts); scoping TBD.
- **PO Generator handoff**: picked lines → per-house PO lists in
  Materials. Shape the `picked` flag now (done in 1b); wire later.
- **Per-house contacts** (reps/branches) replacing `sent_to` free text.
- **PDF/spreadsheet replies**: LLM-assisted extraction via an edge
  function; v1 answer is "copy the text out and paste".
- **material_part_prices writes**: only meaningful with the name→part
  bridge; price memory covers the compounding value until then.

## Cross-cutting

- Roles: all RFQ/quote UI gated `canPackageAndSendBidPricing`
  (dev/master/assistant-like/estimator) — matches the ledger writers.
- Every PR: claimed version, release note + recent-features fragment,
  help-guide updates (`send-a-bid-pricing-package.md` grows an RFQ
  section in 1b; a new guide when the link lane ships), migration
  fragments, this doc's phase statuses updated.
- Testing: kernels first (parser gets the largest suite); live BP339
  verification per gate; modal+portal UIs get the elementFromPoint
  hit-test check (the v2.2607 lesson).
- Mockup corrections to fold into the canvas during 1b design: compare
  baseline column relabeled (cost/last-quoted, not "book price");
  unit-basis column on the Plug-in artboard.

last_updated: 2026-09-01 (phases 1–2 shipped)
