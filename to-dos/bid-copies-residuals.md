---
name: "Bid copies: what a new version, a duplicate and an adopt still leave behind"
number: 79
group: residual
status: found 2026-10-01 building #78 (v2.4388) · not started
summary: >
  v2.4388 made a new version, a duplicate and an adopt keep a Combined takeoff's stage boxes and
  order rules, and added a test that fails when a copy drops a column or a table. Building it
  turned up four more gaps in the same three functions, each needing a small decision first.
  A new version or a duplicate does not carry the supply house costs applied to fixtures. A
  duplicate of a bid that has versions stacks every version's rows into one list. A duplicate
  keeps pointing at the first bid's own prices. An adopt leaves the takeoff picks of a submittal
  under the retired bid.
next: The owner picks, per gap, the default written under it or another. Then one migration per gap.
size: S — four small migrations, no screen changes
blocker: Four small calls, each with a default.
ver: v2.4388
opinion: build 2 first — a duplicate of a bid with versions doubles its counts, and nothing warns
mockup: not required — database copy fixes; no screen changes
---

# Bid copies: what a new version, a duplicate and an adopt still leave behind

## The ask

Found on 2026-10-01 while building #78 (v2.4388). The owner asked of that plan: *is this the best
we can do?* The audit that answered it read every table that hangs off a count row and every
column the three copy functions name. #78 fixed the stage boxes, the order rules and the
duplicate's labor and travel columns. These four are what is left. Each changes what a copy
means, so each waits for a yes.

## The gaps

1. **Quoted fixture costs do not follow a copy.** `bid_count_row_custom_costs` holds the supply
   house cost applied to a fixture (*Apply picks to costs*, v2.2655). It has a `count_row_id` and
   no foreign key. `create_bid_version` and `duplicate_bid_to_service_type` never copy it, so the
   copy's cost falls back to the takeoff. `adopt_bid_as_version` leaves the rows under the
   retired bid. Deleting a count row leaves its cost row behind.
   - *Default:* a new version copies them, giving each package (`lot_group_id`) a new id so a
     revert in one version leaves the other alone. A duplicate in the same trade copies them. A
     duplicate into another trade does not, because the quote is another trade's. Adopt moves
     them. Add the foreign key with `ON DELETE CASCADE` after removing orphans.
2. **A duplicate of a bid with versions stacks every version's rows.**
   `duplicate_bid_to_service_type` copies every count row of the bid with no version, so a bid
   with two versions of three rows gives a copy with six rows and doubled counts. Proven on a
   local copy of the schema on 2026-10-01.
   - *Default:* copy only the version the bid is on (`selected_bid_version_id`, else the first by
     `sort_order`), as one unsplit bid.
3. **A duplicate keeps pointing at the first bid's own prices.** Custom prices, hidden rows,
   assignments and `selected_price_book_version_id` are copied with the same
   `price_book_version_id`. When that price belongs to the first bid (`price_book_versions.bid_id`),
   the copy's Pricing tab reads prices by its own bid and finds none.
   - *Default:* clone each of the source's own prices with `clone_price_book_version_to_bid`, as
     `create_bid_version` does, and re-key the copies onto the clones.
4. **An adopt leaves a submittal's takeoff picks behind.** `bid_submittal_takeoff_choices` is per
   bid and count row. Adopt moves the count rows to the package and leaves the picks under the
   retired bid.
   - *Default:* leave it. A submittal is built after the award, on the bid it was built on, and a
     bid is adopted before it is sent. Say so in the test and close the gap as decided.

## Where it plugs in

- The newest bodies of all four functions are in
  `supabase/migrations/20261002100000_combined_copies_keep_stages.sql`.
- `src/lib/bids/bidCopySql.test.ts` lists gaps 1 and 4 under `NOT_CARRIED_YET`. Remove a table
  from that list in the PR that teaches the copies about it.
- `npm run test:pg:combined-copies` runs the copies on a throwaway copy of the whole schema
  (`supabase/tests/combined_copies/20_scenario.sql`). Add a step per gap.
- Callers: `useBidTradeSwitch.ts` (duplicate), `BidVersionPicker.tsx` and `BidsPricingTab.tsx`
  (new version), `AdoptBidModal.tsx` (adopt), `useBidCustomCosts.ts` (quoted costs).

## How to verify

Each gap gets a failing step in the scenario first, then its migration, then
`npm run test:pg:combined-copies`. Live, on a ZZ test bid: make a version, a duplicate and an
adopt, and read Pricing on each copy.
