# Apply Picks to Bid Costs — decision doc (RFQ Round 2, Rung G)

> One page for one owner decision. Mockup: "RFQ Desk" canvas artboard 10
> (artifact b731a34b…). Nothing here is built; the `picked` flag
> (v2.2630) and the lot design below are the shaped-and-waiting inputs.

## The problem

Workbench COST/UNIT is **derived**: each fixture row's cost is its
Takeoffs assignment (a part or assembly). Quotes are name-keyed $/each
with no part breakdown. A picked quote price has nothing to write to —
and writing into part/book prices would poison shared data with one
bid's negotiated number.

## The fact that unblocks it (verified in code 2026-09-02)

The per-row workbench cost is **pre-tax materials** (see
`ownTakeoffAlternates.ts`: "pre-tax materials, as
`derivePricingWorkbench` sums them"); labor, driving, travel, etc. ride
separate cost-estimate components. A supply-house quote is also pre-tax
materials — so a fixture-level override is apples-to-apples, no
materials/labor split needed.

## The recommended shape — option (a), lot-aware

**`bid_count_row_custom_costs`** — the cost-side sibling of the shipped
sale-side `bid_count_row_custom_prices`:

    bid_id · count_row_id · unit_cost_cents
    source: 'quoted' · quote_line_id · lot_group_id (nullable)
    applied_by / applied_at

- Applied ONLY via an explicit **Apply picks to costs** button on the
  compare view, showing a before/after margin preview first.
- Overridden rows wear a tag — **"cost from Ferguson · 9/2"** — with
  one-tap revert to the takeoff-derived number.
- **Lots** (owner decision 2026-09-02): package prices allocate across
  their rows **proportional to takeoff-derived cost** (fallback:
  per-unit), shown as an editable split with a running remainder before
  anything writes; every row from a lot shares one provenance group
  ("Ferguson · carrier package · 9/2 · $18,400") and **revert reverts
  the whole group** — never one shard of a package.
- Drift-honest: if the bid's counts change later, the tag stays and the
  compare drift badge (already shipped) shows the quote is stale; the
  override never silently recomputes.

## Rejected alternatives

- **(b) Part-level mapping** — needs a name→part bridge AND per-part
  quote granularity vendors don't give. Wrong direction.
- **(c) Status quo+** — compare already shows quoted-vs-cost deltas;
  humans hand-edit takeoffs. Zero risk, zero leverage.

## What the owner is deciding

1. Go / no-go on option (a) as scoped above (1 migration + compare
   "Apply picks" flow + workbench row tag/revert; the lot capture in
   the Plug-in modal ships in the same phase since apply depends on it).
2. Whether lot capture should also reach the vendor page in the same
   phase, or follow later (recommendation: later — vendors state
   packages in prose; the office groups them at plug-in time).

Say go and this becomes the next rung, mockup-first like the others.
