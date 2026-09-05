# RFQ Rung G: apply quote picks to bid costs (lots first)

Status: not started · owner approved option (a) 2026-09-02 · plan: [`docs/RFQ_ROUND2_PLAN.md`](../docs/RFQ_ROUND2_PLAN.md) → Rung G; deferred list in [`docs/SUPPLY_HOUSE_RFQ_PLAN.md`](../docs/SUPPLY_HOUSE_RFQ_PLAN.md)

## The ask, in the owner's words

Vendors' best prices are often package prices spanning several rows, and a picked quote today has nothing to write to — fixture cost is derived from takeoff parts. The owner (2026-09-02) chose **option (a)**: a fixture-level cost override with provenance, plus lots captured office-side first, vendor-page lots later.

## The decision

- **(a) Fixture-level cost override** — a `bid_count_row_custom_costs` sibling of `bid_count_row_custom_prices`: `cost_source: takeoff | quoted`, cents, provenance (quote line, house, date), a visible "cost from Ferguson 9/2" tag, one-tap revert, applied only through an explicit "Apply picks to costs" button with a before/after margin preview.
- **Lots**: `lot_id` + `lot_total_cents` on quote lines, grouped by a human tap (the parser already flags all-in / package / lot wording since v2.2651); compare lots as lots; apply with a visible, adjustable split (default proportional to takeoff-derived cost).
- Rejected: part-level mapping (vendors do not quote per part); status quo.

**Open question to answer in code first**: is the takeoff unit price materials-only or does it blend labor? A quote is materials-only, so a blended cost needs a materials-only sub-field or the override corrupts margins. Start at the Workbench's COST/UNIT derivation (`BidsPricingTab.tsx` → takeoff cost inputs).

## Validation 2026-09-05

- Rungs A–F shipped (v2.2642–v2.2654). Rung G has no code yet; the Rung-G groundwork (amber "one price for several items?" chip) is live since v2.2651.
- Still deferred in the same area, revisit when G lands: PO Generator handoff (picked lines → per-house PO lists), `material_part_prices` writes (needs the name→part bridge), the scanned-PDF LLM lane (until real files demand it).

## Where it plugs in

- Quote store + compare: `src/lib/rfq/*`, `src/components/bids/Rfq*.tsx`, `send-rfq-email` / quote-link functions.
- Sale-side precedent to mirror: `bid_count_row_custom_prices` (table + writers in the Workbench).
- Roles: everything behind `canPackageAndSendBidPricing`.

## The plan

1. Decision doc + mockup of option (a)'s row treatment on the RFQ Desk canvas (artifact `b731a34b`), including the materials-only answer.
2. Migration: `bid_count_row_custom_costs` + `lot_id` / `lot_total_cents` on quote lines (both fence appliers, lock_timeout).
3. Lots in Plug-in and compare (group by tap, bracketed compare, atomic pick).
4. "Apply picks to costs" with margin preview, tag, revert; help guide `send-a-bid-pricing-package.md` grows a section.

## How to verify

- Live BP339 (the RFQ test bid) per the plan's gate: plug a lot, pick it, apply, watch the Workbench margin move and the tag show provenance; revert restores the takeoff cost.
