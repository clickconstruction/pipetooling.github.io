# Gun Dog spike — the Development page, second look (2026-11-02)

The owner's ask: *"Please take a look at the development page, specifically the gun dog. I would
like to make a spike with you so we can make several changes together and then push them out at
once."* Worktree `wizardly-hawking-abfc16`, branch `claude/wizardly-hawking-abfc16`. Nothing ships
until the owner says the set is complete; then small PRs from fresh main.

## How it was read

Signed in as the dev on the dev server (`/dev-login?as=dev`), the real site
`/developments/7d7b2580-3301-42bd-af10-85d75b941918`, rendered headless at 1280×1000 and at the
phone size 375×812 (Playwright), request waterfall recorded. Reads only; no prod row touched.

## What the page shows today (Gun Dog)

- Head: DSI as the customer, no GC, no GC contact (*none yet · add one*), estimating *Twin
  Estimator 1, Robert, Trace, Wendi*, six on site on JP1091 (last work Oct 29).
- Tiles: Waiting nothing · Bids 15 (0 sent · 2 undecided · 10 archived) · Jobs 24 (10 open · 2
  working) · Bid undecided $0 (2 bids, no price yet) · Open on bills $0.
- History 458 lines; the top fifteen are the Nov 1 HCP merge: ten *Combined … into JP629* notes
  and five identical *Ready to Bill · JP629 · moved from Paid*.
- Jobs & bids: 22 working-or-waiting rows, ten of them archived bids with *no job yet*; the two
  working bids (BP556, BP557 the twin's shadow) sit 13 rows apart; 14 paid jobs folded.
- Money: $2,197,171.58 on 24 jobs, 92% paid, $0 billed, $186,116.84 left; the band shows no percent
  (4 jobs have none on record); 8 waiting jobs hold $170K never billed.
- Plans: four parts with current sets (Lodge, Bunker, Site, ATV building), *24 jobs on no part*.
- Questions: none.

## Findings

1. **Phone overflow (bug).** At 375 wide the page scrolls sideways: `scrollWidth` 607. The Plans
   table (`site-plans-table`, 584 wide, seven columns) has no phone shape. The *On record* bid button
   for BP557 (357 wide) also pokes past the edge by 16px.
2. **Slow read.** From the route to the Jobs & bids table: ~4.5–5.5 s on this network (dev server;
   StrictMode doubles the effects, so prod is ~half the requests but the same depth). The fetch is a
   seven-step waterfall: development → members → at-address → prior_numbers → the fan-out of 13 →
   user names → pay speeds. Then the Costs column (dev/controller) pulls
   `mercury_transaction_job_allocations` with the embedded `mercury_transactions.raw` = **1.5 MB**,
   then chains ~10 sequential chunked reads for the card exclusions (~2.5 s more).
   `get_billed_customer_pay_speeds` returns every customer (85 KB) for one.
3. **Archived bids crowd the table.** Ten archived bids nobody is chasing read as *Working or
   waiting* rows above the live ones; the count on the fold says 22 though only 12 are live.
4. **Working bids split.** Table order puts BP556 first and BP557 (also working) 13 rows down; the
   order is by bid number within groups, not by state.
5. **Merge noise in History.** Fifteen near-identical lines from one person's one act on one day.
6. **The twin's shadow bid on a real site.** BP557 *ZZ Shadow …* by Twin Estimator 1 is in the
   development, so the head lists a robot among the estimators and the tiles count its bid.
7. **A dead tile.** *Open on bills $0 · nothing unpaid* is the good state; meanwhile $170K sits in
   waiting jobs never billed and $3,200 done-not-billed. The head says nothing about it.
8. **24 jobs on no part.** The Plans look names it but the fix is one job at a time.
9. **GC contact none yet** on a 15-bid site: the door opens the newest bid's Edit tab.
10. **Edit** leaves the page for Settings.

## Candidates (for the owner to pick and order)

- A. Phone: Plans as cards at 375 (and the *On record* line wraps). Bug fix.
- B. Speed: flatten the waterfall (names and pay speeds alongside the fan-out, prior_numbers into
  it), drop `raw` from the costs read or defer costs until the table is on screen, batch the
  exclusions. No migration for the first two; the pay-speed RPC by customer would be one.
- C. Jobs & bids: archived bids fold into their own section like Paid (*10 archived · sum*), and
  the live order reads working bids → paired bids with their jobs → jobs with no bid.
- D. History: fold same-day, same-kind lines on one piece by one person into one line with a count
  (*5 jobs combined into JP629 · Robert · more ›*).
- E. Twins' shadow bids: left out of the head's people and the tiles' counts, shown in the table
  with a *shadow* chip (or hidden behind a toggle).
- F. A tile that earns its place: *Not yet billed* (done-not-billed + waiting value) in place of, or
  beside, *Open on bills* when that one is $0.
- G. Plans: *Put jobs on parts* — a picker that assigns many jobs to a part in one press.
- H. Head: GC contact editable in place (a small sheet) instead of the newest bid's Edit tab.

## The owner's word

2026-11-02, after the first report with the screenshots: **All eight**, in the order listed.

Second round, on the built set: *I like a lot of this, but I don't like how this looks on mobile* (the Five
looks strip: cap, ordinals and the amber phrases wrapped into four ragged lines on the phone), and on G's
picker: *I like the idea of this, but I need a good way to see the job names so a human can quickly make
decisions*. Both redrawn, below as **I** and the second cut of **G**.

## Built in the worktree (uncommitted until the wrap-up)

- **A** `DevelopmentPartsCard.tsx`: at 760 and under each part is a card (name, building from, dated · came,
  memo, jobs, older sets, + New set); the desk keeps the table. The *On record* bid button wraps on a phone
  (`DevelopmentPage.tsx`). Measured: `scrollWidth` 375 in 375, nothing past the edge.
- **B** `fetchDevelopmentPage.ts`: the row and the members read together, the pay-speed RPC leaves at the
  start, the prior numbers ride in the fan-out, the names alone wait on everything (seven round trips to four).
  `useSiteCosts.ts`: no `mercury_transactions.raw` on the embed (1.5 MB → 308 KB on Gun Dog). `supabasePaging.ts`:
  `fetchAllRowsChunkedIn` takes `parallel`; the two card-exclusion loaders run four chunks at once. Measured on
  the dev server with StrictMode's double effects: the Jobs & bids table at ~4.1 s from ~5.5 s. Not done: the
  pay-speed RPC by customer (a migration) and a slimmer history-entries read (279 KB of mail bodies).
- **C** `pieces.ts`: a bid archived with no job and no answer out is `archived`, its own fold between the
  live rows and Done (*10 archived bids · $2,503.68 bid · Show them*); live rows rank bids in play, then paired
  bids, then jobs with no bid, waiting rows still first. The strip and the fold line count 12, not 22.
- **D** `historyFolds.ts`: three or more neighbouring lines sharing the day (app time zone), kind, verb, piece
  and person fold into one line with the count and every detail inside; questions, answers and kept entries
  never fold; a search sees every line. The Nov 1 merge reads as two lines instead of ten.
- **E** `overview.ts` `shadowBidIds` / `withoutShadowBids`, `fetchDevelopmentPage.ts` reads `is_digital_twin`
  with the names: the twin's BP557 shows in the table with a *shadow* chip and is out of Estimating and the
  tiles (Bids 14 · 1 undecided).
- **F** `siteMoney.ts` `unbilledTileWords`: with no bill open and money left, the fifth tile reads *Not yet
  billed · $186,116.84 · $3,200 done, not billed · 5 jobs with money left*; its card (`countCards.ts`) gains the
  *Waiting, not yet billed* group and a head that sums what is left.
- **G** `DevelopmentPartsCard.tsx`: under *24 jobs on no part* a writer ticks jobs, picks a part, and
  *Put 2 jobs on Lodge* names it on each (one write per job through `pickPart`, the failures named,
  `batchOutcomeWords`); a reader keeps the plain list. Second cut (the owner's word above): one row per job,
  the tick, the number as the door, the job's name beside it (`SiteCarrier.name`, the job's name or its
  address), by name through `orderForPicking` in `sitePlans.ts` so the *ATV building* jobs sit together; a
  ticked row tints; three columns on a desk, one on a phone, a long name cut with its whole on the title.
- **I** `DevelopmentJumpStrip.tsx`, `lookFigure.ts`: on the phone the strip is one row of five equal cells,
  the look's name over one figure (the number that leads the amber words, else the count's; money from
  $10k rounds to *$186k*), the look you are in underlined, no cap and no ordinals; 53 px tall where the
  chips were about 110. The desk strip is unchanged.
- **H** `DevelopmentGcContactSheet.tsx`, `gcContact.ts`, `gcContactWrites.ts`: *none yet · add one* and
  *Change ›* open a sheet; the write goes onto every bid of the site with no contact or the one being changed
  (*Put it on 15 bids*), the toast offers *Put it back*. The GC contact is still a field on bids, not on the
  development: no migration.

Tests: `historyFolds.test.ts`, `gcContact.test.ts`, `lookFigure.test.ts`, `DevelopmentGcContactSheet.render.test.tsx` new;
`pieces`, `overview`, `siteMoney`, `countCards`, `supabasePaging`, `sitePlans`, `DevelopmentPartsCard.render` extended.

## Shipped (2026-11-02, the owner: *Ship all nine*)

Four stacked PRs cut from fresh `main`, each with its release note, fragment, guide words and glossary
clause; each one retargeted to `main` when the one under it merged and was armed then. #6846, #6847, #6848, #6896 and #6849 merged on 2026-11-03; the stack is done.

| PR | Version | Carries |
| --- | --- | --- |
| #6846 | v2.6377 | A the phone's Plans cards, I the strip as one row, B the read (four round trips, `raw` off the costs read, parallel id chunks) |
| #6847 | v2.6378 | C the Archived fold and the live order, D History's folded runs, E the shadow chip |
| #6848 | v2.6379 | F the Not yet billed tile and its card group, H the GC contact sheet |
| #6849 | v2.6381 | G jobs onto a part in one press, each row with its name; these notes |
| #6896 | v2.6416 | A fix to I, cut from main on 2026-11-03: Photos (v2.6371) joined as a sixth look after #6846 merged, and the phone's five-column grid dropped it to a second row; the row is now a flex row with a cell per look, and the strip names itself from its list |

Left for later, not in the stack: a pay-speed read by one customer (`get_customer_pay_speed` returns every
customer; an RPC is a migration) and a slimmer history-entries read (279 KB of mail bodies the page
shows folded). No migration and no edge function in the stack.
