---
name: "The Bid Board's missing-address sheet says why, the day, and offers Try again"
number: 441
group: ready
status: built 2026-11-24 as v2.8539 · walked live 2026-11-25 on a ZZ Test bid at 1280 and 375 px, and it holds · left: the owner's word on which rows offer Try again, and two small mends the walk asked for
summary: >
  The Bid Board's *N bids have no map location yet* line opens a sheet of its own, where a missing
  address is typed in place (v2.3205). For a bid whose address no map service could place, the row
  says only that the map could not find it. The Map page's list says why, the day it was checked
  and when the app asks again, and has **Try again** (v2.8479). This card gives the Bid Board's
  sheet the same three, from the same kernel.
next: The owner says whether Try again stays on every unplaced row, as built, or only on a row with a kept miss. Two small mends from the walk, the client alone: plain words where a row's reason shows a map service's error code, and four presses that are under 44 px on a phone. Then delete this card.
size: XS, built; left: two mends (XS each)
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

## The live walk of 2026-11-25

Walked on clicktooling.com as the dev, on the build that holds v2.8539, at 1280 and 375 px.

**Holds, the whole recipe.**

- Read only first. The sheet *Bids the map can't place* read 55 bids without an address and 1 the map could not place. The 55 have **Save** and **Edit bid**, some **Use it**, and none has a day line or **Try again**. The 1 has the row's own words, the reason, *Checked Nov 24. The app asks again by itself on Dec 24.* with both days bold, and **Try again** beside **Save**.
- Then on a ZZ Test bid, its address set through the dev seat to made-up words. Its row read the same lines, with the company's day and the day 30 days on. **Try again**, pressed once: the press read *Asking the map services…* and was dead, one call went, and the row added *Still no match. Fix the address in the box and save to place it.*
- At 1280 px the box, **Save** and **Try again** are on one line. At 375 px **Try again** wraps under the box at 44 px, and nothing passes the sheet's edge.
- The address was put back and read back as found.

**Not pressed.** **Save** in the sheet, **Use it**, **Check on Google Maps ↗** and **Edit bid**.

**Two small things the walk asked for, read in the code the same day, not built.** Each is the client alone.

1. **A map service's error code is in a line a person reads.** The one real row's reason ends its first part with a service's name and *HTTP 403*. Those words are old: that service is no longer asked (v2.8512), and a miss kept before then holds them until its address is asked again. The line is put together where it is drawn (`geocodeErrorMessage.ts`), and the Map page's list and five other screens draw the same line. Plain words there mend all of them and every kept row at once.
2. **Four presses are under 44 px at 375 px.** *Check on Google Maps ↗*, **Edit bid** and **Use it** are 19 px high, and the bid's number press 21.

**The open call.** **Try again** is on every unplaced row the map is done looking for, with or without a kept miss, as the Map page's list has it. The plan above said *a row with a miss*. The walk could not see the difference, since both rows with an address had a kept miss.

**Left on the live site.** One kept miss for the made-up address, which nothing deletes by hand and which stops standing after 30 days. Two lines on the ZZ Test bid's History, for the address set and put back.
