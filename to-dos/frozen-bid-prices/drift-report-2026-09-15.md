# Sent value vs what the Pricing grid reads today — every sent bid, 2026-09-15

Read-only reconstruction against prod on 2026-09-15 (Robert's session on a worktree dev server). Companion to [`README.md`](./README.md).

**What each column is.** *Sent* = `bids.bid_date_sent`; *Sent value* = `bids.bid_value` (stamped from the cover-letter amount at send); *Today* = Σ `count × (unit_price_override ?? entry.total_price)` over the bid's `bid_pricing_assignments` + Σ `count × unit_price` over its `bid_count_row_custom_prices`, both filtered to the bid's active pricing (the active version's ★ / saved / first copy, else `selected_price_book_version_id`); *Rows* = priced rows counted; *Copy taken* = `price_book_versions.created_at` of that pricing (`2026-09-03` = the v2.2720 backfill). BP315 reconstructs to the grid's number to the cent, which validates the formula; a bid with very few rows against a large sent value had its `bid_value` typed by hand and is not a book-edit case.

**Totals:** 280 sent non-twin bids · 165 priced in the app · 60 match · 105 differ (74 higher, +$437,951 in all; 31 lower) · 90 of the 105 were frozen on 2026-09-03 · 10 of the 105 were sent *after* their copy was taken.

## The query (page console of the authenticated dev server)

```js
const { supabase } = await import('/src/lib/supabase.ts');
const q = async (p) => { const r = await p; if (r.error) throw new Error(r.error.message); return r.data; };
const all = async (t, sel) => { const out = []; for (let i = 0; ; i += 1000) { const d = await q(supabase.from(t).select(sel).range(i, i + 999)); out.push(...d); if (d.length < 1000) break; } return out; };
const bids = await q(supabase.from('bids').select('id, bid_number, project_name, outcome, bid_date_sent, bid_value, selected_price_book_version_id, selected_bid_version_id').not('bid_date_sent', 'is', null).is('twin_source_bid_id', null));
const copies = await q(supabase.from('price_book_versions').select('id, bid_id, bid_version_id, created_at').not('bid_id', 'is', null));
const asg = await all('bid_pricing_assignments', 'bid_id, count_row_id, price_book_entry_id, price_book_version_id, unit_price_override');
const cps = await all('bid_count_row_custom_prices', 'bid_id, count_row_id, price_book_version_id, unit_price');
const rows = await all('bids_count_rows', 'id, count');           // NB: the count table is bids_count_rows
// …then look up price_book_entries.total_price for the assigned entry ids (in batches of 300),
// resolve each bid's active pricing as deriveActivePricingId does, and sum count × price per bid.
```

## Every sent bid priced in the app, largest change first

| Bid | Project | Sent | Outcome | Sent value | Today | Δ | Rows | Copy taken |
|---|---|---|---|---:|---:|---:|---:|---|
| BP139 | SVP LIVPRI | 2026-04-03 | lost | 159,759.71 | 42,287.71 | −117,472.00 | 13 | 2026-09-03 |
| BP1 | SVP Round Rock | 2026-05-02 | started_or_complete | 121,000.00 | 4,021.00 | −116,979.00 | 3 | 2026-09-03 |
| BP242 | Emergency Animal Hospital | 2026-07-06 | — | 251,244.77 | 356,093.14 | +104,848.37 | 44 | 2026-06-30 |
| BP107 | TownePlace Suites by Marriot | 2026-04-13 | — | 4,079,981.67 | 4,156,119.56 | +76,137.89 | 85 | 2026-09-03 |
| BP216 | San Marcos Fire Station #3 R | 2026-04-29 | lost | 603,387.27 | 661,687.72 | +58,300.45 | 102 | 2026-09-03 |
| BP264 | CACKLER Home in RED ROCK | 2026-05-13 | — | 37,600.00 | 79,340.00 | +41,740.00 | 15 | 2026-09-03 |
| BP269 | HAWAIIAN BROS #142 | 2026-05-21 | lost | 210,789.22 | 169,652.75 | −41,136.47 | 71 | 2026-09-03 |
| BP44 | Sierra Selma TX | 2025-11-19 | lost | 52,100.00 | 12,751.08 | −39,348.92 | 2 | 2026-09-03 |
| BP365 | ATI SAN ANTONIO BABCOCK | 2026-07-31 | — | 105,617.12 | 66,931.17 | −38,685.95 | 39 | 2026-07-31 |
| BP363 | PUR & SIMPLE | 2026-09-02 | lost | 169,686.51 | 140,180.59 | −29,505.92 | 39 | 2026-09-02 |
| BP131 | 360 Retail & Gas Station | 2026-03-25 | lost | 154,363.53 | 129,236.91 | −25,126.62 | 25 | 2026-09-03 |
| BP73 | CESTOHOWA RESTROOMS | 2026-01-07 | lost | 31,600.00 | 10,000.00 | −21,600.00 | 1 | 2026-09-03 |
| BP336 | Hill Country IM | 2026-07-07 | — | 114,426.42 | 93,967.59 | −20,458.83 | 26 | 2026-07-09 |
| BP383 | KAALO | 2026-08-19 | — | 389,981.08 | 409,981.08 | +20,000.00 | 60 | 2026-08-17 |
| BP18 | Club Pilates - Spring Branch | 2025-09-22 | lost | 19,200.00 | 588.00 | −18,612.00 | 3 | 2026-06-25 |
| BP323 | TSAOG ROGERS RD MOB | 2026-06-30 | lost | 404,091.55 | 388,473.46 | −15,618.09 | 36 | 2026-06-26 |
| BP159 | SVP LIVARG | 0002-04-09 | lost | 162,600.58 | 177,575.11 | +14,974.53 | 102 | 2026-09-03 |
| BP328 | Wildhorse Amenity Center | 2026-07-06 | — | 133,185.04 | 121,458.56 | −11,726.48 | 35 | 2026-09-03 |
| BP294 | SHAKE SHACK #1728 LEANDER | 2026-06-08 | — | 338,255.83 | 328,669.67 | −9,586.16 | 93 | 2026-09-03 |
| BP352 | IMAGE studios San Antonio TX | 2026-08-03 | — | 291,701.40 | 301,247.55 | +9,546.15 | 66 | 2026-08-03 |
| BP114 | NB Airport 5 Hangars | 2026-03-30 | — | 352,106.80 | 361,631.91 | +9,525.11 | 49 | 2026-09-03 |
| BP200 | HEB CStore San Marcos | 2026-04-24 | lost | 615,268.06 | 624,053.32 | +8,785.26 | 91 | 2026-09-03 |
| BP309 | Republic Trails Retail Cente | 2026-06-08 | — | 95,597.99 | 87,974.99 | −7,623.00 | 12 | 2026-09-03 |
| BP212 | Pirate Panda Brewery | 2026-04-22 | — | 111,728.27 | 119,323.01 | +7,594.74 | 18 | 2026-09-03 |
| BP315 | Prue Event Center | 2026-07-01 | — | 379,895.70 | 385,506.07 | +5,610.37 | 56 | 2026-09-03 |
| BP261 | Bandera Family Hospital Nurs | 2026-06-04 | — | 286,423.83 | 291,733.23 | +5,309.40 | 43 | 2026-09-03 |
| BP362 | TAKE 5 - KERRVILLE | 2026-08-17 | lost | 42,633.93 | 47,633.93 | +5,000.00 | 21 | 2026-08-14 |
| BP185 | 210 W WRIGHT, M.Y. CHOCKDEE | 2026-04-16 | — | 45,585.00 | 50,400.00 | +4,815.00 | 9 | 2026-07-02 |
| BP296 | Generations Medical Offices | 2026-06-04 | — | 263,891.03 | 267,862.15 | +3,971.12 | 25 | 2026-09-03 |
| BP348 | Jakes Split Rail - Revised V | 2026-07-17 | — | 314,175.91 | 317,936.59 | +3,760.68 | 62 | 2026-09-03 |
| BP266 | TXST ALERRT Center Improveme | 2026-05-18 | — | 304,183.38 | 307,569.21 | +3,385.83 | 62 | 2026-09-03 |
| BP272 | Nick & Moe's, Frisco | 2026-06-04 | — | 233,865.10 | 230,865.10 | −3,000.00 | 52 | 2026-07-07 |
| BP190 | Church Video Cafe Reno | 2026-04-17 | won | 40,560.05 | 37,780.59 | −2,779.46 | 26 | 2026-09-03 |
| BP238 | JAKES BURGERS | 2026-05-18 | — | 260,840.08 | 263,606.16 | +2,766.08 | 59 | 2026-09-03 |
| BP271 | Jakes Shell | 2026-05-18 | — | 40,098.79 | 42,783.01 | +2,684.22 | 14 | 2026-09-03 |
| BP253 | Jakes Split Rail Interior | 2026-05-18 | — | 322,311.21 | 324,969.93 | +2,658.72 | 56 | 2026-09-03 |
| BP349 | Jakes Burgers Revised VE | 2026-07-17 | — | 224,100.72 | 226,748.16 | +2,647.44 | 63 | 2026-09-03 |
| BP375 | SPACEX BA-02N Architectural | 2026-08-10 | started_or_complete | 249,715.66 | 252,216.00 | +2,500.34 | 26 | 2026-09-03 |
| BP233 | Vernon in Kerrville | 2026-05-05 | — | 62,500.00 | 60,100.00 | −2,400.00 | 14 | 2026-09-03 |
| BP76 | ADAMS RESIDENCE | 2026-02-06 | started_or_complete | 41,550.00 | 39,200.00 | −2,350.00 | 13 | 2026-09-03 |
| BP177 | Mission Pet Health (MPH)- Sp | 2026-04-15 | started_or_complete | 2,400.00 | 4,526.45 | +2,126.45 | 3 | 2026-08-17 |
| BP140 | BOSS JCB | 2026-04-01 | lost | 180,361.19 | 182,374.60 | +2,013.41 | 28 | 2026-09-03 |
| BP179 | 2530 Hunter Road Office Buil | 2026-04-13 | lost | 104,037.89 | 106,042.00 | +2,004.11 | 38 | 2026-09-03 |
| BP174 | 2530 Hunter Road Fitness Cen | 2026-04-13 | lost | 126,090.46 | 128,072.70 | +1,982.24 | 42 | 2026-09-03 |
| BP188 | San Antonio Logistics Center | 2026-04-20 | won | 153,006.63 | 154,983.08 | +1,976.45 | 34 | 2026-09-03 |
| BP288 | PFISD Connally HS project | 2026-06-04 | — | 421,972.49 | 423,889.33 | +1,916.84 | 22 | 2026-09-03 |
| BP150 | Garison Park Buda | 2026-04-15 | lost | 112,316.57 | 114,204.41 | +1,887.84 | 39 | 2026-09-03 |
| BP289 | Center for Child Protection  | 2026-06-04 | — | 182,627.00 | 184,460.24 | +1,833.24 | 35 | 2026-09-03 |
| BP160 | Tim Hortons | 2026-04-10 | lost | 224,982.31 | 226,787.01 | +1,804.70 | 56 | 2026-09-03 |
| BP283 | 13900 Panorama Residence Pro | 2026-06-04 | — | 73,550.00 | 71,750.00 | −1,800.00 | 15 | 2026-09-03 |
| BP279 | Walters at Ridgewood | 2026-05-22 | — | 36,290.00 | 34,510.00 | −1,780.00 | 11 | 2026-09-03 |
| BP372 | Pirate Panda Brewery - New P | 2026-08-10 | — | 230,771.88 | 232,360.00 | +1,588.12 | 51 | 2026-09-03 |
| BP192 | Blessing Church Gym Addition | 2026-04-20 | lost | 78,446.65 | 79,855.51 | +1,408.86 | 30 | 2026-09-03 |
| BP229 | Donatos Pizza - TI - Humble, | 2026-04-30 | lost | 104,331.64 | 105,738.67 | +1,407.03 | 35 | 2026-09-03 |
| BP213 | LHISD SANTA RITA ELEMENTARY  | 2026-04-28 | — | 434,928.25 | 436,235.43 | +1,307.18 | 37 | 2026-09-03 |
| BP300 | LITTLE CAESARS PIZZA | 2026-06-04 | — | 120,144.80 | 121,451.10 | +1,306.30 | 54 | 2026-09-03 |
| BP280 | Crunch Fitness Potranco | 2026-05-26 | lost | 280,610.58 | 279,323.43 | −1,287.15 | 74 | 2026-09-03 |
| BP147 | Tye Preston Memorial Library | 2026-04-22 | lost | 149,023.97 | 150,094.73 | +1,070.76 | 68 | 2026-09-03 |
| BP301 | Big Creek Development | 2026-06-03 | — | 40,429.45 | 39,382.02 | −1,047.43 | 8 | 2026-09-03 |
| BP201 | AISD Garcia School Renovatio | 2026-04-24 | lost | 180,357.45 | 181,366.64 | +1,009.19 | 48 | 2026-09-03 |
| BP313 | HANDEL'S ICE CREAM LEANDER | 2026-06-17 | — | 95,343.81 | 96,352.99 | +1,009.18 | 42 | 2026-09-03 |
| BP314 | CareNow Urgent Care - Tech R | 2026-06-24 | — | 136,338.06 | 135,338.06 | −1,000.00 | 35 | 2026-06-24 |
| BP299 | Bastrop County Development S | 2026-06-05 | — | 170,830.79 | 171,823.09 | +992.30 | 44 | 2026-09-03 |
| BP245 | Sherwin Williams | 2026-05-05 | — | 59,167.53 | 58,186.37 | −981.16 | 29 | 2026-09-03 |
| BP211 | Wadelyn Unit Arch Ray #169 | 2026-04-21 | started_or_complete | 16,700.00 | 15,750.00 | −950.00 | 11 | 2026-09-03 |
| BP180 | 2530 Hunter Road Sound Studi | 2026-04-13 | lost | 63,860.58 | 64,808.30 | +947.72 | 35 | 2026-09-03 |
| BP295 | MPH STAGE | 2026-06-03 | — | 148,154.63 | 149,035.06 | +880.43 | 35 | 2026-09-03 |
| BP259 | American Eagle remodel | 2026-05-11 | — | 1,625.00 | 2,475.00 | +850.00 | 6 | 2026-09-03 |
| BP370 | Hyper Kidz Franchise @ San A | 2026-08-12 | lost | 134,035.46 | 134,837.70 | +802.24 | 35 | 2026-09-03 |
| BP158 | Brostrom | 2026-06-24 | — | 20,550.00 | 21,350.00 | +800.00 | 11 | 2026-09-03 |
| BP218 | Briarwood | 2026-04-30 | — | 39,297.57 | 40,055.52 | +757.95 | 13 | 2026-09-03 |
| BP353 | RITUAL ONE YOGA STUDIO | 2026-07-30 | — | 77,401.39 | 78,089.62 | +688.23 | 30 | 2026-09-03 |
| BP324 | BLANCO ISD 2025 BOND - PKG 2 | 2026-07-08 | — | 2,120,622.58 | 2,119,950.21 | −672.37 | 90 | 2026-09-03 |
| BP75 | Lagan Casita | 2026-02-06 | started_or_complete | 11,920.00 | 12,540.00 | +620.00 | 8 | 2026-09-03 |
| BP193 | Silver Creek Expansion | 2026-04-21 | — | 110,811.63 | 111,407.60 | +595.97 | 23 | 2026-09-03 |
| BP137 | Armstrong in Canyon Lake | 2026-03-31 | lost | 31,925.00 | 31,425.00 | −500.00 | 13 | 2026-09-03 |
| BP254 | Take 5 Cypress | 2026-05-15 | lost | 43,369.45 | 43,827.61 | +458.16 | 41 | 2026-09-03 |
| BP285 | Askey Home | 2026-05-22 | lost | 29,200.00 | 28,750.00 | −450.00 | 12 | 2026-09-03 |
| BP251 | Take 5 Dickinson | 2026-05-07 | lost | 42,775.90 | 43,180.08 | +404.18 | 43 | 2026-09-03 |
| BP237 | Take 5 Oil Change Liberty Hi | 2026-05-08 | won | 41,951.01 | 42,339.23 | +388.22 | 42 | 2026-09-03 |
| BP260 | Burlington White Box Budget | 2026-05-11 | — | 39,538.49 | 39,917.61 | +379.12 | 10 | 2026-09-03 |
| BP291 | Proud Mary Coffee / TI - Aus | 2026-06-04 | lost | 161,641.78 | 162,015.35 | +373.57 | 31 | 2026-09-03 |
| BP371 | Dollar Tree - Cedar Breaks W | 2026-08-14 | lost | 50,190.42 | 50,551.76 | +361.34 | 48 | 2026-09-03 |
| BP270 | Pilates Addiction - TI - Eas | 2026-05-18 | — | 25,185.74 | 25,537.31 | +351.57 | 22 | 2026-09-03 |
| BP344 | TAKE 5 - RICHMOND TX | 2026-07-30 | lost | 54,921.16 | 55,271.83 | +350.67 | 40 | 2026-09-03 |
| BP166 | Take 5 Oil Change Seguin | 2026-04-21 | won | 38,000.00 | 38,350.57 | +350.57 | 35 | 2026-09-03 |
| BP347 | SAXON MD FACIAL PLASTIC SURG | 2026-07-29 | — | 53,942.72 | 54,262.87 | +320.15 | 22 | 2026-09-03 |
| BP338 | THE CANNON | 2026-07-20 | — | 48,351.23 | 48,070.85 | −280.38 | 15 | 2026-07-20 |
| BP333 | TAKE 5 S POST OAK RD | 2026-07-21 | lost | 47,345.62 | 47,624.21 | +278.59 | 38 | 2026-09-03 |
| BP182 | MPH LIVARG - MED GAS ONLY | 2026-04-14 | lost | 39,111.06 | 39,384.58 | +273.52 | 18 | 2026-09-03 |
| BP326 | VINEYARD VINES | 2026-06-29 | — | 19,434.52 | 19,669.02 | +234.50 | 20 | 2026-09-03 |
| BP194 | 16 Handles- San Antonio | 2026-04-21 | lost | 72,470.33 | 72,686.70 | +216.37 | 25 | 2026-09-03 |
| BP223 | Talley Road Retail - Rim Roc | 2026-04-30 | — | 247,096.90 | 247,313.11 | +216.21 | 28 | 2026-09-03 |
| BP335 | TAKE 5 - EASTCHASE PKWY FW | 2026-07-22 | lost | 58,821.98 | 58,622.37 | −199.61 | 27 | 2026-09-03 |
| BP156 | Dollar Tree #11454 | 2026-04-14 | — | 37,145.00 | 37,344.16 | +199.16 | 19 | 2026-09-03 |
| BP311 | DE LA CERDA Home in SAN ANTO | 2026-06-11 | — | 17,800.00 | 17,950.00 | +150.00 | 11 | 2026-09-03 |
| BP287 | Askey White Guest Home | 2026-05-22 | lost | 12,600.00 | 12,450.00 | −150.00 | 10 | 2026-09-03 |
| BP214 | Tye Preston Memorial Library | 2026-04-23 | lost | 6,326.26 | 6,452.91 | +126.65 | 18 | 2026-09-03 |
| BP227 | LCRA Narrows Recreation Area | 2026-04-29 | lost | 21,685.80 | 21,770.80 | +85.00 | 11 | 2026-09-03 |
| BP293 | BONILLA LAW FIRM | 2026-06-03 | lost | 22,616.16 | 22,688.01 | +71.85 | 12 | 2026-09-03 |
| BP306 | TAKE 5 KATY TX | 2026-06-12 | lost | 43,126.05 | 43,197.26 | +71.21 | 31 | 2026-09-03 |
| BP331 | Take 5 - Sherman | 2026-07-03 | lost | 49,083.23 | 49,145.23 | +62.00 | 47 | 2026-07-02 |
| BP215 | Tye Preston Memorial Library | 2026-04-23 | lost | 3,478.16 | 3,525.61 | +47.45 | 6 | 2026-09-03 |
| BP252 | Ortega in Mico | 2026-05-11 | — | 18,150.00 | 18,175.00 | +25.00 | 10 | 2026-09-03 |
| BP113 | Dean Porter Building 1 RR | 2026-03-17 | lost | 49,432.19 | 49,439.69 | +7.50 | 28 | 2026-09-03 |
| BP397 | TAKE 5 BROWNSVILLE | 2026-09-08 | — | 50,527.88 | 50,527.88 | +0.00 | 54 | 2026-09-03 |
| BP398 | ZZ Test | 2026-08-27 | won | 56,343.00 | 56,343.00 | +0.00 | 3 | 2026-08-27 |
| BP225 | 141 ENCINO | 2026-08-21 | — | 30,400.00 | 30,400.00 | +0.00 | 12 | 2026-09-03 |
| BP376 | MPH CASA LINDA | 2026-08-18 | — | 346,880.84 | 346,880.84 | +0.00 | 58 | 2026-08-17 |
| BP359 | SPACEX BA-2 CORE AND SHELL | 2026-08-06 | — | 15,812,658.33 | 15,812,658.33 | +0.00 | 88 | 2026-09-03 |
| BP357 | CRUNCH WILLIAM CANNON | 2026-08-04 | lost | 352,899.70 | 352,899.70 | +0.00 | 72 | 2026-08-04 |
| BP366 | ATI DOVE CREEK | 2026-07-31 | — | 139,022.33 | 139,022.33 | +0.00 | 42 | 2026-07-31 |
| BP351 | PEPPER LUNCH LEANDER | 2026-07-27 | — | 218,877.80 | 218,877.80 | +0.00 | 57 | 2026-07-27 |
| BP339 | SAISD - DAVIS MS PHASE II | 2026-07-23 | lost | 2,799,239.90 | 2,799,239.90 | +0.00 | 83 | 2026-07-22 |
| BP354 | Randolph Field Reality | 2026-07-23 | started_or_complete | 1,683.00 | 1,683.00 | +0.00 | 1 | 2026-09-03 |
| BP342 | Jakes Split Rail - Revised | 2026-07-17 | — | 366,740.76 | 366,740.76 | +0.00 | 58 | 2026-09-03 |
| BP340 | Jakes Shell - Revised | 2026-07-17 | — | 62,094.12 | 62,094.12 | +0.00 | 19 | 2026-09-03 |
| BP345 | Jakes Burgers Revised | 2026-07-17 | — | 274,248.79 | 274,248.79 | +0.00 | 56 | 2026-09-03 |
| BP322 | UTSA SAN PEDRO LVL 6&7 | 2026-07-14 | — | 519,829.26 | 519,829.26 | +0.00 | 49 | 2026-07-13 |
| BP330 | Gerber Collision & Glass - C | 2026-07-10 | — | 249,923.23 | 249,923.23 | +0.00 | 69 | 2026-07-09 |
| BP337 | STORY RESIDENCE | 2026-07-09 | — | 45,400.00 | 45,400.00 | +0.00 | 13 | 2026-09-03 |
| BP329 | NICK & MOE'S STEPHENVILLE | 2026-07-07 | — | 279,578.80 | 279,578.80 | +0.00 | 51 | 2026-06-30 |
| BP317 | SUBMERSIVE BARTON SPRINGS | 2026-07-02 | — | 762,632.27 | 762,632.27 | +0.00 | 84 | 2026-06-23 |
| BP321 | DOA GIDDINGS SEED LAB | 2026-06-30 | — | 40,244.00 | 40,244.00 | +0.00 | 9 | 2026-09-03 |
| BP319 | TAKE 5 - CULEBRA | 2026-06-30 | lost | 39,919.89 | 39,919.89 | +0.00 | 27 | 2026-06-22 |
| BP316 | RUIZ RESIDENCE HORSESHOE BAY | 2026-06-19 | — | 56,150.00 | 56,150.00 | +0.00 | 11 | 2026-09-03 |
| BP297 | Take 5 611 San Pedro Ave | 2026-06-17 | lost | 100,672.79 | 100,672.79 | +0.00 | 33 | 2026-09-03 |
| BP263 | Knight Contracting Reliant H | 2026-06-12 | — | 4,100.00 | 4,100.00 | +0.00 | 2 | 2026-06-12 |
| BP303 | REGAN SQUARE PR5 | 2026-06-08 | — | 213,687.03 | 213,687.03 | +0.00 | 34 | 2026-09-03 |
| BP308 | Nick & Moe's, Frisco | 2026-06-05 | — | 288,227.21 | 288,227.21 | +0.00 | 2 | 2026-09-03 |
| BP305 | MPH STAGE - Med Gas | 2026-06-04 | — | 24,158.85 | 24,158.85 | +0.00 | 8 | 2026-08-17 |
| BP307 | MPH STAGE | 2026-06-04 | — | 320,683.65 | 320,683.65 | +0.00 | 2 | 2026-09-03 |
| BP302 | Platinum Lockhart | 2026-06-03 | — | 146,329.55 | 146,329.55 | +0.00 | 20 | 2026-06-26 |
| BP290 | GUAJARDO RESIDENCE | 2026-05-29 | — | 32,300.00 | 32,300.00 | +0.00 | 14 | 2026-09-03 |
| BP281 | American Eagle remodel | 2026-05-21 | — | 1,650.00 | 1,650.00 | +0.00 | 2 | 2026-09-03 |
| BP274 | Marcos Pizza Repair, Boerne | 2026-05-19 | — | 2,243.00 | 2,243.00 | +0.00 | 4 | 2026-09-03 |
| BP276 | Marcos Pizza Repair, Pfluger | 2026-05-19 | — | 14,665.73 | 14,665.73 | +0.00 | 3 | 2026-09-03 |
| BP277 | Pilates Addiction - Concrete | 2026-05-19 | — | 18,500.00 | 18,500.00 | +0.00 | 3 | 2026-09-03 |
| BP327 | Reliant Healthcare | 2026-05-13 | won | 4,100.00 | 4,100.00 | +0.00 | 1 | 2026-09-03 |
| BP232 | Vernon in Kerrville | 2026-05-07 | — | 140,975.31 | 140,975.31 | +0.00 | 2 | 2026-09-03 |
| BP221 | Everling Residence | 2026-05-05 | — | 59,890.00 | 59,890.00 | +0.00 | 15 | 2026-09-03 |
| BP222 | Sandow Lakes - SLR Offices & | 2026-05-05 | — | 223,430.74 | 223,430.74 | +0.00 | 19 | 2026-07-06 |
| BP220 | Briarwood | 2026-04-30 | — | 43,985.70 | 43,985.70 | +0.00 | 2 | 2026-09-03 |
| BP228 | LCRA Narrows Recreation Park | 2026-04-29 | — | 8,400.00 | 8,400.00 | +0.00 | 1 | 2026-09-03 |
| BP168 | HEB CStore & Carwash Convers | 2026-04-24 | lost | 635,268.06 | 635,268.06 | +0.00 | 2 | 2026-09-03 |
| BP189 | San Antonio Logistics Center | 2026-04-21 | — | 462,502.49 | 462,502.49 | +0.00 | 2 | 2026-09-03 |
| BP210 | MPH Cedar Park | 2026-04-20 | lost | 14,879.00 | 14,879.00 | +0.00 | 1 | 2026-09-03 |
| BP178 | Residential Repair Quote (TC | 2026-04-20 | — | 2,192.75 | 2,192.75 | +0.00 | 5 | 2026-09-03 |
| BP203 | Mission Pet Health (MPH)- Sp | 2026-04-20 | won | 1,650.00 | 1,650.00 | +0.00 | 1 | 2026-09-03 |
| BP94 | MAYFIELD Home in SAN ANTONIO | 2026-04-18 | — | 38,988.00 | 38,988.00 | +0.00 | 2 | 2026-09-03 |
| BP104 | Gruber in Spring Branch | 2026-04-18 | — | 58,378.36 | 58,378.36 | +0.00 | 2 | 2026-09-03 |
| BP183 | SVP LIVPRI Med Gas | 2026-04-14 | lost | 42,287.71 | 42,287.71 | +0.00 | 1 | 2026-09-03 |
| BP181 | TownePlace Suites by Marriot | 2026-04-13 | — | 1,954,924.40 | 1,954,924.40 | +0.00 | 2 | 2026-09-03 |
| BP173 | Suite 100 Comsouth Dr, Austi | 2026-04-10 | — | 3,400.00 | 3,400.00 | +0.00 | 2 | 2026-09-03 |
| BP155 | Toilet to Women's Restroom | 2026-04-01 | — | 7,500.00 | 7,500.00 | +0.00 | 1 | 2026-09-03 |
| BP154 | Largo Vista Plumbing Inspect | 2026-04-01 | — | 1,425.50 | 1,425.50 | +0.00 | 7 | 2026-09-03 |
| BP111 | NB Airport 5 Hangars | 2026-03-30 | — | 175,425.86 | 175,425.86 | +0.00 | 2 | 2026-09-03 |
| BP128 | Urrabazo Residence | 2026-03-19 | started_or_complete | 20,100.00 | 20,100.00 | +0.00 | 10 | 2026-09-03 |
| BP106 | KULBETH Home in FREDERICKSBU | 2026-03-19 | — | 7,682.55 | 7,682.55 | +0.00 | 2 | 2026-09-03 |
| BP118 | Connell House - Curvatura | 2026-03-12 | started_or_complete | 37,745.00 | 37,745.00 | +0.00 | 12 | 2026-09-03 |
| BP95 | MAYFIELD Home in SAN ANTONIO | 2026-03-11 | lost | 19,850.00 | 19,850.00 | +0.00 | 12 | 2026-09-03 |
| BP101 | KULBETH Home in FREDERICKSBU | 2026-03-10 | lost | 37,300.00 | 37,300.00 | +0.00 | 13 | 2026-09-03 |
| BP102 | Gruber in Spring Branch | 2026-03-10 | — | 28,750.00 | 28,750.00 | +0.00 | 13 | 2026-09-03 |
| BP98 | CLEMONS Home in BULVERDE | 2026-03-10 | lost | 26,750.00 | 26,750.00 | +0.00 | 11 | 2026-09-03 |
| BP89 | Knight Contracting Reliant H | 2026-02-25 | won | 32,700.00 | 32,700.00 | +0.00 | 2 | 2026-09-03 |

## The live-leak specimens (no copy, rows keyed to a shared template), 2026-09-15

| Bid | Created | Rows on a template | Note |
|---|---|---:|---|
| BP483 Laynes Chicken Fingers 24th Street (Austin TX) | 2026-09-09 | 42 | a real bid, six days after the backfill — the bug reproducing |
| BP481 ZZ Shadow GALLOWAY PARK CONCESSION STAND BURNET | 2026-09-06 | 49 | robot shadow — expected (robot write fence) |
| BP477 ZZ Twin HYPER KIDZ FRANCHISE (backtest R2) | 2026-09-06 | 39 | robot twin — expected |
| BP486, BP485, BP484, BP482, BP480, BP479, BP478, BP476–BP464, BP431, BP430 | 2026-09-04 … 09-15 | 0 | no pricing rows yet; BP430 "taunya" was sent 2026-09-04 at $1,450 with nothing priced |
