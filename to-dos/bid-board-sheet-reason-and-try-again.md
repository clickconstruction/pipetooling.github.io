---
name: "The Bid Board's missing-address sheet says why, the day, and offers Try again"
number: 441
group: ready
status: found 2026-11-24 while building #408, which gave the Map page's list these three and left this sheet as it was · filed the same day when #408 was retired
summary: >
  The Bid Board's *N bids have no map location yet* line opens a sheet of its own, where a missing
  address is typed in place (v2.3205). For a bid whose address no map service could place, the row
  says only that the map could not find it. The Map page's list says why, the day it was checked
  and when the app asks again, and has **Try again** (v2.8479). This card gives the Bid Board's
  sheet the same three, from the same kernel.
next: Build it. Read the standing miss for each unplaced row and draw the Map page list's own lines under the row's address box.
size: XS
blocker: None.
opinion: build when someone is next in the Bid Board's map, small — one bid is unplaced today, so few people meet it
mockup: not required — the lines and the press exist on the Map page's list, and this sheet borrows them
---

# The Bid Board's missing-address sheet says why, the day, and offers Try again (#441)

## What happens today

- **The door.** *N bids have no map location yet · add their addresses* on the Bid Board's map
  card opens `src/components/bids/BidBoardMissingAddressesModal.tsx`.
- **A bid with no address** reads *No address on the bid — type the site address and save.* That
  is right as it is.
- **A bid whose address could not be placed** reads *The map couldn't find this address. Check it
  on Google Maps, fix the spelling or add the city, then save.* The words come from
  `missingAddressStatus` in `src/lib/bids/bidBoardMissingAddresses.ts`. The row does not say which
  service answered what, the day it was checked, or that the app will not ask again for 30 days.
- **No way to ask again without a change.** The only press is **Save**, which needs a changed
  address. An address that is right, and missed on a bad day, waits out its 30 days.

## What the Map page's list does, since v2.8479

Each row under *Could not be found* has the reason, *Checked Nov 24. The app asks again by itself
on Dec 24.*, **Open the job** and **Try again**, which asks past the memory. The pieces:

- `src/lib/map/unplacedMemory.ts`: the checked sentence, and each outcome of **Try again** with
  its words.
- `src/lib/map/unplacedTryAgainIo.ts`: the one call, with `retry: true`.
- `src/lib/map/geocodeMissesIo.ts`: the read of the standing misses.
- `src/components/map/MapAddressSheet.tsx`: the row that draws them.

## The plan

1. The sheet's rows read their standing miss, as the Map page's list does. A row with a miss
   draws the reason and the checked sentence under its address box.
2. A row with a miss gets **Try again** beside **Save**. It asks once, says the outcome in the
   row, and a placed address lands its pin as a saved one does today.
3. The row's own words stay for a bid with no address, and while the map is still looking.
4. The help guide for the Bid Board's map says the row's new lines.

## The count, read 2026-11-24

Through the dev seat, counts only: 495 bids, 61 with no address, 1 with an address and no saved
point. So one row would show the new lines today.

## How to verify

- Unit tests on the row's words for each case: no address, still looking, a standing miss, a miss
  with no day kept.
- A render smoke of the sheet: a row with a miss shows the day line and **Try again**, and a row
  with no address does not.
- On a ZZ test bid alone: give it made-up words, open the sheet, read the day line, press
  **Try again** once, and put the address back.
