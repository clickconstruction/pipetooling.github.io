---
name: "Permits: the owner lookup as a whole, city by city"
number: 320
group: ready
status: measured 2026-11-11 while #316 was built · Grace's go for the whole train the same day · PRs 1, 2, 3, 3b, 6, 5 and 7 merged, deployed and checked 2026-11-12 (v2.6978 to v2.6991) · Austin's window read again the same day on the owner's yes · PR 9 (a San Antonio centre with several lots, v2.6997) built after PR 7's walk · PR 10 (a lot on the opposite stretch of a loop, v2.7008) built on the owner's yes · PR 4 looked at and dropped · PR 8 measured and not built
summary: >
  Card #316 made an Austin permit's owner come from the lot the permit names. Asked whether that
  is the best the lookup can do, every city was measured. The larger gaps are elsewhere. San
  Antonio never asks the permit's point, so about 6 commercial cards in 10 name no owner. Four
  New Braunfels addresses in 10 are in Guadalupe County, which the lookup never asks. Austin's
  permits over the Williamson County line have a county layer nobody reads. A train of small PRs.
next: Deploy PR 9 and PR 10 after their merges and open the same San Antonio addresses again. The ones whose lot changes are looked up again by hand, since a kept answer stays its thirty days.
size: M, a train of six small PRs and one measure
blocker: None.
ver: v2.6974 (#316, the owner by the parcel id) · v2.6978 (San Antonio asks the point) · v2.6980 (the county the lot is in) · v2.6984 (Williamson County by the R id) · v2.6985 (the pull's point at Williamson) · v2.6987 (kept days) · v2.6989 (the county's address line) · v2.6991 (San Antonio's address spelled the county's way) · v2.6997 (several lots at one San Antonio address) · v2.7008 (a lot on the opposite stretch of a loop)
mockup: not required — the Property line and its point line already exist; PR 4 and PR 5 add one line each and bring their words when they are built
---

# Permits: the owner lookup as a whole, city by city

## The ask

While #316 was being built Grace asked of it: *is this the best we can do*. For Austin's lookup
the answer was yes. For the lookup as a whole it was no, and the numbers below say where. On
2026-11-11 she said of the follow-ups: *they are great, help me build them*.

## What was measured (2026-11-11, counts only)

Every number comes from the cities' public feeds and the counties' public parcel layers, through
the repo's own kernels, over the 75-day window, one row per address. No address, owner or permit
number was kept. The `vite-node` scripts sit outside the repo.

### Austin: the id against the address and the city's own point

| kind | addresses | id on Travis's layer | not on it | an R id |
|---|---|---|---|---|
| commercial (all) | 700 | 604 | 81 | 15 |
| houses (sampled) | 250 | 210 | 32 | 8 |
| plumbing (sampled) | 250 | 208 | 28 | 14 |

- The city's own point, where it gives one, sits on the lot the id names 576 times of 577.
- The address finds another lot 34 times of the 716 it finds any lot. Where all three were asked,
  the address was the odd one 14 times and the id or the point never.
- The lot the id names has a county address other than the permit's on 190 of 604 commercial ids
  (a centre, a campus). It is blank on 69.

### The ids Travis's layer does not hold (12 to 13% in every kind)

- Commercial, 81: 62 remodels, 9 site work, 10 new. A looser id question finds none.
- 46 of the 81 have a city point. Under it Travis has a polygon every time: 5 with an owner, 41
  with a parcel number and the appraisal district's link but no owner and no id. The layer holds
  7,761 such polygons of 389,622 and every one carries the link.
- Houses, 32: 28 are new houses and 29 have no city point. Nothing can be asked until the
  county's monthly rebuild.

### The R ids (Austin over the Williamson County line)

- 144 of 4,238 Austin rows (97 plumbing, 32 houses, 15 commercial), 87 ids, 70 rows with no point.
- Williamson County publishes its own parcel layer (`gis.wilco.org`, `public/county_wcad_parcels`),
  asked by `QuickRefID`, a letter and six digits, the shape the permit carries. It holds 83 of the
  87 ids, each with an owner, a value, a county address and a shape. A POST of 50 ids passed.
- That is an owner for 138 of the 144 rows and a map point for 68 of the 70 with none.

### The other four cities: building permits that have a point

| city | sampled | same lot | different lots | point only | address only | neither |
|---|---|---|---|---|---|---|
| San Antonio (Bexar) | 150 | 61 | 1 | 88 | 0 | 0 |
| New Braunfels (Comal) | 150 | 76 | 1 | 6 | 0 | 67 |
| San Marcos (Hays) | 150 | 79 | 16 | 15 | 0 | 40 |
| Seguin (Guadalupe) | 150 | 23 | 0 | 126 | 1 | 0 |

- **San Antonio was the only city whose lookup never asked the point.** On a second sample of
  240: commercial, the address finds a lot 31 times of 82 and the point 81 of 82. Of the 159 the
  address missed, the lot under the point is the same number and street written another way 18
  times (LANE for LN, "N 1604 W" for "N LOOP 1604 W", a direction on one side only), the same
  street with another number 84 times, another street 57 times.
- **New Braunfels: 63 of 150 addresses are in Guadalupe County**, whose layer is already in the
  code and holds the lot with an owner. San Marcos: 18 of 150 in Guadalupe, and 20 where Hays has
  a polygon with no owner.
- San Marcos: the address and the point name different lots 16 times of 95. Not opened.
- Seguin, New Braunfels and San Marcos already fall back to the point.

## The train

One PR each, in this order. Each ships its release note, its fragment and the `permit-lookup`
section of `docs/EDGE_FUNCTIONS.md`, and is deployed from `main` after its merge.

1. **San Antonio asks the permit's point** when the street address finds no parcel (S). Built.
   The card already says *read at the permit's point* and names the county's address for the lot.
   A kept "no parcel" from before is asked again once.
   Through the new kernel commercial cards with an owner go from 50 in 101 to 95.
2. **The county the lot is in** (S). Built. When the city's own county holds nothing at the
   point, its neighbours' layers are asked there, and the card names the county the lot is in.
   Through the new kernel New Braunfels goes from 119 owners in 200 to 199, San Marcos 145 to 166.
3. **Williamson County as a fifth source**, asked by the R id (S). Built: of the 113 R-id
   addresses none named an owner before and 112 do through the new kernel. Then the pull's map
   point for the R rows (S, `permit-pull`). Built: 68 of the 70 rows with no point take one.
4. **A lot the county's map holds with no owner**. Looked at 2026-11-11 and not built. The
   appraisal district's page was opened for three such Travis polygons and is empty for each, while
   a parcel with an owner opens fine: the district does not publish those parcel numbers. Hays has
   3,825 polygons with no owner and none carries a parcel number or an address. There is nothing
   to open, so the card keeps saying the county has no parcel.
5. **The county's address for the lot when it is not the permit's** (XS). Built. One line on the
   two sheets. It shows on about 4 Austin commercial cards in 10.
6. **How long an answer is kept** (XS). Built. A failure for an hour, a "no parcel" for a week, a
   found owner for thirty days. Prod held 42 kept parcel rows and no kept failure on 2026-11-11.
7. **San Antonio's address question, spelled the county's way** (S). Built. The number and the
   street name, as the other counties are asked. On 320 addresses every lot found before is still
   found and 18 more are found by their address.
8. **The point over the address where a permit has both**. Measured 2026-11-11 and not built.
   San Marcos, all 218 addresses with a point: the address and the point name the same lot 106
   times and different lots 19. Of the 19, 17 are two lots of one owner, 10 carry the permit's own
   address on both lots (a campus or a complex on several parcels), and 18 are both over an acre.
   The owner differs on 2 of 125. In Austin the address was the odd one 34 times of 716 and the
   id now settles those. So neither is clearly the wrong one outside Austin, and asking the point
   first would change the card's words for a gain of about one owner in a hundred.
9. **A San Antonio address with several lots takes the lot under the permit's point** (XS).
   Built after PR 7's walk. A centre on a loop is one address and a parcel per pad, each with its
   own owner, and the pick took the first. On 39 addresses 9 have several lots and the owner
   shown changes on 4. One lot at the address asks nothing more, and the card's words stay.
10. **A San Antonio lot on the opposite stretch of a loop is passed by** (XS). Built on the
   owner's yes after a measure. A loop keeps one house number on its east and west stretches. A
   county row with the opposite direction (E for W, N for S) is not the address, unless it is
   the lot under the permit's point. On 282 addresses with a direction behind the street, 7
   wrong owners are put right and no right one changes. The city and the county write one
   stretch two ways 15 times there, and those are still found by their address.

## What #316 and #310 learned that this needs

- An edge deploy goes from `main` only, from a clean detached copy, with `npm run check:edge-drift`
  before and after. `permit-pull` bundles the same shared files as `permit-lookup`.
- A long list of ids goes by POST. One id is fine in a URL.
- The repo is public: no live address, owner or permit number in a test, a doc, this card or a PR.

## How to verify

- `npm test -- permitParcels permitLookup`, `npm run check:edge-bundles`, `npm run typecheck`.
- Each PR runs its own before and after against the live layers from a `vite-node` script that
  prints counts only, and writes the counts in its fragment.
- After each deploy: Prospects → Permits, the city the PR is about, a few cards, the Property line.

## Walked after each deploy

Read-only, signed in on a dev server, counts only.

- **PR 1** (deployed from `main` 2026-11-12): San Antonio, the 16 newest commercial building
  permits with a point, one per address. All 16 name an owner, 11 by the address and 5 read at
  the permit's point. The second open of all 16 came from the kept answers.
- **PR 2** (deployed from `main` 2026-11-12): the 20 newest building permits with a point in each
  city, one per address. New Braunfels: all 20 name an owner, 12 of them read at the point in
  Guadalupe County. San Marcos: 15 of 20 name an owner, 4 at Hays's own point and 5 with no
  parcel. None of the San Marcos 20 was over the county line. The second open of all 40 came
  from the kept answers.
- **PR 3** (deployed from `main` 2026-11-12): Austin, the 16 newest permits whose lot id is
  Williamson County's, one per address. All 16 name an owner and the card names Williamson
  County on each, 15 by the id and 1 by the address. The second open came from the kept answers.
- **PR 3b** (deployed from `main` 2026-11-12): a dry run of the pull, Austin since 2026-08-29,
  wrote nothing and ran clean. It read 4,199 rows, asked 930 lot ids and would put a point on
  1,381 rows. The table held 148 Austin rows with a Williamson County id, 71 of them with no
  point. They take one when Austin's window is read again, which is the owner's call.
- **PR 6** (deployed from `main` 2026-11-12): the San Antonio 16 and the San Marcos 20 opened
  again and all 36 came from the kept answers. The shorter keep itself is not walked. Seeing it
  takes a week to pass on a "no parcel", or a county that fails.
- **PR 5** (deployed from `main` 2026-11-12): Austin, the 30 newest commercial building permits
  with a lot id, one per address. 26 name an owner, 25 by the id and 1 at the permit's point.
  The line with the county's own address shows on 5 of the 26, 4 of them answered by the id.
- **PR 7** (deployed from `main` 2026-11-12): San Antonio, the 60 newest commercial building
  permits with a point, one per address, none opened before. 58 name an owner, 39 by the address
  and 19 at the permit's point. 11 of the 39 are lots the old question missed. Against the lot
  under the point, 32 of the 39 are that lot and 7 are another, 6 with another owner. On 5 of
  the 7 the county holds several lots at the address. That is PR 9.
- **Austin's window read again** (2026-11-12, on the owner's yes): the morning's own pull had
  already taken the 71 rows with no point down to 50. A dry run read the 4,319 rows held and
  nothing older. The reading then wrote all 4,319, with no error, in 8 seconds. Of the 148 rows
  with a Williamson County id, 146 now have a point, each inside the county, and 2 rows on one
  lot the county does not hold have none. Austin rows with no point went from 401 to 353.
