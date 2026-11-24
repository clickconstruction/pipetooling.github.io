---
name: "Remember an address the map cannot place"
number: 408
group: ready
status: asked 2026-11-20 as a loose end of v2.8049 · sized the same day from the code, the function logs and the dev seat · the owner's word to build it 2026-11-24, on the plan's three picks · steps 1 and 2 shipped as v2.8473 and v2.8477 · step 3 not built
summary: >
  When no map service can place an address, the app keeps nothing, so every screen that lists that
  record asks again on every open: OpenStreetMap, then Google, then the Census. Five addresses cause
  it today (three jobs, a bid and an estimate, four of them words and not a street address), and
  they cost 80 to 250 calls a day, about 100 to 350 of them to Google. The card keeps a miss beside
  the saved points with the day it was checked, so a screen that reads it does not ask again, and
  gives each *no map location yet* line a press that opens the list and the fix.
next: Deploy `geocode-address-batch` and `geocode-one` once v2.8477 is on the live site, then the check on a ZZ test job. Then step 3, the press. Step 0 needs no code and is a person's to do. The owner's three calls stay open to flip.
size: S as a train of three (XS · S · XS)
blocker: None. The three calls are built to the plan's picks and listed for the owner to flip.
opinion: build, small — it is under Google's free count today, so the gain is headroom and a faster Pipeline open, and fixing the five by hand is ten minutes either way
mockup: not required — the count line and the list exist on the Map page, and the other maps borrow them
---

# Remember an address the map cannot place (#408)

## The ask

A loose end the v2.8049 session left on 2026-11-20, after it took the automatic check of the live
site off Google Maps ([the fragment](../docs/recent-features/v2.8049.md), *What to watch*):

> Making the app remember addresses it can't place, so screens stop asking Google about them again.
> Not built; it would need its own card if you want it.

The owner had it investigated the same day and said *Yes, file it*.

## What happens today

- **The hook.** `src/hooks/useAddressGeocodeCoords.ts` reads the shared cache `address_geocodes`,
  then sends every address not in it to the edge function `geocode-address-batch`.
- **The function.** It asks OpenStreetMap, then Google, then the US Census
  (`supabase/functions/geocode-address-batch/index.ts`). A hit is saved to `address_geocodes`.
- **A miss is saved nowhere.** `address_geocodes.lat` and `lng` are NOT NULL, so the table cannot
  hold one. Its `geocode_error` column is empty on all 1,500 rows. The function returns the miss in
  `failures`, and the hook does not read it.
- **So a miss is asked again.** The hook remembers what it asked only while the screen is open
  (`askedRef`). The Map page's own reader (`src/hooks/useMapPageData.ts`) has no such memory at all.
- **No pin by hand.** `jobs_ledger`, `bids`, `customers` and `estimates` have no point of their
  own, so no caller can skip a record whose place someone has already settled.

### The screens that ask with no press

| Screen | What it sends |
|---|---|
| Dashboard, *Your jobs on a map* | the viewer's jobs, unless the map is hidden on that device |
| Pipeline, *Jobs on a map* | every job on the board, unless hidden on that device |
| Bid Board, *Bids on a map* | every bid on the board, unless hidden on that device |
| The Map page | every job, bid and estimate, on every load and every *Reload data* |
| Quickfill and Schedule, travel hints | the day's scheduled jobs |
| *Needs you*, on the Dashboard and Quickfill | jobs with an open *waits on them* bullet |
| The Legal desk | jobs in Collections and Given up |
| Tally and Materials, *On site* | the picked job |
| The job form, *On the map* | the job's address, each time the form opens |

On a press only: the clocked-in map window, a trip's miles, the bid form's distance to the office,
a painted map opened empty.

## The count, read 2026-11-20

Through the dev seat, counts only.

| | Rows | No address | Address, no saved point |
|---|---|---|---|
| Jobs | 934 | 7 | **3** (2 working, 1 paid) |
| Bids | 486 | 60 | **1** |
| Estimates | 54 | 30 | **1** |

Five addresses in all. Four of the five have no number in them: they are words, not a street
address. None is a ZZ test record by name.

From the function logs, calls to `geocode-address-batch` that did not come from the automatic check:

| Day | Calls | People |
|---|---|---|
| Sunday Nov 15 | 98 | 4 |
| Wednesday Nov 18 | 251 | 5 |
| The 24 hours to Nov 20, 20:00 UTC | 79 | 3 |

By how long each call ran, the Wednesday's 251 calls carried about 350 addresses that every service
missed. Each is one Google Geocoding request, one to OpenStreetMap and one to the Census, and 2 to 5
seconds of waiting before the screen's map settles. Only three rows were added to the saved points
that day, so nearly all of it is the same five addresses asked again.

November's whole count is under Google's free monthly count as far as the logs show (about 3,556
calls through Nov 20, two thirds of them the automatic check's, which stopped that day). So this is
headroom and a faster screen, not a bill.

## The plan

0. **Today, no code.** Fix the five addresses. The Map page's line *N records have no map location
   yet · fix their addresses* lists them, with a door to each record. That ends nearly all of
   today's repeat asks. It comes back the next time someone types a vague address.
1. **A place to keep a miss (XS, one migration).** A new table `address_geocode_misses`: the address
   key, the reason, the day it was checked. A new table, so the house rules apply: the lock timeout
   on the first line, the four fences at the end, idempotent, `supabase db push` only after the
   merge, its page in `docs/migrations/`. Open to any signed-in user to read and write, as
   `address_geocodes` has been since v2.3131.
   **Shipped as v2.8473 on 2026-11-24** ([the fragment](../docs/recent-features/v2.8473.md)). Two
   things differ from the lines above. A saved point takes its miss away through a trigger on
   `address_geocodes`, so the functions hold no delete. The server stamps the day on every write.
2. **The functions and the readers (S).** `geocode-address-batch` and `geocode-one` write a miss
   when all three services say *not found*. They never write one when a service was down, refused
   the key or was over its limit, or an outage would mark good addresses for weeks. Before asking,
   they read the miss: checked in the last 30 days means no ask, and the answer says so. A hit
   removes the miss. A changed address is a new key, so it is asked afresh. `useAddressGeocodeCoords`
   and `useMapPageData` read the misses with the saved points and send only what is in neither. A
   write refused for a person in training mode is skipped, as the cache write already is. Both
   functions are deployed after the merge, with their sections in `docs/EDGE_FUNCTIONS.md`.
   **Shipped as v2.8477 on 2026-11-24** ([the fragment](../docs/recent-features/v2.8477.md)). Three
   things differ from the lines above. The functions hold no delete, since step 1's trigger takes a
   miss away on a hit. The readers read the misses after the saved points, for the addresses with no
   point alone, so an open with every address placed makes no extra request. The 30 days are one
   constant, `GEOCODE_MISS_STANDS_DAYS`, in a file the functions and the screens share.
3. **The press (XS).** *N jobs have no map location yet* on the Dashboard, Pipeline and Bid Board
   cards becomes a press that opens the Map page's list: each record, why it could not be placed and
   the day it was checked, **Open the job** to fix the address, and **Try again**, which asks past
   the memory. The job form's *could not place it* line keeps its own **Try again**. A help guide
   and a release note go with it.

## What it saves

About 100 to 350 Google Geocoding requests a day, the same again to OpenStreetMap and the Census,
and 2 to 5 seconds off each open of a map for the people whose jobs include one of the five.

## The owner's calls

The owner said to build it on 2026-11-24. Each call is built to the plan's pick and can be flipped.

1. **Shared memory, or one per phone.** The plan above is shared: one migration, and every device
   benefits from the first miss. A memory kept on each phone needs no migration and no function
   change and saves most of it, but every phone still asks once, and it does not help the Map page.
   The plan takes shared.
2. **How long a miss stands before it is asked again by itself.** The plan takes 30 days.
3. **A pin by hand for a job.** Four of the five are words no service will ever place. A pin dropped
   by hand is the real fix for those. Jobs have no point of their own today, so that is a card of
   its own and not a step of this one. Until then such a job stays off every map, with its line
   saying so.

## How to verify

- **Before.** Open the Pipeline as a person whose board holds one of the five. The function log
  shows one `geocode-address-batch` call for each open.
- **After step 2.** The first open writes the miss. The second open makes no call. Change the
  address on a ZZ test job to made-up words, open the Pipeline twice, and read the log.
- **After step 3.** The count line opens the list. **Try again** makes one call and updates the day.
- The count script from the read of 2026-11-20 pages the dev seat and prints counts only. Running it
  again gives the number of unplaced addresses at any time.
